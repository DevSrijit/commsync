import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncNylasAccounts } from "@/lib/sync-service";

export async function GET(request: NextRequest) {
  try {
    // Verify that the user is logged in
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Sync Nylas accounts for the current user
    const results = await syncNylasAccounts(session.user.id);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Error syncing Nylas accounts:", error);

    return NextResponse.json(
      {
        error: "Failed to sync Nylas accounts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
