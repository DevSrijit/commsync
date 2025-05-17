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

  // The accountIdentifier field contains the Unipile account ID
  const unipileAccountId = syncAccount.accountIdentifier;
  if (!unipileAccountId) {
    return NextResponse.json(
      { error: "Account missing Unipile identifier" },
      { status: 400 }
    );
  }

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
      `Fetching WhatsApp chats for Unipile account: ${unipileAccountId}`
    );
    const response = await service.getAllWhatsAppChats(unipileAccountId);

    console.log(`Response type: ${typeof response}`);
    console.log(
      `Response has chats property: ${response && "chats" in response}`
    );
    console.log(
      `Response.chats is array: ${
        response && response.chats && Array.isArray(response.chats)
      }`
    );
    console.log(
      `Response keys: ${response ? Object.keys(response).join(", ") : "none"}`
    );

    // Handle the updated response format which contains chats array and cursor
    if (!response || !response.chats || !Array.isArray(response.chats)) {
      console.error(
        `Invalid response from Unipile for chats: ${JSON.stringify(response)}`
      );
      return NextResponse.json(
        { error: "Invalid response from Unipile API", data: response },
        { status: 500 }
      );
    }

    const { chats, cursor } = response;

    console.log(
      `Retrieved ${chats.length} WhatsApp chats for account ${unipileAccountId}`
    );
    return NextResponse.json({ chats, cursor });
  } catch (err) {
    console.error("Error fetching WhatsApp chats:", err);
    return NextResponse.json(
      { error: "Failed to fetch chats", details: String(err) },
      { status: 500 }
    );
  }
}
