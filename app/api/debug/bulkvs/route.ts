import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { BulkVSService } from "@/lib/bulkvs-service";

export async function GET(request: Request) {
  try {
    // Verify authentication - only allow in development environment for security
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json(
        { error: "Debug endpoints only available in development" },
        { status: 403 }
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get parameters
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const limit = parseInt(searchParams.get("limit") || "100");

    // Get the BulkVS accounts
    const query: any = { platform: "bulkvs", userId: session.user.id };
    if (accountId) query.id = accountId;

    const accounts = await db.syncAccount.findMany({
      where: query,
    });

    if (!accounts || accounts.length === 0) {
      return NextResponse.json(
        { error: "No BulkVS accounts found" },
        { status: 404 }
      );
    }

    const results: any[] = [];

    // Test each account
    for (const account of accounts) {
      try {
        const bulkvsService = new BulkVSService(account);

        // Get all messages without filters to debug
        const debug = await bulkvsService.getAllMessagesDebug(limit);

        // Also get phone numbers to check if account is valid
        const phoneNumbers = await bulkvsService
          .getPhoneNumbers()
          .catch((err) => ({ error: err.message }));

        results.push({
          accountId: account.id,
          accountIdentifier: account.accountIdentifier,
          lastSync: account.lastSync,
          debug,
          phoneNumbers,
        });
      } catch (error) {
        console.error(`Error debugging BulkVS account ${account.id}:`, error);
        results.push({
          accountId: account.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("BulkVS debug error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
