import { NextRequest, NextResponse } from "next/server";
import { UnipileService } from "@/lib/unipile-service";

export async function POST(req: NextRequest) {
  // Read raw body for signature verification
  const rawBody = await req.text();
  const signature = req.headers.get("x-unipile-signature") || undefined;

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
    await service.handleWebhook(rawBody, signature);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error handling WhatsApp webhook:", error);
    return NextResponse.json(
      { error: "Webhook handling failed" },
      { status: 500 }
    );
  }
}
