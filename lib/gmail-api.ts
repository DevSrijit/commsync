"use client";

import type { Email } from "@/lib/types";
import { getCacheValue, setCacheValue } from './client-cache-browser';

// Helper function to refresh session
async function refreshSession() {
  try {
    console.log("Starting token refresh sequence...");
    
    // Force a session refresh by calling the NextAuth endpoint
    const refreshResponse = await fetch("/api/auth/refresh?provider=google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
    });

    if (!refreshResponse.ok) {
      console.error(`Refresh response not OK: ${refreshResponse.status} ${refreshResponse.statusText}`);
      
      // Try to get detailed error info
      try {
        const errorData = await refreshResponse.json();
        console.error("Token refresh error details:", errorData);
      } catch (e) {
        // If we can't parse the error response, just log the raw text
        try {
          console.error("Token refresh error response:", await refreshResponse.text());
        } catch (e2) {
          console.error("Could not extract error details from refresh response");
        }
      }
      
      // Check if we need to redirect to login
      if (refreshResponse.status === 401) {
        if (typeof window !== 'undefined') {
          console.log("Authentication required - redirecting to login page");
          window.location.href = `/login?error=token_expired&provider=google`;
          return null;
        }
      }
      throw new Error(`Failed to refresh session: ${refreshResponse.status} ${refreshResponse.statusText}`);
    }

    // Try to parse the refresh response directly first
    try {
      const refreshData = await refreshResponse.json();
      
      // If the refresh endpoint returned a token directly, use it
      if (refreshData && refreshData.accessToken) {
        console.log("Token refresh successful - got new token directly");
        return refreshData.accessToken;
      }
      
      // Otherwise, fall back to getting the session
      console.log("Token may be refreshed, but need to get session for the token");
    } catch (parseError) {
      console.warn("Could not parse refresh response as JSON, falling back to session fetch");
    }
    
    // Get new session with refreshed token
    const sessionResponse = await fetch("/api/auth/session", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
    });
    
    if (!sessionResponse.ok) {
      console.error(`Session response not OK: ${sessionResponse.status} ${sessionResponse.statusText}`);
      throw new Error("Failed to get updated session");
    }
    
    const session = await sessionResponse.json();
    
    // Check if we got a valid token
    if (!session?.user?.accessToken) {
      console.error("No access token found in refreshed session");
      return null;
    }
    
    console.log("Successfully obtained new access token from session");
    return session.user.accessToken;
  } catch (error) {
    console.error("Error refreshing session:", error);
    return null; // Return null instead of throwing to prevent further errors
  }
}

