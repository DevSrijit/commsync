import type { Email } from "@/lib/types";

export async function fetchEmails(accessToken: string): Promise<Email[]> {
  try {
    // Fetch list of messages
    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch message list: ${response.statusText}`);
    }

    const data = await response.json();
    const messageIds = data.messages?.map((msg: any) => msg.id) || [];

    // Fetch full details for each message
    const emails = await Promise.allSettled(
      messageIds.map(async (id: string) => {
        try {
          const msgResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

          if (!msgResponse.ok) {
            throw new Error(
              `Failed to fetch message ${id}: ${msgResponse.statusText}`
            );
          }

          const msgData = await msgResponse.json();
          return parseGmailMessage(msgData);
        } catch (error) {
          console.warn(`Failed to fetch message ${id}:`, error);
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

    // Sync with local storage
    syncWithLocalStorage(fetchedEmails);

    return fetchedEmails;
  } catch (error) {
    console.error("Error fetching emails:", error);
    return [];
  }
}

// Add new sync function
function syncWithLocalStorage(gmailEmails: Email[]) {
  try {
    // Create a map of fetched emails for quick lookup
    const gmailEmailMap = new Map(gmailEmails.map(email => [email.id, email]));
    
    // Get current local storage
    const localStorageEmails = localStorage.getItem('emails');
    let currentEmails: Email[] = localStorageEmails ? JSON.parse(localStorageEmails) : [];
    
    // Filter out emails that no longer exist in Gmail
    currentEmails = currentEmails.filter(email => gmailEmailMap.has(email.id));
    
    // Update or add new emails from Gmail
    gmailEmails.forEach(gmailEmail => {
      const existingIndex = currentEmails.findIndex(e => e.id === gmailEmail.id);
      if (existingIndex !== -1) {
        // Update existing email if content is different
        if (JSON.stringify(currentEmails[existingIndex]) !== JSON.stringify(gmailEmail)) {
          currentEmails[existingIndex] = gmailEmail;
        }
      } else {
        // Add new email
        currentEmails.push(gmailEmail);
      }
    });
    
    // Sort by date (newest first)
    currentEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Update local storage
    localStorage.setItem('emails', JSON.stringify(currentEmails));
    
    // Update timestamp
    localStorage.setItem('emailsTimestamp', Date.now().toString());
    
    console.log(`Synced ${gmailEmails.length} emails with local storage`);
  } catch (error) {
    console.error('Error syncing with local storage:', error);
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
        body: body
      }
    ];
    
    // Add attachments to parts
    for (const file of attachments) {
      // Convert file to base64
      const fileArrayBuffer = await file.arrayBuffer();
      const fileBase64 = btoa(
        new Uint8Array(fileArrayBuffer)
          .reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      
      parts.push({
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        body: fileBase64,
        headers: {
          "Content-Disposition": `attachment; filename="${file.name}"`,
          "Content-Transfer-Encoding": "base64"
        }
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
        
        attachments.map(file => 
          `--boundary\r\n` +
          `Content-Type: ${file.type || 'application/octet-stream'}\r\n` +
          `Content-Disposition: attachment; filename="${file.name}"\r\n` +
          `Content-Transfer-Encoding: base64\r\n\r\n` +
          `[ATTACHMENT_DATA_${file.name}]\r\n\r\n`
        ).join('') +
        
        `--boundary--`
      ).replace(/[+]/g, '-').replace(/[/]/g, '_').replace(/=+$/, '')
    };
    
    // For each attachment, we need to replace the placeholder with actual base64 data
    for (const file of attachments) {
      const fileArrayBuffer = await file.arrayBuffer();
      const fileBase64 = btoa(
        new Uint8Array(fileArrayBuffer)
          .reduce((data, byte) => data + String.fromCharCode(byte), '')
      ).replace(/[+]/g, '-').replace(/[/]/g, '_').replace(/=+$/, '');
      
      requestBody.raw = requestBody.raw.replace(
        `[ATTACHMENT_DATA_${file.name}]`, 
        fileBase64
      );
    }

    const response = await fetch(
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
