import { NextRequest, NextResponse } from "next/server";
import {
  fetchImapEmails,
  sendImapEmail,
  testImapConnection,
  deleteImapEmails,
  markImapMessages,
  ImapAccount,
  ImapFetchResult,
} from "@/lib/imap-service";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { encryptData, decryptData } from "@/lib/encryption";
import { db } from "@/lib/db";

async function getUserIdFromSession(session: any) {
  if (!session?.user?.email) {
    throw new Error("No user email found in session");
  }

  const user = await db.user.findUnique({
    where: {
      email: session.user.email,
    },
  });

  if (!user) {
    throw new Error("User not found in database");
  }

  return user.id;
}

// Transform IMAP email format to a standardized format for the conversation view
function standardizeEmailFormat(
  email: any,
  accountType = "imap",
  accountId: string
) {
  // Ensure date is in ISO format
  const date = email.date
    ? new Date(email.date).toISOString()
    : new Date().toISOString();

  // Ensure labels array exists and has at least INBOX if empty
  const labels =
    Array.isArray(email.labels) && email.labels.length > 0
      ? email.labels
      : ["INBOX"];

  // Ensure from and to objects have the correct structure
  const from = {
    name: email.from?.name || "",
    email: email.from?.email || "",
  };

  const to = Array.isArray(email.to)
    ? email.to.map((recipient: any) => ({
        name: recipient?.name || "",
        email: recipient?.email || "",
      }))
    : [{ name: "", email: email.to || "" }];

  // Ensure body has HTML content
  const body = email.html || email.body || email.textBody || "";

  return {
    id: email.id || email.messageId,
    threadId: email.threadId || email.id || email.messageId,
    from,
    to,
    subject: email.subject || "(No Subject)",
    body,
    htmlBody: email.html || email.htmlBody || body,
    date,
    attachments: Array.isArray(email.attachments) ? email.attachments : [],
    labels,
    read: email.read || false,
    flagged: email.flagged || false,
    accountType,
    accountId, // Add the accountId to the email object
  };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { action, account, data } = await req.json();
    const userId = await getUserIdFromSession(session);

    // Save account information securely
    if (action === "saveAccount") {
      try {
        const processedAccount = {
          label: account.label,
          host: account.host,
          port: account.port,
          user: account.username,
          password: account.password,
          secure: account.secure,
          // Store SMTP configuration
          smtpHost: account.smtpHost || account.host,
          smtpPort: account.smtpPort || (account.secure ? 465 : 587),
          smtpSecure: account.smtpSecure !== undefined ? account.smtpSecure : account.secure
        };

        const accountJson = JSON.stringify(processedAccount);
        const encrypted = encryptData(accountJson);

        const savedAccount = await db.imapAccount.create({
          data: {
            label: processedAccount.label,
            credentials: encrypted,
            lastSync: new Date(),
            user: {
              connect: {
                id: userId,
              },
            },
          },
        });

        return NextResponse.json({ success: true, id: savedAccount.id });
      } catch (error: any) {
        console.error("Error in saveAccount:", {
          message: error.message,
          name: error.name,
          code: error.code,
          meta: error.meta,
          stack: error.stack,
        });

        return NextResponse.json(
          {
            error: "Failed to save account",
            message: error.message,
            code: error.code,
          },
          { status: 500 }
        );
      }
    }

    // Test connection
    if (action === "testConnection") {
      const testAccount: ImapAccount = {
        host: account.host,
        port: account.port,
        user: account.username,
        password: account.password,
        secure: account.secure,
      };

      const success = await testImapConnection(testAccount);
      return NextResponse.json({ success });
    }

    // Fetch emails
    if (action === "fetchEmails") {
      const { page = 1, pageSize = 10000, filter = {} } = data || {};
      const emails: ImapFetchResult = await fetchImapEmails(account, {
        page,
        pageSize,
        filter,
      });

      // Standardize the email format with account ID
      const standardizedEmails = emails.messages.map((email) =>
        standardizeEmailFormat(email, "imap", account.id)
      );

      return NextResponse.json({
        emails: standardizedEmails,
        total: emails.total,
        page,
        pageSize,
      });
    }

    // Send email
    if (action === "sendEmail") {
      // Check if accountId was provided instead of full account object
      let imap_account = account;
      if (!imap_account && data.accountId) {
        // Fetch the account by ID
        imap_account = await db.imapAccount.findFirst({
          where: {
            id: data.accountId,
            userId: session.user.id
          }
        });

        if (!imap_account) {
          return NextResponse.json({ error: "IMAP account not found" }, { status: 404 });
        }
      }

      // Ensure we have a valid account
      if (!imap_account) {
        return NextResponse.json({ error: "Missing IMAP account" }, { status: 400 });
      }

      const { to, subject, body, html, attachments, cc, bcc } = data;
      
      try {
        // Decrypt the credentials from the database
        const decryptedCreds = decryptData(imap_account.credentials);
        const credsObject = JSON.parse(decryptedCreds);
        
        // Create ImapAccount object with decrypted credentials and including SMTP details
        const imapAccount: ImapAccount = {
          ...imap_account,
          host: credsObject.host || imap_account.host,
          port: credsObject.port || imap_account.port,
          password: credsObject.password,
          secure: credsObject.secure !== undefined ? credsObject.secure : (imap_account.port === 465 || imap_account.port === 993),
          username: credsObject.user || credsObject.username,
          // Include SMTP configuration if available
          smtpHost: credsObject.smtpHost,
          smtpPort: credsObject.smtpPort,
          smtpSecure: credsObject.smtpSecure
        };
        
        console.log(`Using email configuration: IMAP host=${imapAccount.host}:${imapAccount.port}, SMTP host=${imapAccount.smtpHost || imapAccount.host}:${imapAccount.smtpPort || "default"}`);
      
        const email = await sendImapEmail({
          account: imapAccount,
          to,
          subject,
          body,
          html,
          attachments,
          cc,
          bcc,
        });

        // Standardize the sent email format
        const standardizedEmail = standardizeEmailFormat(
          {
            id: email.messageId || `sent-${Date.now()}`,
            threadId: email.messageId || `sent-${Date.now()}`,
            from: { 
              name: imap_account.label || imap_account.username || "", 
              email: imap_account.username || "" 
            },
            to: Array.isArray(to) 
              ? to.map((recipient: string) => ({ 
                  name: recipient.split('@')[0] || recipient, 
                  email: recipient 
                }))
              : [{ 
                  name: to.split('@')[0] || to, 
                  email: to 
                }],
            subject: subject || "(No Subject)",
            body: html || body || "",
            date: new Date().toISOString(),
            labels: ["sent"],
            attachments: attachments || []
          },
          "imap",
          imap_account.id
        );
        
        return NextResponse.json({ success: true, email: standardizedEmail });
      } catch (error: any) {
        console.error("Error in sendEmail:", {
          message: error.message,
          name: error.name,
          code: error.code,
          meta: error.meta,
          stack: error.stack,
        });

        return NextResponse.json(
          {
            error: "Failed to send email",
            message: error.message,
            code: error.code,
          },
          { status: 500 }
        );
      }
    }

    // Delete emails
    if (action === "deleteEmails") {
      const { messageIds } = data;
      await deleteImapEmails(account, messageIds);
      return NextResponse.json({ success: true });
    }

    // Mark messages
    if (action === "markMessages") {
      const { messageIds, markAs } = data;
      await markImapMessages(account, messageIds, markAs);
      return NextResponse.json({ success: true });
    }

    // Delete account
    if (action === "deleteAccount") {
      const { accountId } = data;

      // Check if accountId is a valid MongoDB ObjectId (no hyphens)
      if (accountId && accountId.includes("-")) {
        return NextResponse.json({
          success: true,
          message: "Account removed from local state only",
        });
      }

      try {
        const account = await db.imapAccount.findFirst({
          where: {
            id: accountId,
            userId: userId,
          },
        });

        if (!account) {
          return NextResponse.json(
            { error: "Account not found or unauthorized" },
            { status: 404 }
          );
        }

        await db.imapAccount.delete({
          where: { id: accountId },
        });

        return NextResponse.json({ success: true });
      } catch (error) {
        console.error("Error deleting IMAP account:", error);
        return NextResponse.json(
          { error: "Failed to delete account", details: error },
          { status: 500 }
        );
      }
    }

    // Update last sync
    if (action === "updateLastSync") {
      const { accountId } = data;

      // Check if accountId is a valid MongoDB ObjectId (no hyphens)
      if (accountId && accountId.includes("-")) {
        return NextResponse.json({
          success: true,
          message: "Account sync time updated in local state only",
        });
      }

      try {
        await db.imapAccount.update({
          where: { id: accountId },
          data: { lastSync: new Date() },
        });
        return NextResponse.json({ success: true });
      } catch (error) {
        console.error("Error updating IMAP account last sync:", error);
        return NextResponse.json({
          success: true,
          message: "Account sync time updated in local state only",
        });
      }
    }

    // Get conversation
    if (action === "getConversation") {
      const { messageId, threadId, contactEmail } = data || {};

      // Fetch all messages since we can't filter by threadId at the IMAP level
      const emails: ImapFetchResult = await fetchImapEmails(account, {
        includeBody: true,
      });

      // Filter messages in memory based on contact email and threadId/messageId
      let conversationEmails = emails.messages;
      
      // First filter by contact email if provided
      if (contactEmail) {
        conversationEmails = conversationEmails.filter(
          (email) => 
            email.from?.email === contactEmail || 
            (email.to && email.to.some((recipient: { email: string }) => recipient.email === contactEmail))
        );
      }
      
      // Then apply additional filters if provided
      if (threadId) {
        conversationEmails = conversationEmails.filter(
          (email) => email.threadId === threadId || email.id === threadId
        );
      } else if (messageId) {
        conversationEmails = conversationEmails.filter(
          (email) => email.id === messageId || email.messageId === messageId
        );
      }

      // Standardize the email format with account ID
      const standardizedEmails = conversationEmails.map((email) =>
        standardizeEmailFormat(email, "imap", account.id)
      );

      // Sort by date
      standardizedEmails.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      return NextResponse.json({
        messages: standardizedEmails,
        total: standardizedEmails.length,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("IMAP API error:", error?.message || "Unknown error", {
      name: error?.name,
      code: error?.code,
    });
    return NextResponse.json(
      {
        error: "Server error",
        message: error?.message || "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const userId = await getUserIdFromSession(session);
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const accountId = url.searchParams.get("accountId");

    // Handle getAccounts action
    if (action === "getAccounts") {
      const accounts = await db.imapAccount.findMany({
        where: {
          userId: userId,
        },
        select: {
          id: true,
          label: true,
          lastSync: true,
          credentials: true,
        },
      });

      // Decrypt credentials for each account
      const decryptedAccounts = accounts.map((account: ImapAccount) => {
        try {
          const decrypted = decryptData(account.credentials || "");
          const credentials = JSON.parse(decrypted);

          return {
            id: account.id,
            label: account.label,
            lastSync: account.lastSync,
            host: credentials.host,
            port: credentials.port,
            username: credentials.user,
            password: credentials.password,
            secure: credentials.secure,
          };
        } catch (error) {
          console.error("Error decrypting account credentials:", error);
          return {
            id: account.id,
            label: account.label,
            lastSync: account.lastSync,
            error: "Failed to decrypt credentials",
          };
        }
      });

      return NextResponse.json({ accounts: decryptedAccounts });
    }

    // Handle single account fetch
    if (accountId) {
      const account = await db.imapAccount.findUnique({
        where: {
          id: accountId,
          userId: userId,
        },
      });

      if (!account) {
        return NextResponse.json(
          { error: "Account not found or unauthorized" },
          { status: 404 }
        );
      }

      return NextResponse.json({ account });
    }

    // Default: return all accounts with minimal info
    const accounts = await db.imapAccount.findMany({
      where: {
        userId: userId,
      },
      select: {
        id: true,
        label: true,
        lastSync: true,
      },
    });

    return NextResponse.json({ accounts });
  } catch (error: any) {
    console.error("IMAP API error:", error?.message || "Unknown error", {
      name: error?.name,
      code: error?.code,
    });
    return NextResponse.json(
      {
        error: "Server error",
        message: error?.message || "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
