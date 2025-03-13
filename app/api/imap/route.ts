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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  console.log("Session:", session);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { action, account, data } = await req.json();
    console.log("Action:", action);
    console.log("Account:", account);
    console.log("Data:", data);

    // Get the user ID from the session
    const userId = await getUserIdFromSession(session);

    // Save account information securely.
    if (action === "saveAccount") {
      try {
        // Convert account fields to match database schema
        const processedAccount = {
          label: account.label,
          host: account.host,
          port: account.port,
          user: account.username,
          password: account.password,
          secure: account.secure,
        };

        // First stringify the account data
        const accountJson = JSON.stringify(processedAccount);

        // Then encrypt it
        const encrypted = encryptData(accountJson);

        // Create the account with minimal data first
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
        // Log the full error details
        console.error("Error in saveAccount:", {
          message: error.message,
          name: error.name,
          code: error.code,
          meta: error.meta,
          stack: error.stack,
        });

        // Return a more detailed error response
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

    // Test connection using the provided account credentials.
    if (action === "testConnection") {
      // Handle field mapping between UI and service
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

    // Fetch emails with filtering and pagination
    if (action === "fetchEmails") {
      const { page = 1, pageSize = 20, filter = {} } = data || {};
      const emails: ImapFetchResult = await fetchImapEmails(account, {
        page,
        pageSize,
        filter,
      });

      return NextResponse.json({
        emails: emails.messages,
        total: emails.total,
        page,
        pageSize,
      });
    }

    // Send email with support for HTML and attachments
    if (action === "sendEmail") {
      const { to, subject, body, html, attachments, cc, bcc } = data;
      const email = await sendImapEmail({
        account,
        to,
        subject,
        body,
        html,
        attachments,
        cc,
        bcc,
      });

      return NextResponse.json({ success: true, email });
    }

    // Delete emails
    if (action === "deleteEmails") {
      const { messageIds } = data;
      await deleteImapEmails(account, messageIds);
      return NextResponse.json({ success: true });
    }

    // Mark emails as read/unread or flagged/unflagged
    if (action === "markMessages") {
      const { messageIds, markAs } = data;
      await markImapMessages(account, messageIds, markAs);
      return NextResponse.json({ success: true });
    }

    // Add to the existing POST handler:
    if (action === "deleteAccount") {
      const { accountId } = data;
      await db.imapAccount.delete({
        where: { id: accountId },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "updateLastSync") {
      const { accountId } = data;
      await db.imapAccount.update({
        where: { id: accountId },
        data: { lastSync: new Date() },
      });
      return NextResponse.json({ success: true });
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
    // Get the user ID from the session
    const userId = await getUserIdFromSession(session);

    const url = new URL(req.url);
    const accountId = url.searchParams.get("accountId");

    if (accountId) {
      // Fetch specific account
      let account;
      try {
        account = await db.imapAccount.findUnique({
          where: {
            id: accountId,
            userId: userId,
          },
        });
      } catch (dbError) {
        console.error(`Error fetching account ${accountId}:`, dbError);
        throw dbError;
      }

      if (!account) {
        return NextResponse.json(
          { error: "Account not found" },
          { status: 404 }
        );
      }

      // Make sure we're safely accessing properties
      if (!account.credentials) {
        return NextResponse.json(
          { error: "Account credentials not found" },
          { status: 500 }
        );
      }

      const decrypted = JSON.parse(decryptData(account.credentials));
      return NextResponse.json({
        id: account.id,
        label: account.label,
        host: decrypted.host,
        port: decrypted.port,
        username: decrypted.user,
        secure: decrypted.secure,
        lastSync: account.lastSync,
      });
    } else {
      // Fetch all accounts for user
      let accounts;
      try {
        accounts = await db.imapAccount.findMany({
          where: {
            userId: userId,
          },
          select: {
            id: true,
            label: true,
            lastSync: true,
          },
        });
      } catch (dbError) {
        console.error("Error fetching accounts:", dbError);
        throw dbError;
      }

      return NextResponse.json({ accounts });
    }
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