export async function fetchEmails(
  token: string,
  page: number = 1,
  pageSize: number = 100000, // Increased from default value
  query: string = ""
): Promise<Email[]> {
  try {
    if (!token) {
      console.error("Cannot fetch emails: No access token provided");
      return [];
    }

    // Calculate pagination parameters
    const maxResults = pageSize;
    
    // Remove any pagination limits for Gmail API
    const params = new URLSearchParams({
      maxResults: maxResults.toString(),
      q: query,
      includeSpamTrash: "false",
    });

    // If we want all emails, don't use pageToken
    const url = `https://www.googleapis.com/gmail/v1/users/me/messages?${params}`;
    
    console.log(`Fetching Gmail emails with params: maxResults=${maxResults}, page=${page}`);
    
    // Fetch list of messages
    let response = await fetch(
      url,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // If we get a 401 Unauthorized error, try to refresh the token and retry
    if (response.status === 401) {
      console.log("Token expired, attempting to refresh...");
      const newAccessToken = await refreshSession();

      if (newAccessToken) {
        console.log("Token refreshed successfully, retrying fetch");
        // Retry the request with the new token
        response = await fetch(
          url,
          {
            headers: {
              Authorization: `Bearer ${newAccessToken}`,
            },
          }
        );
      } else {
        console.error("Failed to refresh token. Authentication required.");
        if (typeof window !== 'undefined') {
          // Redirect to login page after delay to allow error to be seen
          setTimeout(() => {
            window.location.href = `/login?error=auth_required&provider=google`;
          }, 1000);
        }
        return []; // Return empty array to prevent further errors
      }
    }

    if (!response.ok) {
      console.error(`Failed to fetch Gmail messages: ${response.status} ${response.statusText}`);
      // Try to get response text for more details on error
      try {
        const errorText = await response.text();
        console.error(`Gmail API error response: ${errorText}`);
      } catch (e) {
        console.error("Could not get error response text");
      }
      return []; // Return empty array on error to prevent data loss
    }

    const data = await response.json();
    
    // Store the nextPageToken in the database if available
    if (data.nextPageToken) {
      const tokensString = await getCacheValue<string>('gmail_page_tokens');
      const tokens = tokensString ? JSON.parse(tokensString) : {};
      tokens[`page_${page}`] = data.nextPageToken;
      await setCacheValue('gmail_page_tokens', JSON.stringify(tokens));
    }

    const messages = data.messages || [];
    console.log(`Fetched ${messages.length} Gmail message IDs for page ${page}`);

    // If no messages found, return empty array immediately to prevent wiping out existing data
    if (messages.length === 0) {
      console.log("No Gmail messages found, returning empty array");
      return [];
    }

    // Track processed message IDs to prevent duplicates
    const processedIds = new Set<string>();
    
    // Fetch full details for each message
    const emails = await Promise.allSettled(
      messages.map(async (message: any) => {
        try {
          // Skip if we've already processed this ID in the current batch
          if (processedIds.has(message.id)) {
            console.log(`Skipping duplicate message ID: ${message.id}`);
            return null;
          }
          
          // Mark this ID as processed
          processedIds.add(message.id);
          
          let msgResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          // Handle 401 errors for individual message fetches
          if (msgResponse.status === 401) {
            console.log(`Token expired while fetching message ${message.id}, attempting to refresh...`);
            const newAccessToken = await refreshSession();
            
            if (newAccessToken) {
              // Retry the request with the new token
              msgResponse = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
                {
                  headers: {
                    Authorization: `Bearer ${newAccessToken}`,
                  },
                }
              );
            }
          }

          if (!msgResponse.ok) {
            console.warn(`Failed to fetch message ${message.id}: ${msgResponse.status} ${msgResponse.statusText}`);
            return null;
          }

          const msgData = await msgResponse.json();
          const parsedEmail = parseGmailMessage(msgData);
          
          // Add a data source flag to track origin
          parsedEmail.source = 'gmail-api';
          return parsedEmail;
        } catch (error) {
          console.warn(`Failed to fetch message ${message.id}:`, error);
          return null;
        }
      })
    );

    // Filter out failed requests and get successful ones
    const fetchedEmails = emails
      .filter(
        (result): result is PromiseFulfilledResult<Email> =>
          result.status === "fulfilled" && result.value !== null
      )
      .map((result) => result.value);

    console.log(`Successfully parsed ${fetchedEmails.length} Gmail messages`);

    // Add safety check for zero fetched emails
    if (fetchedEmails.length === 0) {
      console.warn("No Gmail messages were successfully fetched, skipping database sync to prevent data loss");
      return [];
    }

    // Sync with database only if we have successfully fetched emails
    await syncWithDatabase(fetchedEmails);

    return fetchedEmails;
  } catch (error) {
    console.error("Error fetching emails from Gmail API:", error);
    // Log detailed error info for debugging
    if (error instanceof Error) {
      console.error(`Error details: ${error.name}: ${error.message}`);
      console.error(`Error stack: ${error.stack}`);
    }
    // Return empty array to prevent data loss
    return [];
  }
}

