import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUnipileSyncService } from "@/lib/unipile-sync-service";

export async function POST() {
  try {
    // Get the user's session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the Unipile sync service
    const syncService = getUnipileSyncService();

    // Sync accounts for the user
    const messageCount = await syncService.syncAccountsForUser(session.user.id);

    return NextResponse.json({
      success: true,
      messageCount,
    });
  } catch (error) {
    console.error("Error syncing Unipile accounts:", error);
    return NextResponse.json(
      { error: "Failed to sync accounts" },
      { status: 500 }
    );
  }
}
