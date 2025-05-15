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
