import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NylasService } from "@/lib/nylas-service";

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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const accountId = searchParams.get("accountId");
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const cursor = searchParams.get("cursor");
    const search = searchParams.get("search");
    const fromDate = searchParams.get("fromDate")
      ? new Date(searchParams.get("fromDate") as string)
      : undefined;

    if (!accountId) {
      return NextResponse.json(
        { error: "Missing required accountId parameter" },
        { status: 400 }
      );
    }

    // Find the Nylas account in our database
    const syncAccount = await db.syncAccount.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
        platform: "nylas",
      },
    });

    if (!syncAccount) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Initialize the Nylas service
    const nylasService = new NylasService(syncAccount);

    // Fetch emails
    const emails = await nylasService.getMessages({
      limit,
      cursor,
      fromDate,
      searchQuery: search || undefined,
    });

    // Update lastSync timestamp for the account
    await db.syncAccount.update({
      where: { id: accountId },
      data: { lastSync: new Date() },
    });

    return NextResponse.json({
      success: true,
      emails,
      cursor: emails.length > 0 ? emails[emails.length - 1].id : null,
    });
  } catch (error) {
    console.error("Error fetching emails from Nylas:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch emails",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
