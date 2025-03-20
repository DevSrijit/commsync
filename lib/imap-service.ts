import Imap from "imap";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";

export interface ImapAccount {
  id?: string;
  label?: string; // Added to match UI form
  name?: string; // Keep for backward compatibility
  host: string;
  port: number;
  user?: string; // For backward compatibility
  username?: string; // Added to match UI form
  password: string;
  secure: boolean;
  lastSync?: Date;
}

interface FetchOptions {
  page?: number;
  pageSize?: number;
  lastMessageId?: string | null;
  filter?: {
    since?: Date;
    before?: Date;
    from?: string;
    to?: string;
    subject?: string;
    seen?: boolean;
    flagged?: boolean;
    threadId?: string;
    messageId?: string;
  };
  includeBody?: boolean;
}
export interface ImapFetchResult {
  messages: any[];
  total: number;
}

/**
 * Test connection to IMAP server
 */
export async function testImapConnection(
  account: ImapAccount
): Promise<boolean> {
  return new Promise((resolve) => {
    // Handle either username or user field
    const username = account.username || account.user || "";

    const imap = new Imap({
      user: username,
      password: account.password,
      host: account.host,
      port: account.port,
      tls: account.secure,
      tlsOptions: {
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined, // disable hostname verification
      },
      authTimeout: 10000, // Increase timeout
    });

    imap.once("ready", () => {
      imap.end();
      resolve(true);
    });

    imap.once("error", (err: Error) => {
      console.error("IMAP connection error:", err);
      imap.end(); // ensure the connection is closed on error
      resolve(false);
    });

    imap.connect();
  });
}

/**
 * Fetch emails from IMAP server with filtering and pagination
 */
export async function fetchImapEmails(
  account: ImapAccount,
  options: FetchOptions = {}
): Promise<ImapFetchResult> {
  const { page = 1, pageSize = 20, filter = {}, lastMessageId = null } = options;
  // Handle either username or user field
  const username = account.username || account.user || "";

  return new Promise<ImapFetchResult>((resolve, reject) => {
    const imap = new Imap({
      user: username,
      password: account.password,
      host: account.host,
      port: account.port,
      tls: account.secure,
      tlsOptions: {
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined, // disable hostname verification
      },
    });

    function handleError(err: Error) {
      console.error("Error in fetchImapEmails:", err);
      imap.end();
      reject(err);
    }

    imap.once("ready", async () => {
      try {
        // Open inbox
        await new Promise<void>((resolveOpen, rejectOpen) => {
          imap.openBox("INBOX", false, (err, box) => {
            if (err) rejectOpen(err);
            else resolveOpen();
          });
        });

        // Build search criteria
        const criteria: any[] = [];

        // Add filter criteria
        if (filter.from) criteria.push(["FROM", filter.from]);
        if (filter.to) criteria.push(["TO", filter.to]);
        if (filter.subject) criteria.push(["SUBJECT", filter.subject]);
        if (filter.seen !== undefined) {
          criteria.push(filter.seen ? "SEEN" : "UNSEEN");
        }
        if (filter.flagged !== undefined) {
          criteria.push(filter.flagged ? "FLAGGED" : "UNFLAGGED");
        }
        
        // Modified date filtering for improved pagination
        if (filter.since) {
          // Format date for IMAP search
          const sinceDate = new Date(filter.since);
          const sinceDateStr = sinceDate.toISOString().split('T')[0];
          criteria.push(["SINCE", sinceDateStr]);
        }
        
        if (filter.before) {
          // Format date for IMAP search - this helps with pagination
          const beforeDate = new Date(filter.before);
          const beforeDateStr = beforeDate.toISOString().split('T')[0];
          criteria.push(["BEFORE", beforeDateStr]);
          
          // Log the date filter
          console.log(`Filtering IMAP messages before: ${beforeDateStr}`);
        }

        // For cursor-based pagination, if we have a lastMessageId, adjust the search
        // This simulates "older than" logic for IMAP which doesn't have direct cursor support
        if (lastMessageId) {
          // Note: This assumes messageId is a UID, which might not be correct for all IMAP implementations
          // A more robust approach would be to store and use sequence numbers instead
          try {
            // Try to convert lastMessageId to a number (UID)
            const lastUID = parseInt(lastMessageId, 10);
            if (!isNaN(lastUID)) {
              // Use UID SEARCH criteria to find messages with UID less than lastUID
              criteria.push(["UID", "1:" + (lastUID - 1).toString()]);
            }
          } catch (e) {
            console.warn("Failed to parse lastMessageId as UID:", e);
          }
        }

        // Search for messages
        const searchCriteria = criteria.length > 0 ? criteria : ["ALL"];
        
        console.log(`IMAP search criteria:`, JSON.stringify(searchCriteria));
        
        const uids = await new Promise<number[]>((resolveSearch, rejectSearch) => {
          imap.search(searchCriteria, (err, results) => {
            if (err) rejectSearch(err);
            else resolveSearch(results);
          });
        });

        const total = uids.length;
        console.log(`IMAP search found ${total} messages matching criteria`);
        
        // Sort UIDs in descending order (newest first)
        uids.sort((a, b) => b - a);
        
        // Apply pagination
        const start = (page - 1) * pageSize;
        const paginatedUids = uids.slice(start, start + pageSize);
        
        console.log(`IMAP pagination: page ${page}, returned ${paginatedUids.length} messages`);
        
        if (paginatedUids.length === 0) {
          imap.end();
          resolve({ messages: [], total });
          return;
        }

        // Fetch message details
        const messages: any[] = [];

        const fetch = imap.fetch(paginatedUids, {
          bodies: "",
          struct: true,
        });

        const messagePromises: Promise<any>[] = [];

        fetch.on("message", (msg, seqno) => {
          let buffer = "";
          let attributes: any = null;

          msg.on("body", (stream, info) => {
            stream.on("data", (chunk: Buffer) => {
              buffer += chunk.toString("utf8");
            });
          });

          msg.once("attributes", (attrs) => {
            attributes = attrs;
          });

          const msgPromise = new Promise((resolveMsg) => {
            msg.once("end", () => {
              simpleParser(buffer).then((parsed) => {
                // Transform from field
                const from = parsed.from
                  ? {
                      name: parsed.from.value[0]?.name || "",
                      email: parsed.from.value[0]?.address || "",
                    }
                  : { name: "", email: "" };

                // Transform to field
                const to = parsed.to
                  ? parsed.to.value.map(
                      (recipient: { name?: string; address?: string }) => ({
                        name: recipient.name || "",
                        email: recipient.address || "",
                      })
                    )
                  : [];

                // Format the body - prefer HTML content, fallback to text with <br> for newlines
                let bodyContent = "";
                if (parsed.html) {
                  bodyContent = parsed.html;
                } else if (parsed.text) {
                  bodyContent = parsed.text.replace(/\n/g, "<br>");
                }

                resolveMsg({
                  id: seqno.toString(),
                  threadId: attributes.uid?.toString() || seqno.toString(),
                  from,
                  to,
                  subject: parsed.subject || "(No Subject)",
                  body: bodyContent,
                  attachments: parsed.attachments,
                  date: parsed.date
                    ? parsed.date.toISOString()
                    : new Date().toISOString(),
                  labels: attributes.flags
                    ? attributes.flags.map((flag: string) =>
                        flag.replace(/\\/g, "")
                      )
                    : [],
                });
              });
            });
          });

          messagePromises.push(msgPromise);
        });

        fetch.once("error", (err: Error) => {
          imap.end();
          return reject(err);
        });

        fetch.once("end", async () => {
          try {
            const messages = await Promise.all(messagePromises);
            imap.end();
            resolve({ messages, total });
          } catch (err) {
            imap.end();
            reject(err);
          }
        });
      } catch (err) {
        handleError(err as Error);
      }
    });

    imap.once("error", (err: Error) => {
      imap.end();
      reject(err);
    });

    imap.connect();
  });
}

