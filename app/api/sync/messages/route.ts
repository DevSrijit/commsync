import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncJustCallAccounts, syncTwilioAccounts } from "@/lib/sync-service";

export async function POST(request: Request) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Extract payload
    const payload = await request.json();
    const {
      platform,
      authCode,
      pageSize = 100,
      accountId,
      phoneNumber,
      lastSmsIdFetched,
      sortDirection = "desc",
      isLoadingMore = false,
    } = payload;

    if (!platform) {
      return NextResponse.json(
        { error: "Platform parameter is required" },
        { status: 400 }
      );
    }

    let result;

    // Sync messages based on platform
    switch (platform.toLowerCase()) {
      case "twilio":
        result = await syncTwilioAccounts(session.user.id);
        break;
      case "justcall":
        result = await syncJustCallAccounts(session.user.id, {
          phoneNumber,
          accountId,
          pageSize,
          ...(isLoadingMore ? { lastSmsIdFetched } : {}),
          sortDirection,
        });
        break;
      default:
        return NextResponse.json(
          { error: "Unsupported platform" },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Error syncing messages:", error);
    return NextResponse.json(
      { error: "Failed to sync messages" },
      { status: 500 }
    );
  }
}
