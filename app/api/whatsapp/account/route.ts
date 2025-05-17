import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UnipileService } from "@/lib/unipile-service";

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

// Reconnect an existing WhatsApp account (after device logout)
export async function PATCH(req: NextRequest) {
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

  const { accountId } = body;
  if (!accountId) {
    return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
  }

  try {
    // Verify account belongs to user
    const account = await db.syncAccount.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
        platform: "whatsapp",
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found or unauthorized" },
        { status: 404 }
      );
    }

    // Initialize UnipileService
    const baseUrl = process.env.UNIPILE_BASE_URL;
    const accessToken = process.env.UNIPILE_ACCESS_TOKEN;
    if (!baseUrl || !accessToken) {
      return NextResponse.json(
        { error: "Missing UNIPILE_BASE_URL or UNIPILE_ACCESS_TOKEN" },
        { status: 500 }
      );
    }

    const service = new UnipileService({ baseUrl, accessToken });

    // Use the Unipile account ID stored in accountIdentifier to reconnect
    const unipileAccountId = account.accountIdentifier;
    if (!unipileAccountId) {
      return NextResponse.json(
        { error: "Account missing Unipile identifier" },
        { status: 400 }
      );
    }

    // Attempt to reconnect using Unipile account ID
    const {
      qrCodeString,
      code,
      accountId: newAccountId,
    } = await service.reconnectWhatsapp(unipileAccountId);

    // Update account credentials and accountIdentifier if needed
    await db.syncAccount.update({
      where: { id: accountId },
      data: {
        credentials: JSON.stringify({ code, accountId: newAccountId }),
        accountIdentifier: newAccountId, // Update if the account ID changed
        lastSync: new Date(),
      },
    });

    return NextResponse.json({
      qrCodeString,
      code,
      accountId: newAccountId,
    });
  } catch (error) {
    console.error("Failed to reconnect WhatsApp account:", error);
    return NextResponse.json(
      { error: "Failed to reconnect account", details: String(error) },
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
