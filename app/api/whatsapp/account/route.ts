import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UnipileClient } from "unipile-node-sdk";

export async function GET() {
  try {
    const accounts = await db.syncAccount.findMany({
      where: { platform: "whatsapp" },
      orderBy: { createdAt: "desc" },
    });

    // Return the accounts without trying to fetch additional details
    // since the SDK method for retrieving account details isn't available
    return NextResponse.json(accounts);
  } catch (error) {
    console.error("Failed to fetch WhatsApp accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch WhatsApp accounts" },
      { status: 500 }
    );
  }
}

// Link a new WhatsApp account by saving the connect code
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  // Expect both the QR code checkpoint and the Unipile account ID
  const { code, accountId } = body;
  if (!code || !accountId) {
    return NextResponse.json(
      { error: "Missing code or accountId" },
      { status: 400 }
    );
  }
  try {
    const account = await db.syncAccount.create({
      data: {
        userId: session.user.id,
        platform: "whatsapp",
        // Store the checkpoint code and the Unipile account ID
        credentials: JSON.stringify({ code, accountId }),
        accountIdentifier: accountId,
      },
    });
    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    console.error("Failed to create WhatsApp account:", error);
    return NextResponse.json(
      { error: "Failed to link account" },
      { status: 500 }
    );
  }
}

// Unlink an existing WhatsApp account
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  try {
    await db.syncAccount.delete({ where: { id } });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to delete WhatsApp account:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