/**
 * Send email using SMTP
 */
export async function sendImapEmail({
  account,
  to,
  subject,
  body,
  html,
  attachments,
  cc,
  bcc,
}: {
  account: ImapAccount;
  to: string | string[];
  subject: string;
  body?: string;
  html?: string;
  attachments?: any[];
  cc?: string | string[];
  bcc?: string | string[];
}) {
  // Handle either username or user field
  const username = account.username || account.user || "";

  const transporter = nodemailer.createTransport({
    host: account.host,
    port: account.port,
    secure: account.secure,
    auth: {
      user: username,
      pass: account.password,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const mailOptions = {
    from: username,
    to,
    cc,
    bcc,
    subject,
    text: body,
    html,
    attachments,
  };

  // Await the sendMail call to ensure the email is sent before returning.
  return await transporter.sendMail(mailOptions);
}

/**
 * Delete emails from IMAP server
 */
export async function deleteImapEmails(
  account: ImapAccount,
  messageIds: number[]
): Promise<boolean> {
  // Handle either username or user field
  const username = account.username || account.user || "";

  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: username,
      password: account.password,
      host: account.host,
      port: account.port,
      tls: account.secure,
      tlsOptions: { rejectUnauthorized: false },
    });

    imap.once("ready", () => {
      imap.openBox("INBOX", false, (err) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        imap.setFlags(messageIds, "\\Deleted", (err) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          imap.expunge((err) => {
            if (err) {
              imap.end();
              return reject(err);
            }

            imap.end();
            resolve(true);
          });
        });
      });
    });

    imap.once("error", (err: Error) => {
      imap.end();
      reject(err);
    });

    imap.connect();
  });
}

/**
 * Mark messages as read/unread or flagged/unflagged
 */
export async function markImapMessages(
  account: ImapAccount,
  messageIds: number[],
  markAs: {
    read?: boolean;
    flagged?: boolean;
  }
): Promise<boolean> {
  // Handle either username or user field
  const username = account.username || account.user || "";

  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: username,
      password: account.password,
      host: account.host,
      port: account.port,
      tls: account.secure,
      tlsOptions: { rejectUnauthorized: false },
    });

    imap.once("ready", () => {
      imap.openBox("INBOX", false, (err) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        let flags: string[] = [];
        if (markAs.read !== undefined) {
          flags.push(markAs.read ? "\\Seen" : "-\\Seen");
        }
        if (markAs.flagged !== undefined) {
          flags.push(markAs.flagged ? "\\Flagged" : "-\\Flagged");
        }

        if (flags.length === 0) {
          imap.end();
          return resolve(true);
        }

        imap.setFlags(messageIds, flags, (err) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          imap.end();
          resolve(true);
        });
      });
    });

    imap.once("error", (err: Error) => {
      imap.end();
      reject(err);
    });

    imap.connect();
  });
}
