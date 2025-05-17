import { NextRequest, NextResponse } from "next/server";
import { UnipileService } from "@/lib/unipile-service";
import { db } from "@/lib/db";

interface Params {
  params: { chatId: string };
}

export async function GET(req: NextRequest, { params }: Params) {
  // Await params before destructuring to prevent Next.js error
  const chatId = params.chatId;

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
  if (!unipileAccountId) {
    return NextResponse.json(
      { error: "Account missing Unipile identifier" },
      { status: 400 }
    );
  }

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
    console.log(
      `Fetching WhatsApp messages for chat ${chatId} with Unipile account ${unipileAccountId}`
    );
    console.log(
      `Pagination params: afterId=${afterId}, beforeId=${beforeId}, limit=${limit}, sortDirection=${sortDirection}`
    );

    const response = await service.getWhatsAppMessages(chatId, {
      afterId,
      beforeId,
      limit,
      sortDirection,
      accountId: unipileAccountId,
    });

    // Handle the updated response format which contains messages array and cursor
    if (!response || !response.messages || !Array.isArray(response.messages)) {
      console.error(
        `Invalid response from Unipile for messages: ${JSON.stringify(
          response
        )}`
      );
      return NextResponse.json(
        { error: "Invalid response from Unipile API", data: response },
        { status: 500 }
      );
    }

    const { messages, cursor } = response;

    console.log(
      `Retrieved ${messages.length} WhatsApp messages for chat ${chatId}`
    );
    return NextResponse.json({ messages, cursor });
  } catch (err) {
    console.error("Error fetching WhatsApp messages:", err);
    return NextResponse.json(
      { error: "Failed to fetch messages", details: String(err) },
      { status: 500 }
    );
  }
}
