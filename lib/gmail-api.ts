"use client";

import type { Email } from "@/lib/types";
import { getCacheValue, setCacheValue } from './client-cache-browser';

// Helper function to refresh session
async function refreshSession() {
  try {
    // Force a session refresh by calling the NextAuth endpoint
    const refreshResponse = await fetch("/api/auth/session", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
    });

    if (!refreshResponse.ok) {
      throw new Error("Failed to refresh session");
    }

    const session = await refreshResponse.json();
    return session?.user?.accessToken;
  } catch (error) {
    console.error("Error refreshing session:", error);
    throw error;
  }
}

export async function fetchEmails(
  token: string,
  page: number = 1,
  pageSize: number = 100000, // Increased from default value
  query: string = ""
): Promise<Email[]> {
  try {
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
        // Retry the request with the new token
        response = await fetch(
          url,
          {
            headers: {
              Authorization: `Bearer ${newAccessToken}`,
            },
          }
        );
      }
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch emails: ${response.statusText}`);
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
    console.log(`Fetched ${messages.length} Gmail messages for page ${page}`);

    // Fetch full details for each message
    const emails = await Promise.allSettled(
      messages.map(async (message: any) => {
        try {
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
            throw new Error(
              `Failed to fetch message ${message.id}: ${msgResponse.statusText}`
            );
          }

          const msgData = await msgResponse.json();
          return parseGmailMessage(msgData);
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

    // Sync with database instead of local storage
    await syncWithDatabase(fetchedEmails);

    return fetchedEmails;
  } catch (error) {
    console.error("Error fetching emails:", error);
    return [];
  }
}

// Update sync function to use database
async function syncWithDatabase(gmailEmails: Email[]) {
  try {
    // Create a map of fetched emails for quick lookup
    const gmailEmailMap = new Map(
      gmailEmails.map((email) => [email.id, email])
    );

    // Get current emails from database
    const currentEmails = await getCacheValue<Email[]>("emails") || [];

    // Filter out emails that no longer exist in Gmail
    const filteredEmails = currentEmails.filter((email) =>
      gmailEmailMap.has(email.id)
    );

    // Create new map that combines existing emails and new emails
    const emailMap = new Map();
    
    // First add all existing emails
    filteredEmails.forEach((email) => {
      emailMap.set(email.id, email);
    });
    
    // Then add or update with new Gmail emails
    gmailEmails.forEach((email) => {
      const existingEmail = emailMap.get(email.id);
      
      if (!existingEmail) {
        emailMap.set(email.id, email);
      } else {
        // Merge the emails, keeping important fields from existing entry
        emailMap.set(email.id, {
          ...existingEmail,
          ...email,
          // Keep existing read status
          read: existingEmail.read !== undefined ? existingEmail.read : false,
        });
      }
    });
    
    // Convert back to array
    const mergedEmails = Array.from(emailMap.values());
    
    // Sort by date, newest first
    mergedEmails.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    // Store in database
    await setCacheValue("emails", mergedEmails);
    await setCacheValue("emailsTimestamp", Date.now().toString());
    
    console.log(`Synced ${mergedEmails.length} emails with database`);
  } catch (error) {
    console.error("Error syncing emails with database:", error);
  }
}

export async function sendEmail({
  accessToken,
  to,
  subject,
  body,
  attachments = [],
}: {
  accessToken: string;
  to: string;
  subject: string;
  body: string;
  attachments?: File[];
}): Promise<Email> {
  try {
    // Create a proper MIME message
    const message = new FormData();

    // Create metadata part
    const metadata = {
      to: to,
      subject: subject,
    };

    // Define a type for message parts
    type MessagePart = {
      mimeType: string;
      body: string;
      filename?: string;
      headers?: Record<string, string>;
    };

    // Create message parts array
    const parts: MessagePart[] = [
      {
        mimeType: "text/html",
        body: body,
      },
    ];

    // Add attachments to parts
    for (const file of attachments) {
      // Convert file to base64
      const fileArrayBuffer = await file.arrayBuffer();
      const fileBase64 = btoa(
        new Uint8Array(fileArrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );

      parts.push({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        body: fileBase64,
        headers: {
          "Content-Disposition": `attachment; filename="${file.name}"`,
          "Content-Transfer-Encoding": "base64",
        },
      });
    }

    // Create the request body
    const requestBody = {
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
  const headers = message.payload.headers;

  const getHeader = (name: string) => {
    const header = headers.find(
      (h: any) => h.name.toLowerCase() === name.toLowerCase()
    );
    return header ? header.value : "";
  };

  const from = parseEmailAddress(getHeader("From"));

  const toAddresses = getHeader("To");
  const to = toAddresses
    ? toAddresses
        .split(",")
        .map((addr: string) => parseEmailAddress(addr.trim()))
    : [];

  const subject = getHeader("Subject");
  const date = getHeader("Date");

  // Extract body content and attachments
  let body = "";
  let htmlBody = "";
  const attachments: {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    url: string;
  }[] = [];

  const processPart = (part: any) => {
    if (part.mimeType === "text/plain" && part.body.data) {
      body = decodeBase64(part.body.data);
    } else if (part.mimeType === "text/html" && part.body.data) {
      htmlBody = decodeBase64(part.body.data);
    } else if (part.filename && part.body.attachmentId) {
      attachments.push({
        id: part.body.attachmentId,
        name: part.filename,
        mimeType: part.mimeType,
        size: parseInt(part.body.size) || 0,
        url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}/attachments/${part.body.attachmentId}`,
      });
    }

    // Recursively process nested parts
    if (part.parts) {
      part.parts.forEach(processPart);
    }
  };

  if (message.payload.parts) {
    message.payload.parts.forEach(processPart);
  } else if (message.payload.body) {
    if (message.payload.mimeType === "text/html") {
      htmlBody = decodeBase64(message.payload.body.data || "");
    } else {
      body = decodeBase64(message.payload.body.data || "");
    }
  }

  // Prefer HTML content if available
  const finalBody = htmlBody || body;

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
    attachments: attachments.length > 0 ? attachments : undefined,
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
