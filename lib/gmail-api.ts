"use client";

import type { Email } from "@/lib/types";
import { getCacheValue, setCacheValue } from "./client-cache-browser";

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
      console.error(
        `Refresh response not OK: ${refreshResponse.status} ${refreshResponse.statusText}`
      );

      // Try to get detailed error info
      try {
        const errorData = await refreshResponse.json();
        console.error("Token refresh error details:", errorData);
      } catch (e) {
        // If we can't parse the error response, just log the raw text
        try {
          console.error(
            "Token refresh error response:",
            await refreshResponse.text()
          );
        } catch (e2) {
          console.error(
            "Could not extract error details from refresh response"
          );
        }
      }

      // Check if we need to redirect to login
      if (refreshResponse.status === 401) {
        if (typeof window !== "undefined") {
          console.log("Authentication required - redirecting to login page");
          window.location.href = `/login?error=token_expired&provider=google`;
          return null;
        }
      }
      throw new Error(
        `Failed to refresh session: ${refreshResponse.status} ${refreshResponse.statusText}`
      );
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
      console.log(
        "Token may be refreshed, but need to get session for the token"
      );
    } catch (parseError) {
      console.warn(
        "Could not parse refresh response as JSON, falling back to session fetch"
      );
    }

    // Get new session with refreshed token
    const sessionResponse = await fetch("/api/auth/session", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
    });

    if (!sessionResponse.ok) {
      console.error(
        `Session response not OK: ${sessionResponse.status} ${sessionResponse.statusText}`
      );
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

    console.log(
      `Fetching Gmail emails with params: maxResults=${maxResults}, page=${page}`
    );

    // Fetch list of messages
    let response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // If we get a 401 Unauthorized error, try to refresh the token and retry
    if (response.status === 401) {
      console.log("Token expired, attempting to refresh...");
      const newAccessToken = await refreshSession();

      if (newAccessToken) {
        console.log("Token refreshed successfully, retrying fetch");
        // Retry the request with the new token
        response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${newAccessToken}`,
          },
        });
      } else {
        console.error("Failed to refresh token. Authentication required.");
        if (typeof window !== "undefined") {
          // Redirect to login page after delay to allow error to be seen
          setTimeout(() => {
            window.location.href = `/login?error=auth_required&provider=google`;
          }, 1000);
        }
        return []; // Return empty array to prevent further errors
      }
    }

    if (!response.ok) {
      console.error(
        `Failed to fetch Gmail messages: ${response.status} ${response.statusText}`
      );
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
      const tokensString = await getCacheValue<string>("gmail_page_tokens");
      // Check if tokensString is already an object before parsing
      const tokens =
        typeof tokensString === "object"
          ? tokensString || {}
          : tokensString
          ? JSON.parse(tokensString)
          : {};
      tokens[`page_${page}`] = data.nextPageToken;
      await setCacheValue("gmail_page_tokens", JSON.stringify(tokens));
    }

    const messages = data.messages || [];
    console.log(
      `Fetched ${messages.length} Gmail message IDs for page ${page}`
    );

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
            console.log(
              `Token expired while fetching message ${message.id}, attempting to refresh...`
            );
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
            console.warn(
              `Failed to fetch message ${message.id}: ${msgResponse.status} ${msgResponse.statusText}`
            );
            return null;
          }

          const msgData = await msgResponse.json();
          const parsedEmail = parseGmailMessage(msgData);

          // Add a data source flag to track origin
          parsedEmail.source = "gmail-api";
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
      console.warn(
        "No Gmail messages were successfully fetched, skipping database sync to prevent data loss"
      );
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
      console.log(
        "No Gmail emails to sync with database - skipping update to prevent data loss"
      );
      return;
    }

    console.log(
      `Starting database sync with ${gmailEmails.length} new Gmail emails`
    );

    // Create maps for more robust deduplication
    const gmailEmailsByKey = new Map<string, Email>();
    const gmailEmailsById = new Map<string, Email>();

    // Process all new emails into lookup maps
    gmailEmails.forEach((email) => {
      const uniqueKey = generateEmailKey(email);
      gmailEmailsByKey.set(uniqueKey, email);
      gmailEmailsById.set(email.id, email);
    });

    // Get existing emails from database
    const currentEmails = (await getCacheValue<Email[]>("emails")) || [];

    // Create maps for existing emails
    const currentEmailsByKey = new Map<string, Email>();
    const currentEmailsById = new Map<string, Email>();

    // Track which emails need to be fixed
    const errorEmails = new Set<string>();

    // First scan: identify error emails and build lookup maps
    currentEmails.forEach((email) => {
      // Add to ID lookup
      currentEmailsById.set(email.id, email);

      // Check if this is an error email
      if (email.source === "gmail-api-error") {
        const key = generateEmailKey(email);
        errorEmails.add(key);
        console.log(`Marking error email for replacement: ${key}`);
      } else {
        // For non-error emails, add to key lookup
        const key = generateEmailKey(email);
        currentEmailsByKey.set(key, email);
      }
    });

    // Final merged email map to build the result set
    const finalEmailMap = new Map<string, Email>();

    // First add all existing emails, except those to be replaced
    currentEmails.forEach((email) => {
      const key = generateEmailKey(email);

      // Skip error emails that will be replaced
      if (email.source === "gmail-api-error" && errorEmails.has(key)) {
        // Check if we have a replacement
        if (gmailEmailsByKey.has(key)) {
          console.log(
            `Skipping error email with key ${key} as it will be replaced`
          );
          return;
        }
      }

      // If this is a Gmail email that we're going to replace with a newer version, skip it
      if (
        (!email.accountId ||
          email.accountType === "gmail" ||
          email.source === "gmail-api") &&
        gmailEmailsById.has(email.id)
      ) {
        console.log(
          `Skipping existing Gmail email with ID ${email.id} as it's in the current batch`
        );
        return;
      }

      // Otherwise keep it in the final map
      finalEmailMap.set(email.id, email);
    });

    // Then add all new Gmail emails
    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    gmailEmails.forEach((email) => {
      const key = generateEmailKey(email);

      // If this is an error email and we already have a good version, skip it
      if (email.source === "gmail-api-error") {
        if (
          currentEmailsByKey.has(key) &&
          currentEmailsByKey.get(key)?.source !== "gmail-api-error"
        ) {
          console.log(
            `Skipping error email as we already have a good version: ${key}`
          );
          skippedCount++;
          return;
        }
      }

      // If we already have this exact email ID
      if (finalEmailMap.has(email.id)) {
        // Update it (merge with existing)
        const existingEmail = finalEmailMap.get(email.id)!;

        // Preserve certain fields from the existing email
        finalEmailMap.set(email.id, {
          ...existingEmail,
          ...email,
          // Keep existing read status
          read: existingEmail.read !== undefined ? existingEmail.read : false,
          // For forwarded emails, preserve original metadata if available
          metadata: email.metadata || existingEmail.metadata,
          // Ensure we have the best possible body content
          body:
            email.body && email.body !== "No content available"
              ? email.body
              : existingEmail.body || "No content available",
          // FIX: Keep attachments if the new email doesn't have any
          attachments: email.attachments?.length
            ? email.attachments
            : existingEmail.attachments,
        });
        updatedCount++;
      } else {
        // Just add the new email
        finalEmailMap.set(email.id, email);
        addedCount++;
      }
    });

    // Convert back to array
    const mergedEmails = Array.from(finalEmailMap.values());

    // Sort by date, newest first
    mergedEmails.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    console.log(`Email processing summary:
- Added: ${addedCount} new emails
- Updated: ${updatedCount} existing emails
- Skipped: ${skippedCount} emails
- Total in store: ${mergedEmails.length} emails`);

    // Store in database - only if we have emails to store
    if (mergedEmails.length > 0) {
      await setCacheValue("emails", mergedEmails);
      await setCacheValue("emailsTimestamp", Date.now().toString());
      console.log(`Synced ${mergedEmails.length} emails with database`);
    } else {
      console.warn(
        "No emails to store in database after merge - keeping existing data"
      );
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
      source: "gmail-api-error",
    };
  }

  const headers = message.payload.headers;

  const getHeader = (name: string) => {
    const header = headers.find(
      (h: any) => h.name.toLowerCase() === name.toLowerCase()
    );
    return header ? header.value : "";
  };

  // Collect all headers for detailed analysis
  const allHeaders: Record<string, string> = {};
  headers.forEach((header: any) => {
    const name = header.name.toLowerCase();
    allHeaders[name] = header.value;
  });

  // Check if this is a forwarded email (look for common forwarding patterns)
  const isForwarded =
    !!allHeaders["x-forwarded-for"] ||
    !!allHeaders["forwarded"] ||
    !!allHeaders["resent-from"] ||
    !!allHeaders["x-forwarded"] ||
    (allHeaders["delivered-to"] &&
      allHeaders["to"] &&
      allHeaders["delivered-to"] !== allHeaders["to"]) ||
    getHeader("Subject").toLowerCase().startsWith("fw:") ||
    getHeader("Subject").toLowerCase().startsWith("fwd:");

  // Parse sender information
  const fromHeader = getHeader("From");
  const from = parseEmailAddress(fromHeader);

  // For forwarded emails, try to find the original sender
  let originalSender = from;
  if (isForwarded) {
    // Try various headers that might indicate the original sender
    const possibleOriginalSenders = [
      parseEmailAddress(allHeaders["x-original-sender"] || ""),
      parseEmailAddress(allHeaders["x-envelope-from"] || ""),
      parseEmailAddress(allHeaders["return-path"] || ""),
    ];

    // Use the first valid original sender we find
    for (const sender of possibleOriginalSenders) {
      if (sender.email && sender.email !== from.email) {
        originalSender = sender;
        console.log(
          `Using original sender ${originalSender.email} for forwarded email ${message.id}`
        );
        break;
      }
    }
  }

  // Validate and fix from field
  if (!from.email) {
    console.warn(
      `Invalid From header in message ${message.id}: "${fromHeader}"`
    );
    from.name = "Unknown Sender";
    from.email = "unknown@gmail.com";
  }

  // Parse recipients, handling multiple formats and potential errors
  const toAddresses = getHeader("To");
  const ccAddresses = getHeader("Cc");
  const bccAddresses = getHeader("Bcc");
  let to: Array<{ name: string; email: string }> = [];

  // Helper function to safely parse comma-separated addresses
  const parseAddressList = (addressList: string) => {
    if (!addressList) return [];

    let addresses: Array<{ name: string; email: string }> = [];

    try {
      // Handle quoted addresses with commas inside like "Lastname, Firstname" <email@example.com>
      const regex = /("[^"]*"[^,]*|[^,]+)(?:,|$)/g;
      let match;
      let chunks = [];

      while ((match = regex.exec(addressList)) !== null) {
        chunks.push(match[1].trim());
      }

      // If regex didn't match anything, fallback to simple split
      if (chunks.length === 0) {
        chunks = addressList.split(",");
      }

      addresses = chunks
        .map((addr) => {
          const parsed = parseEmailAddress(addr.trim());
          if (!parsed.email) {
            console.warn(`Invalid address in message ${message.id}: "${addr}"`);
            return null;
          }
          return parsed;
        })
        .filter(Boolean) as Array<{ name: string; email: string }>;
    } catch (error) {
      console.warn(
        `Error parsing address list in message ${message.id}: "${addressList}"`,
        error
      );

      // Fallback: try a more lenient split with basic validation
      try {
        addresses = addressList
          .split(",")
          .map((addr) => addr.trim())
          .filter((addr) => addr && addr.indexOf("@") > 0)
          .map((addr) => {
            // Simple extraction of email part if angle brackets exist
            const emailMatch = addr.match(/<([^>]+)>/) || [null, addr];
            const nameMatch = addr.match(/^(.*?)\s*</) || [null, ""];
            return {
              name:
                nameMatch[1]?.trim().replace(/"/g, "") ||
                emailMatch[1]?.trim() ||
                addr,
              email: emailMatch[1]?.trim() || addr,
            };
          });
      } catch (innerError) {
        console.error(
          `Failed fallback address parsing for message ${message.id}`,
          innerError
        );
      }
    }

    return addresses;
  };

  // Process all recipient types
  to = parseAddressList(toAddresses);
  const cc = parseAddressList(ccAddresses);
  const bcc = parseAddressList(bccAddresses);

  // Use delivered-to as a fallback if regular to is empty
  if (to.length === 0 && allHeaders["delivered-to"]) {
    const delivered = parseEmailAddress(allHeaders["delivered-to"]);
    if (delivered.email) {
      to.push(delivered);
    }
  }

  // For forwarded emails with empty to, try to extract from body or headers
  if (isForwarded && to.length === 0) {
    // Look for X-Forwarded-To header
    if (allHeaders["x-forwarded-to"]) {
      to = parseAddressList(allHeaders["x-forwarded-to"]);
    }
  }

  // If no valid recipients were found, add a fallback
  if (to.length === 0) {
    to = [{ name: "Unknown Recipient", email: "unknown@gmail.com" }];
  }

  // Combine all recipients for comprehensive tracking
  const allRecipients = [...to, ...cc, ...bcc];

  // Get subject with forwarding prefix detection
  let subject = getHeader("Subject") || "(No Subject)";
  const originalSubject = subject.replace(/^(?:RE|FWD?|AW|WG):\s*/i, "").trim();

  // Parse date more robustly
  let date = getHeader("Date") || new Date().toISOString();
  try {
    // Verify the date is valid, if not use received date or current date
    new Date(date).toISOString();
  } catch (e) {
    // Date parsing failed, try to extract from Received header or use current date
    const receivedHeader = getHeader("Received");
    if (receivedHeader) {
      const dateMatch = receivedHeader.match(/;\s*(.+)$/);
      if (dateMatch && dateMatch[1]) {
        try {
          date = new Date(dateMatch[1].trim()).toISOString();
        } catch (e2) {
          date = new Date().toISOString();
        }
      } else {
        date = new Date().toISOString();
      }
    } else {
      date = new Date().toISOString();
    }
  }

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

  // Track content parts to deduplicate
  const processedTextContents = new Set<string>();
  const processedHtmlContents = new Set<string>();

  // Enhanced mime part processing to better handle nested structures
  const processPart = (part: any, depth = 0) => {
    if (!part) return;

    try {
      // Process based on mime type
      const mimeType = (part.mimeType || "").toLowerCase();

      // Handle text parts
      if (mimeType === "text/plain" && part.body?.data) {
        const decodedText = decodeBase64(part.body.data);

        // Only add this content if we haven't seen it before
        if (!processedTextContents.has(decodedText)) {
          processedTextContents.add(decodedText);
          body = body ? `${body}\n\n${decodedText}` : decodedText;
        }
      } else if (mimeType === "text/html" && part.body?.data) {
        const decodedHtml = decodeBase64(part.body.data);

        // Only add this content if we haven't seen it before
        if (!processedHtmlContents.has(decodedHtml)) {
          processedHtmlContents.add(decodedHtml);
          htmlBody = htmlBody ? `${htmlBody}\n\n${decodedHtml}` : decodedHtml;
        }
      }
      // Handle multipart containers
      else if (mimeType.startsWith("multipart/")) {
        // For multipart/alternative, we'll collect all parts but prefer HTML in the end
        if (Array.isArray(part.parts)) {
          // For multipart/alternative, process parts in reverse order to prioritize HTML
          // (HTML parts usually come after plain text parts)
          const partsToProcess = [...part.parts];
          if (mimeType === "multipart/alternative") {
            partsToProcess.reverse();
          }
          partsToProcess.forEach((subpart: any) =>
            processPart(subpart, depth + 1)
          );
        }
      }
      // Handle attachments - both inline and regular
      else if (
        (part.filename ||
          mimeType.startsWith("image/") ||
          mimeType.startsWith("application/")) &&
        part.body
      ) {
        // Check if this is an attachment with attachment ID
        if (part.body.attachmentId) {
          attachments.push({
            id: part.body.attachmentId,
            filename:
              part.filename ||
              `attachment-${attachments.length + 1}.${getExtensionFromMimeType(
                mimeType
              )}`,
            mimeType: part.mimeType,
            size: parseInt(part.body.size) || 0,
            url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}/attachments/${part.body.attachmentId}`,
          });
        }
        // Handle inline content with data
        else if (part.body.data) {
          const filename =
            part.filename ||
            `inline-${attachments.length + 1}.${getExtensionFromMimeType(
              mimeType
            )}`;
          attachments.push({
            id: `inline-${Date.now()}-${attachments.length}`,
            filename,
            mimeType: part.mimeType,
            size: part.body.data.length * 0.75, // Estimate size from base64
            url: `data:${part.mimeType};base64,${part.body.data}`,
          });
        }
      }

      // Recursively process nested parts
      if (Array.isArray(part.parts)) {
        part.parts.forEach((subpart: any) => processPart(subpart, depth + 1));
      }
    } catch (error) {
      console.warn(`Error processing message part in ${message.id}:`, error);
    }
  };

  // Process message parts with enhanced error handling
  try {
    if (Array.isArray(message.payload.parts)) {
      message.payload.parts.forEach((part: any) => processPart(part));
    } else if (message.payload.body) {
      // Handle simple messages with no parts structure
      const mimeType = (message.payload.mimeType || "").toLowerCase();

      if (mimeType === "text/html" && message.payload.body.data) {
        htmlBody = decodeBase64(message.payload.body.data || "");
      } else if (message.payload.body.data) {
        body = decodeBase64(message.payload.body.data || "");
      }
    }
  } catch (error) {
    console.warn(`Error processing message structure in ${message.id}:`, error);
  }

  // If we still couldn't get body content, try a last resort approach
  if (!htmlBody && !body) {
    try {
      // Try to find any part with data
      const findDataInParts = (part: any): string | null => {
        if (!part) return null;

        if (part.body?.data) {
          return decodeBase64(part.body.data);
        }

        if (Array.isArray(part.parts)) {
          for (const subpart of part.parts) {
            const result = findDataInParts(subpart);
            if (result) return result;
          }
        }

        return null;
      };

      const lastResortBody = findDataInParts(message.payload);
      if (lastResortBody) {
        body = lastResortBody;
      }
    } catch (error) {
      console.warn(
        `Last resort body extraction failed for message ${message.id}:`,
        error
      );
    }
  }

  // Prefer HTML content if available
  const finalBody = htmlBody || body || "No content available";
  const labels = message.labelIds || [];

  // Collect all important headers for race/duplicate detection
  const messageId = getHeader("Message-ID") || "";
  const references = getHeader("References") || "";
  const inReplyTo = getHeader("In-Reply-To") || "";

  // Create a metadata object for advanced processing
  const metadata = {
    isForwarded,
    originalSender: originalSender !== from ? originalSender : undefined,
    originalSubject,
    allRecipients,
    hasAttachments: attachments.length > 0,
    messageId,
    references,
    inReplyTo,
  };

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
    source: "gmail-api",
    // Add metadata to help with edge case handling and debugging
    metadata,
  };
}

/**
 * Helper function to get a file extension from mime type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      "pptx",
    "text/plain": "txt",
    "text/html": "html",
    "text/csv": "csv",
    "application/zip": "zip",
    "application/x-rar-compressed": "rar",
    "application/json": "json",
    "application/xml": "xml",
  };

  return mimeToExt[mimeType] || "bin";
}

/**
 * Enhanced email address parser with better error handling
 */
function parseEmailAddress(address: string) {
  if (!address) return { name: "", email: "" };

  try {
    // Handle quoted display name with potential angle brackets within
    // Format: "Display Name with <potential> characters" <email@example.com>
    const quotedMatch = address.match(/"([^"]+)"\s*<([^>]+)>/);
    if (quotedMatch) {
      return {
        name: quotedMatch[1].trim(),
        email: quotedMatch[2].trim().toLowerCase(),
      };
    }

    // Handle standard format: Display Name <email@example.com>
    const standardMatch = address.match(/(.*?)\s*<([^>]+)>/);
    if (standardMatch) {
      return {
        name: standardMatch[1].trim().replace(/"/g, ""),
        email: standardMatch[2].trim().toLowerCase(),
      };
    }

    // Check if it looks like just an email address with the @ symbol
    if (address.includes("@")) {
      // Try to extract just the email part - FIX: include single quotes in allowed chars
      const emailMatch = address.match(/([^\s<@]+['.]?[^\s<@]*@[^\s>]+)/);
      if (emailMatch) {
        const extractedEmail = emailMatch[1].toLowerCase();
        return {
          name: address.includes("<")
            ? address.replace(/<.*/, "").trim()
            : extractedEmail,
          email: extractedEmail,
        };
      }
    }

    // If we can't parse it but it has an @ symbol, make a best effort
    if (address.includes("@")) {
      const parts = address.split("@");
      if (parts.length >= 2) {
        const domain = parts.pop() || "";
        const localPart = parts.join("@");
        const bestGuessEmail = `${localPart}@${domain}`.toLowerCase();
        return {
          name: address,
          email: bestGuessEmail,
        };
      }
    }

    // Fallback: assume the whole string is both name and email if no better match
    return {
      name: address,
      email: address.toLowerCase(),
    };
  } catch (error) {
    console.warn(`Error parsing email address: "${address}"`, error);
    // Last resort fallback
    return {
      name: address || "Unknown",
      email:
        address && address.includes("@")
          ? address.toLowerCase()
          : "unknown@example.com",
    };
  }
}

/**
 * Enhanced base64 decoder with error handling
 */
function decodeBase64(data: string) {
  if (!data) return "";

  try {
    // Clean up the base64 string - Gmail uses URL-safe base64
    const cleaned = data.replace(/-/g, "+").replace(/_/g, "/");

    // Add padding if needed
    const padded = cleaned.padEnd(Math.ceil(cleaned.length / 4) * 4, "=");

    // Decode the base64 to binary data
    const binary = atob(padded);

    // Convert binary to UTF-8
    try {
      // First try standard conversion
      return decodeURIComponent(escape(binary));
    } catch (e) {
      // If that fails, try alternative character-by-character conversion
      let result = "";
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      // Decode as UTF-8 text
      const decoder = new TextDecoder("utf-8", { fatal: false });
      return decoder.decode(bytes);
    }
  } catch (error) {
    console.warn("Error decoding base64 data:", error);
    return ""; // Return empty string on error
  }
}

/**
 * Generate a more robust unique key for an email
 * Handles forwarded emails and other edge cases better
 */
function generateEmailKey(email: Email): string {
  // If we have metadata available, use more robust identification
  if (email.metadata) {
    const metadata = email.metadata;

    // If we have a proper Message-ID, use that as the primary key
    if (metadata.messageId) {
      return `mid-${metadata.messageId}`;
    }

    // For forwarded emails, use a combination of original sender, recipient and subject
    // FIX: Check if originalSender exists before accessing its email property
    if (
      metadata.isForwarded &&
      metadata.originalSender &&
      metadata.originalSubject
    ) {
      return `fwd-${metadata.originalSender.email}-${metadata.originalSubject}`;
    }
  }

  // Fallback: Use a combination of threadId, from, to, subject, and date
  // This handles cases where the same conversation appears multiple times
  const fromEmail = (email.from?.email || "").toLowerCase();
  const toEmails = (email.to || [])
    .map((t) => t.email.toLowerCase())
    .sort()
    .join(",");
  const cleanSubject = (email.subject || "").trim();

  // Remove prefixes like Re:, Fwd:, etc.
  const normalizedSubject = cleanSubject
    .replace(/^(?:RE|FWD?|AW|WG):\s*/i, "")
    .trim();

  // If we have a thread ID, include it for better grouping
  if (email.threadId) {
    return `${email.threadId}-${fromEmail}-${normalizedSubject}`;
  }

  // Last resort: combine key elements with date to create unique key
  return `${fromEmail}-${toEmails}-${normalizedSubject}-${
    email.date?.split("T")[0] || ""
  }`;
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
    const currentEmails = (await getCacheValue<Email[]>("emails")) || [];

    // Identify problematic emails
    const errorEmails = currentEmails.filter(
      (email) =>
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
    errorEmails.forEach((email) => {
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
        if (threadId.startsWith("no-thread-")) {
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
            console.warn(
              `Failed to fetch message ${messageId}: ${msgResponse.status}`
            );
            continue;
          }

          const msgData = await msgResponse.json();
          const parsedEmail = parseGmailMessage(msgData);
          parsedEmail.source = "gmail-api";

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
            console.warn(
              `Failed to fetch thread ${threadId}: ${threadResponse.status}`
            );
            continue;
          }

          const threadData = await threadResponse.json();

          // Process all messages in the thread
          if (threadData.messages && threadData.messages.length > 0) {
            for (const message of threadData.messages) {
              const parsedEmail = parseGmailMessage(message);
              parsedEmail.source = "gmail-api";
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
    const currentEmails = (await getCacheValue<Email[]>("emails")) || [];

    // Create maps for better lookup and deduplication
    const emailsByKey = new Map<string, Email>();
    const emailsById = new Map<string, Email>();

    // First, index all current emails
    currentEmails.forEach((email) => {
      emailsById.set(email.id, email);

      // Also index by a more robust key for better matching
      const key = generateEmailKey(email);
      emailsByKey.set(key, email);
    });

    // Track all modifications
    let updatedCount = 0;
    let addedCount = 0;
    let skippedCount = 0;

    // Process each repaired email
    repairedEmails.forEach((email) => {
      const key = generateEmailKey(email);

      // Check if we already have this email by ID
      if (emailsById.has(email.id)) {
        const existing = emailsById.get(email.id)!;

        // Skip if the existing one is already good and the new one is an error
        if (
          existing.source !== "gmail-api-error" &&
          email.source === "gmail-api-error"
        ) {
          skippedCount++;
          return;
        }

        // Update existing email, preserving certain fields
        emailsById.set(email.id, {
          ...existing,
          ...email,
          // Keep the better body between the two
          body:
            email.body && email.body !== "No content available"
              ? email.body
              : existing.body || "No content available",
          // FIX: Only replace attachments if the new email actually has attachments
          attachments: email.attachments?.length
            ? email.attachments
            : existing.attachments,
          // Keep read status
          read: existing.read,
          // Keep the better source indication
          source:
            email.source !== "gmail-api-error" ? email.source : existing.source,
        });
        updatedCount++;
      }
      // If we don't have it by ID but do have it by key, decide which to keep
      else if (emailsByKey.has(key)) {
        const existingByKey = emailsByKey.get(key)!;

        // Skip if existing is good and new is error
        if (
          existingByKey.source !== "gmail-api-error" &&
          email.source === "gmail-api-error"
        ) {
          skippedCount++;
          return;
        }

        // If new email is better, replace existing
        if (
          email.source !== "gmail-api-error" ||
          existingByKey.source === "gmail-api-error"
        ) {
          // Remove the old one by ID
          emailsById.delete(existingByKey.id);

          // Add the new one, preserving attachments if needed
          emailsById.set(email.id, {
            ...email,
            // FIX: Preserve attachments from existing email if new one has none
            attachments: email.attachments?.length
              ? email.attachments
              : existingByKey.attachments,
            // Keep read status from existing if it exists
            read: existingByKey.read,
          });
          updatedCount++;
        } else {
          skippedCount++;
        }
      } else {
        // This is a genuinely new email
        emailsById.set(email.id, email);
        addedCount++;
      }
    });

    // Convert map back to array
    const updatedEmails = Array.from(emailsById.values());

    // Sort by date, newest first
    updatedEmails.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Save to cache
    await setCacheValue("emails", updatedEmails);

    console.log(`Email store update summary:
- Added: ${addedCount} new emails
- Updated: ${updatedCount} existing emails
- Skipped: ${skippedCount} emails (already had better versions)
- Total in store: ${updatedEmails.length} emails`);
  } catch (error) {
    console.error("Error updating email store:", error);
  }
}
