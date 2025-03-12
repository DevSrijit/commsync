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
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { action, account, data } = await req.json();

    // Securely store the account information
    if (action === "saveAccount") {
      // Encrypt sensitive information
      const encrypted = encryptData(JSON.stringify(account));

      // Save to database
      const savedAccount = await prisma.ImapAccount.upsert({
        where: {
          id: account.id || "new",
          userId: session.user.id,
        },
        update: {
          name: account.name,
          credentials: encrypted,
          lastSync: new Date(),
        },
        create: {
          name: account.name,
          credentials: encrypted,
          userId: session.user.id,
          lastSync: new Date(),
        },
      });

      return NextResponse.json({ success: true, id: savedAccount.id });
    }

    // Test connection
    if (action === "testConnection") {
      const success = await testImapConnection(account);
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

    // Mark emails as read/unread
    if (action === "markMessages") {
      const { messageIds, markAs } = data;
      await markImapMessages(account, messageIds, markAs);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("IMAP API error:", error);
    return NextResponse.json(
      {
        error: "Server error",
        message: error.message || "Unknown error occurred",
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
    const url = new URL(req.url);
    const accountId = url.searchParams.get("accountId");

    if (accountId) {
      // Fetch specific account
      const account = await prisma.ImapAccount.findUnique({
        where: {
          id: accountId,
          userId: session.user.id,
        },
      });

      if (!account) {
        return NextResponse.json(
          { error: "Account not found" },
          { status: 404 }
        );
      }

      const decrypted = JSON.parse(decryptData(account.credentials));
      return NextResponse.json({
        id: account.id,
        name: account.name,
        host: decrypted.host,
        port: decrypted.port,
        user: decrypted.user,
        // Not returning password for security
        secure: decrypted.secure,
        lastSync: account.lastSync,
      });
    } else {
      // Fetch all accounts for user
      const accounts = await prisma.ImapAccount.findMany({
        where: {
          userId: session.user.id,
        },
        select: {
          id: true,
          name: true,
          lastSync: true,
        },
      });

      return NextResponse.json({ accounts });
    }
  } catch (error: any) {
    console.error("IMAP API error:", error);
    return NextResponse.json(
      {
        error: "Server error",
        message: error.message || "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
