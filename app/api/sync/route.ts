import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  syncAllAccountsForUser,
  syncJustCallAccounts,
  syncBulkvsAccounts,
} from "@/lib/sync-service";

// Map to track ongoing sync operations by user ID
const ongoingSyncs = new Map<string, boolean>();

// Global sync for all accounts (can be called by a cron job or webhook)
export async function GET(req: NextRequest) {
  // Check for a secret API key to ensure this endpoint isn't abused
  const apiKey = req.nextUrl.searchParams.get("apiKey");
  const expectedApiKey = process.env.SYNC_API_KEY;

  if (!expectedApiKey || apiKey !== expectedApiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optionally limit to a specific platform
  const platform = req.nextUrl.searchParams.get("platform");

  try {
    let result;
    if (platform === "justcall") {
      // Sync only JustCall accounts for all users
      result = await syncJustCallAccounts();
    } else if (platform === "bulkvs") {
      // Sync only BulkVS accounts for all users
      result = await syncBulkvsAccounts();
    } else {
      // Sync all accounts for all users (would need to implement this)
      result = { message: "Full sync not implemented yet" };
    }

    return NextResponse.json({ success: true, result }, { status: 200 });
  } catch (error) {
    console.error("Error in global sync:", error);
    return NextResponse.json(
      {
        error: "Failed to run global sync",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// User-specific sync endpoint
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Check if a sync is already in progress for this user
  if (ongoingSyncs.get(userId)) {
    return NextResponse.json(
      { message: "Sync already in progress for this user" },
      { status: 200 }
    );
  }

  // Parse request body for options
  let options: { platform?: string; accountId?: string } = {};
  try {
    options = await req.json();
  } catch (e) {
    // If no JSON body, proceed with default options
  }

  // Mark sync as started for this user
  ongoingSyncs.set(userId, true);

  try {
    // Start the sync process asynchronously
    let syncPromise;

    if (options.platform === "justcall") {
      // Sync JustCall accounts, optionally with a specific account ID
      syncPromise = syncJustCallAccounts(
        userId,
        options.accountId ? { accountId: options.accountId } : undefined
      );
    } else if (options.platform === "bulkvs") {
      // Sync BulkVS accounts, optionally with a specific account ID
      syncPromise = syncBulkvsAccounts(
        userId,
        options.accountId ? { accountId: options.accountId } : undefined
      );
    } else {
      // Sync all account types for the user
      syncPromise = syncAllAccountsForUser(userId);
    }

    // We'll return immediately to the user but continue the sync in the background
    syncPromise
      .then(() => console.log(`Sync completed for user ${userId}`))
      .catch((err) => console.error(`Sync failed for user ${userId}:`, err))
      .finally(() => {
        // Clear the sync flag when done
        ongoingSyncs.set(userId, false);
      });

    return NextResponse.json(
      { message: "Sync started in background" },
      { status: 200 }
    );
  } catch (error) {
    // Clear the sync flag on error
    ongoingSyncs.set(userId, false);

    console.error("Error starting sync:", error);
    return NextResponse.json(
      {
        error: "Failed to start sync",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
