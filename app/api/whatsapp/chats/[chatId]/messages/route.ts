import { NextRequest, NextResponse } from "next/server";
import { UnipileService } from "@/lib/unipile-service";

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
    const messages = await service.getWhatsAppMessages(chatId);
    return NextResponse.json({ messages });
  } catch (err) {
    console.error("Error fetching WhatsApp messages:", err);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
