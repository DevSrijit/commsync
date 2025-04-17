import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { SyncAccount } from "@prisma/client";

// Extended SyncAccount type to include potential fields not in current schema
interface ExtendedSyncAccount extends SyncAccount {
  label?: string;
  settings?: string;
}

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

    // Fetch the user's Nylas accounts
    const accounts = await db.syncAccount.findMany({
      where: {
        userId: session.user.id,
        platform: "nylas",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform accounts to a safe format for the client
    const safeAccounts = accounts.map((account: ExtendedSyncAccount) => ({
      id: account.id,
      label: account.label || `Nylas (${account.accountIdentifier})`,
      email: account.accountIdentifier,
      platform: account.platform,
      provider: account.settings
        ? JSON.parse(account.settings || "{}").provider || "outlook"
        : "outlook",
      lastSync: account.lastSync,
    }));

    return NextResponse.json(safeAccounts);
  } catch (error) {
    console.error("Error fetching Nylas accounts:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch Nylas accounts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Verify that the user is logged in
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get the account ID from query parameters
    const searchParams = request.nextUrl.searchParams;
    const accountId = searchParams.get("id");

    if (!accountId) {
      return NextResponse.json(
        { error: "Missing account ID" },
        { status: 400 }
      );
    }

    // Get account details to verify ownership
    const account = await db.syncAccount.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
        platform: "nylas",
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Delete any associated messages first
    await db.message.deleteMany({
      where: {
        syncAccountId: accountId,
      },
    });

    // Delete the account
    await db.syncAccount.delete({
      where: {
        id: accountId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting Nylas account:", error);

    return NextResponse.json(
      {
        error: "Failed to delete account",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
