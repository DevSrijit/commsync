import { NextRequest, NextResponse } from "next/server";
import {
  fetchImapEmails,
  sendImapEmail,
  testImapConnection,
  ImapAccount,
} from "@/lib/imap-service";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { encryptData, decryptData } from "@/lib/encryption"; // You'll need to implement this

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
      const encrypted = encryptData(account);
      return NextResponse.json({ success: true, id: "new-account-id" });
    }

    // Test connection
    if (action === "testConnection") {
      const success = await testImapConnection(account);
      return NextResponse.json({ success });
    }

    // Fetch emails
    if (action === "fetchEmails") {
      const emails = await fetchImapEmails(account);
      return NextResponse.json({ emails });
    }

    // Send email
    if (action === "sendEmail") {
      const { to, subject, body } = data;
      const email = await sendImapEmail({
        account,
        to,
        subject,
        body,
      });
      return NextResponse.json({ email });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("IMAP API error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
