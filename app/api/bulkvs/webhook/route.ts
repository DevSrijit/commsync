import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { BulkVSService } from "@/lib/bulkvs-service";
import { formatBulkVSTimestamp } from "@/lib/bulkvs-service";
import { BulkVSMessage } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const webhookData = await req.json();

    // Validate the webhook data
    if (!webhookData || !webhookData.data) {
      console.error("Invalid BulkVS webhook data");
      return NextResponse.json(
        { error: "Invalid webhook data" },
        { status: 400 }
      );
    }

    // Extract message data
    const messageData = webhookData.data;

    // Validate the message has required fields
    if (!messageData.id || !messageData.from || !messageData.to) {
      console.error("Missing required fields in BulkVS webhook data");
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Find the associated BulkVS account by phone number
    // We need to check both from and to fields, as the message could be inbound or outbound
    const potentialPhoneNumbers = [messageData.from, messageData.to];

    const accounts = await db.syncAccount.findMany({
      where: {
        platform: "bulkvs",
        accountIdentifier: {
          in: potentialPhoneNumbers,
        },
      },
    });

    if (!accounts || accounts.length === 0) {
      console.warn(
        `No BulkVS account found for numbers ${potentialPhoneNumbers.join(
          ", "
        )}`
      );
      return NextResponse.json(
        { error: "No matching account found" },
        { status: 404 }
      );
    }

    // Process the message with each matching account
    const results = await Promise.allSettled(
      accounts.map(async (account: any) => {
        try {
          // Determine if this is an inbound or outbound message relative to this account
          const isInbound = messageData.to === account.accountIdentifier;

          // Format the message for processing
          const message = {
            id: messageData.id.toString(),
            from: messageData.from,
            to: messageData.to,
            message: messageData.message || messageData.body || "",
            direction: isInbound ? "inbound" : "outbound",
            created_at: messageData.created_at || new Date().toISOString(),
            media_urls: messageData.media_urls || [],
            status: messageData.status || "delivered",
            // Add derived fields that match our standard format
            number: account.accountIdentifier,
            contact_number: isInbound ? messageData.from : messageData.to,
            body: messageData.message || messageData.body || "",
          };

          // Create a BulkVS service instance and process the message
          const bulkvsService = new BulkVSService(account);
          await bulkvsService.processIncomingMessage(message as BulkVSMessage);

          return {
            accountId: account.id,
            success: true,
          };
        } catch (error) {
          console.error(
            `Error processing BulkVS webhook for account ${account.id}:`,
            error
          );
          return {
            accountId: account.id,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      })
    );

    // Check if any processing was successful
    const successful = results.some(
      (result) => result.status === "fulfilled" && result.value.success
    );

    if (successful) {
      return NextResponse.json(
        {
          message: "Webhook processed successfully",
          results: results.map((r) =>
            r.status === "fulfilled" ? r.value : { success: false }
          ),
        },
        { status: 200 }
      );
    } else {
      console.error("Failed to process BulkVS webhook:", results);
      return NextResponse.json(
        {
          error: "Failed to process webhook",
          results: results.map((r) =>
            r.status === "fulfilled" ? r.value : { success: false }
          ),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in BulkVS webhook:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