// Update sync function to use database with improved duplicate detection
async function syncWithDatabase(gmailEmails: Email[]) {
  try {
    // Don't proceed with updating the database if no emails were fetched
    if (!gmailEmails || gmailEmails.length === 0) {
      console.log("No Gmail emails to sync with database - skipping update to prevent data loss");
      return;
    }

    console.log(`Starting database sync with ${gmailEmails.length} new Gmail emails`);

    // Create a map of fetched emails for quick lookup
    const gmailEmailMap = new Map(
      gmailEmails.map((email) => [email.id, email])
    );

    // Get existing emails from database
    const currentEmails = await getCacheValue<Email[]>("emails") || [];
    
    // Create new map that combines existing emails and new emails
    const emailMap = new Map();
    
    // First identify error emails to be replaced
    const errorEmails = new Set<string>();
    currentEmails.forEach((email) => {
      if (email.source === "gmail-api-error") {
        // Use thread ID + subject as key for better matching
        const key = generateEmailKey(email);
        errorEmails.add(key);
      }
    });
    
    // First add all existing emails that aren't duplicates from Gmail
    currentEmails.forEach((email) => {
      // Gmail emails should be uniquely identified by ID
      // Skip existing Gmail emails that might be duplicates of what we're adding
      const isGmailEmail = !email.accountId || email.accountType === "gmail" || email.source === "gmail-api";
      const isInCurrentBatch = isGmailEmail && gmailEmailMap.has(email.id);
      const key = generateEmailKey(email);
      
      // Skip error emails that will be replaced by real ones
      if (email.source === "gmail-api-error" && errorEmails.has(key)) {
        const hasRealVersion = gmailEmails.some(newEmail => 
          generateEmailKey(newEmail) === key && newEmail.source !== "gmail-api-error"
        );
        
        if (hasRealVersion) {
          console.log(`Skipping error email with key ${key} as it will be replaced`);
          return;
        }
      }
      
      if (!isInCurrentBatch) {
        emailMap.set(email.id, email);
      } else {
        console.log(`Skipping existing Gmail email with ID ${email.id} as it's in the current batch`);
      }
    });
    
    // Then add new Gmail emails
    gmailEmails.forEach((email) => {
      // Skip error emails if we already have a good version
      if (email.source === "gmail-api-error") {
        const key = generateEmailKey(email);
        const existingEmails = Array.from(emailMap.values());
        const hasGoodVersion = existingEmails.some(existing => 
          generateEmailKey(existing) === key && existing.source !== "gmail-api-error"
        );
        
        if (hasGoodVersion) {
          console.log(`Skipping error email as we already have a good version: ${key}`);
          return;
        }
      }
      
      if (!emailMap.has(email.id)) {
        emailMap.set(email.id, email);
      } else {
        // Merge only if it's a non-Gmail existing email (unlikely scenario)
        const existingEmail = emailMap.get(email.id);
        if (existingEmail.accountId && existingEmail.accountType !== "gmail" && !existingEmail.source) {
          // Keep account-specific fields from existing entry
          emailMap.set(email.id, {
            ...existingEmail,
            ...email,
            // Keep existing read status
            read: existingEmail.read !== undefined ? existingEmail.read : false,
          });
        }
      }
    });
    
    // Convert back to array
    const mergedEmails = Array.from(emailMap.values());
    
    // Sort by date, newest first
    mergedEmails.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    // Store in database - only if we have emails to store
    if (mergedEmails.length > 0) {
      await setCacheValue("emails", mergedEmails);
      await setCacheValue("emailsTimestamp", Date.now().toString());
      console.log(`Synced ${mergedEmails.length} emails with database`);
    } else {
      console.warn("No emails to store in database after merge - keeping existing data");
    }
  } catch (error) {
    console.error("Error syncing emails with database:", error);
    // Don't update the cache on error to prevent data loss
  }
}

