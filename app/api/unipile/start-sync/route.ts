import { NextResponse } from "next/server";
import { getUnipileSyncService } from "@/lib/unipile-sync-service";

// This route is used to start the Unipile sync service when the app starts
export async function POST() {
  try {
    // Get the Unipile sync service
    const syncService = getUnipileSyncService();

    // Start the sync service
    syncService.startSyncService();

    return NextResponse.json({
      success: true,
      message: "Unipile sync service started",
    });
  } catch (error) {
    console.error("Error starting Unipile sync service:", error);
    return NextResponse.json(
      { error: "Failed to start sync service" },
      { status: 500 }
    );
  }
}
