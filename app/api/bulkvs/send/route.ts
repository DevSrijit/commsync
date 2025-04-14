import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
import { BulkVSService } from "@/lib/bulkvs-service";

export async function POST(req: NextRequest) {
  try {
    // Validate user session
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const requestData = await req.json();

    // Validate required parameters
    const { accountId, to, body } = requestData;

    if (!accountId) {
      return NextResponse.json(
        {
          error: "Missing required parameter",
          details: "accountId is required",
        },
        { status: 400 }
      );
    }

    if (!to) {
      return NextResponse.json(
        {
          error: "Missing required parameter",
          details: "to phone number is required",
        },
        { status: 400 }
      );
    }

    if (!body) {
      return NextResponse.json(
        {
          error: "Missing required parameter",
          details: "message body is required",
        },
        { status: 400 }
      );
    }

    // Get the BulkVS account from the database
    const account = await db.syncAccount.findUnique({
      where: {
        id: accountId,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found", details: "BulkVS account not found" },
        { status: 404 }
      );
    }

    if (account.userId !== userId) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          details: "You do not have permission to use this account",
        },
        { status: 403 }
      );
    }

    // Initialize BulkVS service with the account
    const bulkvsService = new BulkVSService(account);

    // Optional parameters
    const media = requestData.media || [];
    const from = requestData.from; // Custom from number if provided

    // Format the recipient number if needed
    const formattedTo = to.trim();

    // Send the message
    const messageResponse = await bulkvsService.sendMessage(
      formattedTo,
      body,
      media,
      from
    );

    // Return the message response
    return NextResponse.json(
      {
        success: true,
        message: "Message sent successfully",
        data: messageResponse,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error sending BulkVS message:", error);

    // Handle specific error cases with appropriate status codes
    if (
      error.message?.includes("Unauthorized") ||
      error.message?.includes("401")
    ) {
      return NextResponse.json(
        {
          error: "Authentication failed",
          details: "Invalid BulkVS API credentials",
        },
        { status: 401 }
      );
    }

    if (error.message?.includes("phone number")) {
      return NextResponse.json(
        { error: "Invalid phone number", details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to send message", details: error.message },
      { status: 500 }
    );
  }
}
