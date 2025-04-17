import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { NylasService } from "@/lib/nylas-service";

export async function POST(request: Request) {
  try {
    // Verify signature (in production, add code to verify webhook signature)
    // Note: production code should verify the signature using NYLAS_CLIENT_SECRET
    // See: https://developer.nylas.com/docs/v3/notifications/

    const payload = await request.json();
    console.log(
      "Received Nylas webhook payload:",
      JSON.stringify(payload, null, 2)
    );

    // Nylas sends a challenge when setting up a webhook which we must respond to
    if (payload.challenge) {
      return NextResponse.json({ challenge: payload.challenge });
    }

    // Skip if required data is missing
    if (!payload.data?.grant_id || !payload.data?.object) {
      return NextResponse.json(
        { success: false, error: "Invalid webhook payload" },
        { status: 400 }
      );
    }

    const { grant_id, object } = payload.data;

    // Find the associated account in our database
    const syncAccount = await db.syncAccount.findFirst({
      where: {
        platform: "nylas",
        credentials: {
          contains: grant_id,
        },
      },
    });

    if (!syncAccount) {
      console.error(`No sync account found for Nylas grant ID: ${grant_id}`);
      return NextResponse.json(
        { success: false, error: "Account not found" },
        { status: 404 }
      );
    }

    // Process the webhook based on the trigger type
    switch (payload.type) {
      case "message.created":
        // Initialize the service with the account details
        const nylasService = new NylasService(syncAccount);

        // Process the new message
        await nylasService.processIncomingMessage(object);
        break;

      case "message.updated":
        // Update the message status (read/unread, etc.)
        // For now, we'll just update the database
        await db.message.updateMany({
          where: {
            syncAccountId: syncAccount.id,
            externalId: object.id,
          },
          data: {
            isRead: object.seen || false,
            metadata: JSON.stringify(object),
          },
        });
        break;

      case "message.deleted":
        // Handle message deletion
        await db.message.updateMany({
          where: {
            syncAccountId: syncAccount.id,
            externalId: object.id,
          },
          data: {
            isDeleted: true,
          },
        });
        break;

      default:
        // Just log other webhook types
        console.log(`Unhandled Nylas webhook type: ${payload.type}`);
    }

    // Emit a Server-Sent Event for real-time UI updates (if implemented)
    // This would notify frontend components to refresh data

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing Nylas webhook:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}
