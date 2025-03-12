import Imap from "imap";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import { promisify } from "util";

export interface ImapAccount {
  id?: string;
  name: string;
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean;
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
    const imap = new Imap({
      user: account.user,
      password: account.password,
      host: account.host,
      port: account.port,
      tls: account.secure,
      tlsOptions: { rejectUnauthorized: false },
    });

    imap.once("ready", () => {
      imap.end();
      resolve(true);
    });

    imap.once("error", (err: Error) => {
      console.error("IMAP connection error:", err);
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

  return new Promise<ImapFetchResult>((resolve, reject) => {
    const imap = new Imap({
      user: account.user,
      password: account.password,
      host: account.host,
      port: account.port,
      tls: account.secure,
      tlsOptions: { rejectUnauthorized: false },
    });

    const messages: any[] = [];
    let total = 0;

    imap.once("ready", () => {
      imap.openBox("INBOX", true, (err: Error | null, box: Imap.Box) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        total = box.messages.total;

        // Build search criteria from filters
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

        // Default search if no filters provided
        const criteria = searchCriteria.length > 0 ? searchCriteria : ["ALL"];

        // Calculate start and end for pagination
        const start = Math.max(1, total - page * pageSize + 1);
        const end = Math.max(1, total - (page - 1) * pageSize);

        imap.search(criteria, (err: Error | null, results: number[]) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          if (results.length === 0) {
            imap.end();
            return resolve({ messages: [], total });
          }

          // Paginate results
          const paginatedResults = results.slice(
            Math.max(0, results.length - end),
            Math.max(0, results.length - start + 1)
          );

          if (paginatedResults.length === 0) {
            imap.end();
            return resolve({ messages: [], total: results.length });
          }

          const fetch = imap.fetch(paginatedResults, {
            bodies: ["HEADER.FIELDS (FROM TO SUBJECT DATE)", "TEXT"],
            struct: true,
          });

          fetch.on("message", (msg: Imap.ImapMessage, seqno: number) => {
            const message: any = { id: seqno };

            msg.on(
              "body",
              (
                stream: NodeJS.ReadableStream,
                info: Imap.ImapMessageBodyInfo
              ) => {
                let buffer = "";

                stream.on("data", (chunk: Buffer) => {
                  buffer += chunk.toString("utf8");
                });

                stream.once("end", () => {
                  if (info.which === "TEXT") {
                    message.body = buffer;
                  } else {
                    message.header = Imap.parseHeader(buffer);
                  }
                });
              }
            );

            msg.once("attributes", (attrs: Imap.ImapMessageAttributes) => {
              message.attributes = attrs;
            });

            msg.once("end", () => {
              messages.push(message);
            });
          });

          fetch.once("error", (err: Error) => {
            reject(err);
          });

          fetch.once("end", () => {
            imap.end();
            resolve({ messages, total: results.length });
          });
        });
      });
    });

    imap.once("error", (err: Error) => {
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
  const transporter = nodemailer.createTransport({
    host: account.host,
    port: account.port,
    secure: account.secure,
    auth: {
      user: account.user,
      pass: account.password,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const mailOptions = {
    from: account.user,
    to,
    cc,
    bcc,
    subject,
    text: body,
    html,
    attachments,
  };

  return transporter.sendMail(mailOptions);
}

/**
 * Delete emails from IMAP server
 */
export async function deleteImapEmails(
  account: ImapAccount,
  messageIds: number[]
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: account.user,
      password: account.password,
      host: account.host,
      port: account.port,
      tls: account.secure,
      tlsOptions: { rejectUnauthorized: false },
    });

    imap.once("ready", () => {
      imap.openBox("INBOX", false, (err: Error | null) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        imap.setFlags(messageIds, "\\Deleted", (err: Error | null) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          imap.expunge((err: Error | null) => {
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
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: account.user,
      password: account.password,
      host: account.host,
      port: account.port,
      tls: account.secure,
      tlsOptions: { rejectUnauthorized: false },
    });

    imap.once("ready", () => {
      imap.openBox("INBOX", false, (err: Error | null) => {
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

        imap.setFlags(messageIds, flags, (err: Error | null) => {
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
      reject(err);
    });

    imap.connect();
  });
}
