import { NextRequest, NextResponse } from "next/server";
import { getUnipileSyncService } from "@/lib/unipile-sync-service";

// Webhook handler for Unipile events
export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature if needed
    // const signature = request.headers.get("x-unipile-signature");
    // Verification logic would go here

    // Parse the webhook payload
    const payload = await request.json();

    // Log the webhook for debugging
    console.log("Received Unipile webhook:", JSON.stringify(payload));

    // Get the Unipile sync service
    const syncService = getUnipileSyncService();

    // Handle the webhook event
    await syncService.handleWebhookEvent(payload);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error handling Unipile webhook:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}
