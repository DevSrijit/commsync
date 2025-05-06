import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncBulkvsAccounts } from "@/lib/sync-service";

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
    const { accountId } = requestData;

    if (!accountId) {
      return NextResponse.json(
        {
          error: "Missing required parameter",
          details: "accountId is required",
        },
        { status: 400 }
      );
    }

    // Verify account ownership
    const account = await db.syncAccount.findUnique({
      where: {
        id: accountId,
        userId,
      },
    });

    if (!account) {
      return NextResponse.json(
        {
          error: "Account not found or unauthorized",
          details: "BulkVS account not found or you don't have access",
        },
        { status: 404 }
      );
    }

    // Check if account is a BulkVS account
    if (account.platform !== "bulkvs") {
      return NextResponse.json(
        {
          error: "Invalid account type",
          details: "The specified account is not a BulkVS account",
        },
        { status: 400 }
      );
    }

    // Extract sync options
    const options = {
      accountId,
      phoneNumber: account.accountIdentifier,
      pageSize: requestData.pageSize || 100,
      lastSmsIdFetched: requestData.lastSmsIdFetched,
      sortDirection: (requestData.sortDirection as "asc" | "desc") || "desc",
      isLoadingMore: !!requestData.isLoadingMore,
    };

    console.log(
      `Syncing BulkVS account ${accountId} for user ${userId}`,
      options
    );

    // Since BulkVS only receives messages through webhooks and doesn't have a message retrieval API,
    // this sync operation just updates the lastSync time to indicate a sync was attempted
    await db.syncAccount.update({
      where: { id: accountId },
      data: { lastSync: new Date() },
    });

    return NextResponse.json({
      success: true,
      message:
        "BulkVS account sync completed. Note: BulkVS only receives messages through webhooks, past messages cannot be retrieved.",
      webhook_status:
        "Sync only updates the last sync time. Make sure you have configured webhooks in your BulkVS account to receive new messages.",
      account: {
        id: account.id,
        lastSync: new Date(),
      },
    });
  } catch (error: any) {
    console.error("Error in BulkVS sync:", error);
    return NextResponse.json(
      {
        error: "Failed to sync BulkVS account",
        details: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
