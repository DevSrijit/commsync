import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";

// Get all BulkVS accounts for the current user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const accounts = await db.syncAccount.findMany({
      where: {
        userId,
        platform: "bulkvs",
      },
      select: {
        id: true,
        platform: true,
        accountIdentifier: true,
        lastSync: true,
        createdAt: true,
        updatedAt: true,
        settings: true,
      },
    });

    // Format the accounts to include the label from settings if available
    const formattedAccounts = accounts.map((account: any) => {
      let label = "BulkVS";

      // Try to extract the label from settings if it exists
      if (account.settings) {
        try {
          const settings =
            typeof account.settings === "string"
              ? JSON.parse(account.settings)
              : account.settings;

          if (settings && settings.label) {
            label = settings.label;
          }
        } catch (error) {
          console.error("Error parsing account settings:", error);
        }
      }

      return {
        ...account,
        label,
      };
    });

    return NextResponse.json(formattedAccounts, { status: 200 });
  } catch (error) {
    console.error("Error fetching BulkVS accounts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Delete a BulkVS account
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("id");

    if (!accountId) {
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 }
      );
    }

    // Get the account first to verify ownership
    const account = await db.syncAccount.findUnique({
      where: {
        id: accountId,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (account.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized to delete this account" },
        { status: 403 }
      );
    }

    // Delete the account
    await db.syncAccount.delete({
      where: {
        id: accountId,
      },
    });

    return NextResponse.json(
      { message: "Account deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting BulkVS account:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
