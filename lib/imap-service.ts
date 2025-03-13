import Imap from "imap";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";

export interface ImapAccount {
  id?: string;
  label?: string;  // Added to match UI form
  name?: string;   // Keep for backward compatibility
  host: string;
  port: number;
  user?: string;   // For backward compatibility
  username?: string;  // Added to match UI form
  password: string;
  secure: boolean;
  lastSync?: Date;
}

interface FetchOptions {
  page?: number;
  pageSize?: number;
  filter?: {
    since?: Date;
    before?: Date;
    from?: string;
    to?: string;
    subject?: string;
    seen?: boolean;
    flagged?: boolean;
  };
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
    const username = account.username || account.user || '';
    
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
  const { page = 1, pageSize = 20, filter = {} } = options;
  // Handle either username or user field
  const username = account.username || account.user || '';

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

    imap.once("ready", () => {
      imap.openBox("INBOX", true, (err, box) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        // Build search criteria based on provided filters
        const searchCriteria: any[] = [];
        if (filter.since) searchCriteria.push(["SINCE", filter.since]);
        if (filter.before) searchCriteria.push(["BEFORE", filter.before]);
        if (filter.from) searchCriteria.push(["FROM", filter.from]);
        if (filter.to) searchCriteria.push(["TO", filter.to]);
        if (filter.subject) searchCriteria.push(["SUBJECT", filter.subject]);
        if (filter.seen !== undefined) {
          searchCriteria.push(filter.seen ? "SEEN" : "UNSEEN");
        }
        if (filter.flagged !== undefined) {
          searchCriteria.push(filter.flagged ? "FLAGGED" : "UNFLAGGED");
        }
        const criteria = searchCriteria.length > 0 ? searchCriteria : ["ALL"];

        imap.search(criteria, (err, results) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          if (!results || results.length === 0) {
            imap.end();
            return resolve({ messages: [], total: 0 });
          }

          // Pagination: results are in ascending order (oldest first)
          // Slice from the end to get the most recent messages.
          const startIndex = Math.max(0, results.length - page * pageSize);
          const endIndex = results.length - (page - 1) * pageSize;
          const paginatedResults = results.slice(startIndex, endIndex);

          if (paginatedResults.length === 0) {
            imap.end();
            return resolve({ messages: [], total: results.length });
          }

          // Fetch the entire raw message so we can parse it with simpleParser.
          const fetch = imap.fetch(paginatedResults, {
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
                simpleParser(buffer)
                  .then((parsed) => {
                    resolveMsg({
                      id: seqno,
                      header: parsed.headers,
                      body: parsed.text,
                      html: parsed.html,
                      attachments: parsed.attachments,
                      attributes,
                    });
                  })
                  .catch((err) => {
                    console.error("Parsing error:", err);
                    resolveMsg({ id: seqno, error: err, attributes });
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
              resolve({ messages, total: results.length });
            } catch (err) {
              imap.end();
              reject(err);
            }
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
  const username = account.username || account.user || '';

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
  const username = account.username || account.user || '';

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
  const username = account.username || account.user || '';

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