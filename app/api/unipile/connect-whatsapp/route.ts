import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUnipileService } from "@/lib/unipile-service";
import { db } from "@/lib/db";

export async function POST() {
  try {
    // Get the user's session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the Unipile service instance
    const unipileService = getUnipileService();

    // Initiate WhatsApp connection with user ID
    const { qrCodeString, account } = await unipileService.connectWhatsapp(
      session.user.id
    );

    // Associate the account with the user
    await db.unipileAccount.update({
      where: { id: account.id },
      data: {
        userId: session.user.id,
      },
    });

    console.log("QR Code String:", qrCodeString);
    console.log("QR Code Debug Info:");
    console.log("- Type:", typeof qrCodeString);
    console.log("- Length:", qrCodeString.length);
    console.log("- First 100 chars:", qrCodeString.slice(0, 100));
    console.log("- Includes block characters:", /[█▓▒░]/.test(qrCodeString));
    console.log("- Looks multiline:", qrCodeString.includes("\n"));

    return NextResponse.json({
      qrCodeString,
      accountId: account.id,
    });
  } catch (error) {
    console.error("Error connecting WhatsApp:", error);
    return NextResponse.json(
      { error: "Failed to connect WhatsApp" },
      { status: 500 }
    );
  }
}

// Endpoint to manually trigger syncing messages for an existing WhatsApp account
export async function GET(request: Request) {
  try {
    // Get the user's session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the account ID from the URL
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 }
      );
    }

    // Check that the account belongs to the user
    const account = await db.unipileAccount.findUnique({
      where: {
        id: accountId,
        userId: session.user.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found or not authorized" },
        { status: 404 }
      );
    }

    // Get the Unipile service instance
    const unipileService = getUnipileService();

    // Only sync if the account is connected and has an accountIdentifier
    if (account.status !== "connected" || !account.accountIdentifier) {
      return NextResponse.json(
        { error: "Account is not connected" },
        { status: 400 }
      );
    }

    // Start syncing messages
    await unipileService.syncUnipileMessages(
      accountId,
      account.accountIdentifier
    );

    return NextResponse.json({
      success: true,
      message: "Message sync initiated",
    });
  } catch (error) {
    console.error("Error syncing WhatsApp messages:", error);
    return NextResponse.json(
      { error: "Failed to sync WhatsApp messages" },
      { status: 500 }
    );
  }
}
