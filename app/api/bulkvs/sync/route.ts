import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { syncBulkvsAccounts } from "@/lib/sync-service";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const requestData = await req.json();

    // Extract options from request
    const {
      accountId,
      phoneNumber,
      pageSize,
      lastSmsIdFetched,
      sortDirection = "desc",
    } = requestData;

    // Validate request parameters
    if (!accountId) {
      return NextResponse.json(
        {
          error: "Missing required parameter",
          details: "accountId is required",
        },
        { status: 400 }
      );
    }

    // Prepare sync options
    const options = {
      phoneNumber,
      accountId,
      pageSize: pageSize ? Number(pageSize) : undefined,
      lastSmsIdFetched,
      sortDirection: sortDirection as "asc" | "desc",
    };

    // Sync BulkVS messages for the specified account
    const result = await syncBulkvsAccounts(userId, options);

    // Extract the results for the specific account
    const accountResults = result.results
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((r) => r && r.accountId === accountId);

    // Format the response
    const syncResult = accountResults[0] || {};
    const messages = syncResult.messages || [];
    const rateLimited = syncResult.rateLimited || false;
    const retryAfter = syncResult.retryAfter || 0;

    return NextResponse.json(
      {
        success: true,
        accountId,
        messages,
        rateLimited,
        retryAfter,
        lastMessageId: syncResult.lastMessageId || null,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error syncing BulkVS messages:", error);
    return NextResponse.json(
      { error: "Failed to sync BulkVS messages", details: error.message },
      { status: 500 }
    );
  }
}
