import { NextRequest, NextResponse } from "next/server";
import { UnipileService } from "@/lib/unipile-service";
import { db } from "@/lib/db";

interface Params {
  params: { chatId: string };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { chatId } = params;
  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId");
  if (!accountId) {
    return NextResponse.json(
      { error: "Missing accountId parameter" },
      { status: 400 }
    );
  }

  // Lookup sync account to get the Unipile account ID
  const syncAccount = await db.syncAccount.findUnique({
    where: { id: accountId },
  });
  if (!syncAccount) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  const unipileAccountId = syncAccount.accountIdentifier;
  // Get pagination and filtering parameters
  const afterId = url.searchParams.get("afterId") || undefined;
  const beforeId = url.searchParams.get("beforeId") || undefined;
  const limit = url.searchParams.get("limit")
    ? parseInt(url.searchParams.get("limit")!)
    : undefined;
  const sortDirection =
    (url.searchParams.get("sortDirection") as "asc" | "desc") || "desc";

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
    const messages = await service.getWhatsAppMessages(chatId, {
      afterId,
      beforeId,
      limit,
      sortDirection,
      accountId: unipileAccountId,
    });
    return NextResponse.json({ messages });
  } catch (err) {
    console.error("Error fetching WhatsApp messages:", err);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