export async function sendEmail({
  accessToken,
  to,
  subject,
  body,
  attachments = [],
  threadId = null, // Add optional threadId parameter
}: {
  accessToken: string;
  to: string;
  subject: string;
  body: string;
  attachments?: File[];
  threadId?: string | null; // Add this parameter to associate with existing thread
}): Promise<Email> {
  try {
    console.log("Sending email via Gmail API...");
    
    // Create the request body
    const requestBody: any = {
      raw: btoa(
        `From: me\r\n` +
          `To: ${to}\r\n` +
          `Subject: ${subject}\r\n` +
          `MIME-Version: 1.0\r\n` +
          `Content-Type: multipart/mixed; boundary="boundary"\r\n\r\n` +
          `--boundary\r\n` +
          `Content-Type: text/html; charset="UTF-8"\r\n\r\n` +
          `${body}\r\n\r\n` +
          attachments
            .map(
              (file) =>
                `--boundary\r\n` +
                `Content-Type: ${file.type || "application/octet-stream"}\r\n` +
                `Content-Disposition: attachment; filename="${file.name}"\r\n` +
                `Content-Transfer-Encoding: base64\r\n\r\n` +
                `[ATTACHMENT_DATA_${file.name}]\r\n\r\n`
            )
            .join("") +
          `--boundary--`
      )
        .replace(/[+]/g, "-")
        .replace(/[/]/g, "_")
        .replace(/=+$/, ""),
    };

    // If threadId is provided, include it in the request to maintain threading
    if (threadId) {
      requestBody.threadId = threadId;
    }

    // For each attachment, we need to replace the placeholder with actual base64 data
    for (const file of attachments) {
      const fileArrayBuffer = await file.arrayBuffer();
      const fileBase64 = btoa(
        new Uint8Array(fileArrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      )
        .replace(/[+]/g, "-")
        .replace(/[/]/g, "_")
        .replace(/=+$/, "");

      requestBody.raw = requestBody.raw.replace(
        `[ATTACHMENT_DATA_${file.name}]`,
        fileBase64
      );
    }

    let response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    // If we get a 401 Unauthorized error, try to refresh the token and retry
    if (response.status === 401) {
      console.log("Token expired, attempting to refresh...");
      const newAccessToken = await refreshSession();

      if (newAccessToken) {
        // Retry the request with the new token
        response = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${newAccessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          }
        );
      }
    }

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Gmail API error:", errorData);
      throw new Error(`Failed to send email: ${response.statusText}`);
    }

    const data = await response.json();

    // Fetch the sent message to get full details
    const msgResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${data.id}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!msgResponse.ok) {
      throw new Error(
        `Failed to fetch sent message: ${msgResponse.statusText}`
      );
    }

    const msgData = await msgResponse.json();
    return parseGmailMessage(msgData);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

