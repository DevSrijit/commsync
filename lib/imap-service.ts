import type { Email } from "@/lib/types";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { simpleParser } from "mailparser";

export interface ImapAccount {
  id: string;
  label: string;
  host: string;
  port: number;
  username: string;
  password: string; // Note: In production, use secure storage
  secure: boolean;
}

interface Recipient {
  name?: string;
  address: string;
}

interface Attachment {
  contentId?: string;
  filename?: string;
  contentType?: string;
  size?: number;
  content?: Buffer;
}

export async function fetchImapEmails(account: ImapAccount): Promise<Email[]> {
  try {
    const client = new ImapFlow({
      host: account.host,
      port: account.port,
      secure: account.secure,
      auth: {
        user: account.username,
        pass: account.password,
      },
      logger: false,
    });

    await client.connect();

    // Select the inbox
    const mailbox = await client.mailboxOpen("INBOX");
    console.log(`Selected mailbox contains ${mailbox.exists} messages`);

    // Get the most recent 50 messages
    const messages = [];
    let fetchOptions = {
      source: `1:${Math.min(50, mailbox.exists)}`,
      envelope: true,
      bodyStructure: true,
      headers: true,
      bodyParts: ["text", "html"],
    };

    for await (let message of client.fetch(fetchOptions)) {
      try {
        const parsed = await simpleParser(
          message.bodyParts.get("text") || message.bodyParts.get("html") || ""
        );

        // Convert to compatible Email format
        messages.push({
          id: `imap-${account.id}-${message.uid}`,
          threadId: `imap-${account.id}-${message.uid}`,
          from: {
            name:
              parsed.from?.value[0]?.name ||
              parsed.from?.value[0]?.address ||
              "",
            email: parsed.from?.value[0]?.address || "",
          },
          to: (parsed.to?.value || []).map((recipient: Recipient) => ({
            name: recipient.name || recipient.address,
            email: recipient.address || "",
          })),
          subject: parsed.subject || "No Subject",
          body: parsed.html || parsed.textAsHtml || "",
          date: parsed.date?.toISOString() || new Date().toISOString(),
          labels: ["INBOX"],
          // Handle attachments if present
          attachments: parsed.attachments.map((attachment: Attachment) => ({
            id: attachment.contentId || `attachment-${Math.random()}`,
            name: attachment.filename || "unnamed-attachment",
            mimeType: attachment.contentType || "application/octet-stream",
            size: attachment.size || 0,
            content: attachment.content || null,
          })),
        });
      } catch (parseError) {
        console.error("Error parsing message:", parseError);
      }
    }

    await client.logout();
    return messages;
  } catch (error) {
    console.error("Error fetching IMAP emails:", error);
    throw error;
  }
}

export async function sendImapEmail({
  account,
  to,
  subject,
  body,
}: {
  account: ImapAccount;
  to: string;
  subject: string;
  body: string;
}): Promise<Email> {
  try {
    const transporter = nodemailer.createTransport({
      host: account.host,
      port: account.port,
      secure: account.secure,
      auth: {
        user: account.username,
        pass: account.password,
      },
    });

    const info = await transporter.sendMail({
      from: account.username,
      to,
      subject,
      html: body,
    });

    // Create a representation of the sent email
    const sentEmail: Email = {
      id: `imap-sent-${account.id}-${Date.now()}`,
      threadId: `imap-sent-${account.id}-${Date.now()}`,
      from: {
        name: account.label,
        email: account.username,
      },
      to: to.split(",").map((address) => ({
        name: address.trim(),
        email: address.trim(),
      })),
      subject,
      body,
      date: new Date().toISOString(),
      labels: ["SENT"],
    };

    return sentEmail;
  } catch (error) {
    console.error("Error sending IMAP email:", error);
    throw error;
  }
}

// Test IMAP connection
export async function testImapConnection(
  account: ImapAccount
): Promise<boolean> {
  const client = new ImapFlow({
    host: account.host,
    port: account.port,
    secure: account.secure,
    auth: {
      user: account.username,
      pass: account.password,
    },
    logger: false,
  });

  try {
    await client.connect();
    await client.logout();
    return true;
  } catch (error) {
    console.error("IMAP connection test failed:", error);
    return false;
  }
}
