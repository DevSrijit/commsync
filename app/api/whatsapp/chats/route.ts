import { NextRequest, NextResponse } from "next/server";
import { UnipileService } from "@/lib/unipile-service";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId");
  if (!accountId) {
    return NextResponse.json(
      { error: "Missing accountId parameter" },
      { status: 400 }
    );
  }

  // Look up the sync account to get the Unipile account ID
  const syncAccount = await db.syncAccount.findUnique({
    where: { id: accountId },
  });
  if (!syncAccount) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  const unipileAccountId = syncAccount.accountIdentifier;

  const baseUrl = process.env.UNIPILE_BASE_URL;
  const accessToken = process.env.UNIPILE_ACCESS_TOKEN;
  if (!baseUrl || !accessToken) {
    return NextResponse.json(
      { error: "Missing UNIPILE_BASE_URL or UNIPILE_ACCESS_TOKEN" },
      { status: 500 }
    );
  }

  const service = new UnipileService({ baseUrl, accessToken });
  try {
    const chats = await service.getAllWhatsAppChats(unipileAccountId);
    console.log(chats);
    return NextResponse.json({ chats });
  } catch (err) {
    console.error("Error fetching WhatsApp chats:", err);
    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 }
    );
  }
}