function parseGmailMessage(message: any): Email {
  if (!message || !message.payload || !message.payload.headers) {
    console.warn("Invalid message structure from Gmail API:", message?.id);
    return {
      id: message?.id || `invalid-${Date.now()}`,
      threadId: message?.threadId || "",
      from: { name: "Unknown", email: "" },
      to: [{ name: "Unknown", email: "" }],
      subject: "Unable to load message",
      body: "This message couldn't be properly loaded from Gmail.",
      date: new Date().toISOString(),
      labels: message?.labelIds || [],
      source: "gmail-api-error"
    };
  }

  const headers = message.payload.headers;

  const getHeader = (name: string) => {
    const header = headers.find(
      (h: any) => h.name.toLowerCase() === name.toLowerCase()
    );
    return header ? header.value : "";
  };

  // Parse sender information
  const fromHeader = getHeader("From");
  const from = parseEmailAddress(fromHeader);
  
  // Validate and fix from field
  if (!from.email) {
    console.warn(`Invalid From header in message ${message.id}: "${fromHeader}"`);
    from.name = "Unknown Sender";
    from.email = "unknown@gmail.com";
  }

  // Parse recipients
  const toAddresses = getHeader("To");
  let to: Array<{name: string, email: string}> = [];
  
  if (toAddresses) {
    // Split multiple recipients and parse each one
    to = toAddresses
      .split(",")
      .map((addr: string) => {
        const parsed = parseEmailAddress(addr.trim());
        // Validate each recipient
        if (!parsed.email) {
          console.warn(`Invalid To address in message ${message.id}: "${addr}"`);
          return { name: "Unknown", email: "unknown@gmail.com" };
        }
        return parsed;
      });
  }
  
  // If no valid recipients were found, add a fallback
  if (to.length === 0) {
    to = [{ name: "Unknown", email: "unknown@gmail.com" }];
  }

  const subject = getHeader("Subject") || "(No Subject)";
  const date = getHeader("Date") || new Date().toISOString();

  // Extract body content and attachments
  let body = "";
  let htmlBody = "";
  const attachments: {
    id: string;
    filename?: string;
    mimeType?: string;
    size?: number;
    url?: string;
  }[] = [];

  // Safely process message parts
  const processPart = (part: any) => {
    if (!part) return;

    try {
      if (part.mimeType === "text/plain" && part.body?.data) {
        body = decodeBase64(part.body.data);
      } else if (part.mimeType === "text/html" && part.body?.data) {
        htmlBody = decodeBase64(part.body.data);
      } else if (part.filename && part.body?.attachmentId) {
        attachments.push({
          id: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType,
          size: parseInt(part.body.size) || 0,
          url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}/attachments/${part.body.attachmentId}`,
        });
      }

      // Recursively process nested parts
      if (Array.isArray(part.parts)) {
        part.parts.forEach(processPart);
      }
    } catch (error) {
      console.warn(`Error processing message part in ${message.id}:`, error);
    }
  };

  // Process message parts
  if (Array.isArray(message.payload.parts)) {
    message.payload.parts.forEach(processPart);
  } else if (message.payload.body) {
    try {
      if (message.payload.mimeType === "text/html" && message.payload.body.data) {
        htmlBody = decodeBase64(message.payload.body.data || "");
      } else if (message.payload.body.data) {
        body = decodeBase64(message.payload.body.data || "");
      }
    } catch (error) {
      console.warn(`Error processing message body in ${message.id}:`, error);
    }
  }

  // Prefer HTML content if available
  const finalBody = htmlBody || body || "No content available";
  const labels = message.labelIds || [];

  return {
    id: message.id,
    threadId: message.threadId,
    from,
    to,
    subject,
    body: finalBody,
    date,
    labels,
    accountType: "gmail",
    attachments: attachments.length > 0 ? attachments : undefined,
    source: "gmail-api"
  };
}

function parseEmailAddress(address: string) {
  if (!address) return { name: "", email: "" };

  const match = address.match(/(.*?)\s*<(.+)>/);
  if (match) {
    return {
      name: match[1].trim().replace(/"/g, ""),
      email: match[2].trim(),
    };
  }

  return {
    name: address,
    email: address,
  };
}

function decodeBase64(data: string) {
  const text = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
  return decodeURIComponent(escape(text));
}

function generateEmailKey(email: Email): string {
  // Use threadId + subject as a more reliable key for deduplication
  return `${email.threadId || ''}-${email.subject || ''}`;
}

/**
 * Identifies and re-fetches problematic emails from Gmail
 * @param token Access token for Gmail API
 * @returns Array of fixed emails
 */
export async function repairErrorEmails(token: string): Promise<Email[]> {
  try {
    console.log("Starting repair of error emails...");
    
    // Get existing emails from cache
    const currentEmails = await getCacheValue<Email[]>("emails") || [];
    
    // Identify problematic emails
    const errorEmails = currentEmails.filter(email => 
      // Check for emails with Gmail API errors
      email.source === "gmail-api-error" || 
      // Check for emails with empty bodies that should have content
      ((!email.accountId || email.accountType === "gmail") && 
       (!email.body || email.body.trim() === "") && 
       !email.labels?.includes("DRAFT"))
    );
    
    if (errorEmails.length === 0) {
      console.log("No error emails found to repair");
      return [];
    }
    
    console.log(`Found ${errorEmails.length} emails to repair`);
    
    // Group by threadId to avoid duplicate fetches for the same thread
    const threadGroups = new Map<string, Email[]>();
    errorEmails.forEach(email => {
      if (email.threadId) {
        const group = threadGroups.get(email.threadId) || [];
        group.push(email);
        threadGroups.set(email.threadId, group);
      } else {
        // Handle emails without threadId
        const key = `no-thread-${email.id}`;
        threadGroups.set(key, [email]);
      }
    });
    
    console.log(`Grouped into ${threadGroups.size} threads to fetch`);
    
    // Fetch and repair emails thread by thread
    const repairedEmails: Email[] = [];
    
    for (const [threadId, emails] of threadGroups.entries()) {
      try {
        if (threadId.startsWith('no-thread-')) {
          // Handle individual emails without threadId
          const email = emails[0];
          const messageId = email.id;
          
          console.log(`Fetching individual message ${messageId}`);
          
          // Fetch the individual message
          const msgResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          
          if (!msgResponse.ok) {
            console.warn(`Failed to fetch message ${messageId}: ${msgResponse.status}`);
            continue;
          }
          
          const msgData = await msgResponse.json();
          const parsedEmail = parseGmailMessage(msgData);
          parsedEmail.source = 'gmail-api';
          
          repairedEmails.push(parsedEmail);
        } else {
          // Fetch the entire thread
          console.log(`Fetching thread ${threadId}`);
          
          const threadResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          
          if (!threadResponse.ok) {
            console.warn(`Failed to fetch thread ${threadId}: ${threadResponse.status}`);
            continue;
          }
          
          const threadData = await threadResponse.json();
          
          // Process all messages in the thread
          if (threadData.messages && threadData.messages.length > 0) {
            for (const message of threadData.messages) {
              const parsedEmail = parseGmailMessage(message);
              parsedEmail.source = 'gmail-api';
              repairedEmails.push(parsedEmail);
            }
          }
        }
      } catch (error) {
        console.error(`Error repairing thread ${threadId}:`, error);
      }
    }
    
    console.log(`Successfully repaired ${repairedEmails.length} emails`);
    
    // Update the email store with repaired emails
    if (repairedEmails.length > 0) {
      await updateEmailStore(repairedEmails);
    }
    
    return repairedEmails;
  } catch (error) {
    console.error("Error repairing emails:", error);
    return [];
  }
}

/**
 * Updates the email store with repaired emails
 */
async function updateEmailStore(repairedEmails: Email[]): Promise<void> {
  try {
    // Get current emails
    const currentEmails = await getCacheValue<Email[]>("emails") || [];
    
    // Create a map for quick lookup
    const emailMap = new Map(currentEmails.map(email => [email.id, email]));
    
    // Update or add repaired emails
    let updatedCount = 0;
    let addedCount = 0;
    
    repairedEmails.forEach(email => {
      if (emailMap.has(email.id)) {
        // Update existing email
        emailMap.set(email.id, {
            ...emailMap.get(email.id),
            ...email,
            body: email.body || emailMap.get(email.id)?.body || "No content available",
            attachments: email.attachments || emailMap.get(email.id)?.attachments,
            source: 'gmail-api'
          });
        updatedCount++;
      } else {
        // Add new email
        emailMap.set(email.id, email);
        addedCount++;
      }
    });
    
    // Convert map back to array
    const updatedEmails = Array.from(emailMap.values());
    
    // Save to cache
    await setCacheValue("emails", updatedEmails);
    
    console.log(`Email store updated: ${updatedCount} emails updated, ${addedCount} emails added`);
  } catch (error) {
    console.error("Error updating email store:", error);
  }
}
