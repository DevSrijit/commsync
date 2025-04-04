import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
import { JustCallService } from "@/lib/justcall-service";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const accountId = req.nextUrl.searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "Missing account ID" },
        { status: 400 }
      );
    }

    // Verify the account belongs to the user
    const syncAccount = await db.syncAccount.findFirst({
      where: {
        id: accountId,
        userId,
        platform: "justcall",
      },
    });

    if (!syncAccount) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Start the sync process
    const justCallService = new JustCallService(syncAccount);

    // Get the last sync date to fetch only new messages
    const lastSyncDate = syncAccount.lastSync;

    // Fetch messages from JustCall API
    const result = await justCallService.getMessages(undefined, lastSyncDate);
    const { messages, rateLimited, retryAfter } = result;

    // Add rate limit info to response headers
    const responseHeaders: HeadersInit = {};
    if (rateLimited) {
      console.warn(
        `⚠️ JustCall API rate limit reached for account ${accountId}`
      );
      responseHeaders["X-RateLimit-Warning"] = "true";

      if (retryAfter) {
        console.warn(`   Recommended to retry after ${retryAfter} seconds`);
        responseHeaders["X-RateLimit-Reset"] = retryAfter.toString();
      }
    }

    let processedCount = 0;

    // Process each message
    for (const message of messages) {
      // Skip outbound messages as they were likely sent from our system
      if (message.direction === "outbound") {
        continue;
      }

      await justCallService.processIncomingMessage(message);
      processedCount++;
    }

    // Update the last sync time
    await db.syncAccount.update({
      where: { id: accountId },
      data: { lastSync: new Date() },
    });

    return NextResponse.json(
      {
        status: "success",
        messagesProcessed: processedCount,
        rateLimited: rateLimited ? true : false,
        retryAfter: retryAfter || undefined,
      },
      { status: 200, headers: responseHeaders }
    );
  } catch (error) {
    console.error("Error syncing JustCall messages:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
