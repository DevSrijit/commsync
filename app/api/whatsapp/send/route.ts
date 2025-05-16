import { NextRequest, NextResponse } from "next/server";
import { UnipileService } from "@/lib/unipile-service";

export async function POST(req: NextRequest) {
  const { chatId, text, attachments } = await req.json();
  if (!chatId || !text) {
    return NextResponse.json(
      { error: "Missing chatId or text" },
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
    const result = await service.sendWhatsAppMessage(chatId, text, attachments);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    return NextResponse.json(
      { error: "Failed to send WhatsApp message" },
      { status: 500 }
    );
  }
}
