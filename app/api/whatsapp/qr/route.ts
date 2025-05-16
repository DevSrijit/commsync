import { NextRequest, NextResponse } from "next/server";
import { UnipileService } from "@/lib/unipile-service";

export async function GET(req: NextRequest) {
  // Initialize service with environment vars
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
    const { qrCodeString, code, accountId } = await service.getWhatsappQRCode();
    return NextResponse.json({ qrCodeString, code, accountId });
  } catch (error) {
    console.error("Error fetching WhatsApp QR code:", error);
    return NextResponse.json(
      { error: "Failed to get QR code" },
      { status: 500 }
    );
  }
}
