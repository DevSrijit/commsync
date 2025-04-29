import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    // Ensure user is authenticated
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          details: "You must be logged in to access Discord accounts",
        },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get all Discord accounts for this user
    const accounts = await db.discordAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(accounts);
  } catch (error) {
    console.error("Error fetching Discord accounts:", error);

    return NextResponse.json(
      {
        error: "FetchError",
        details:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Ensure user is authenticated
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          details: "You must be logged in to delete Discord accounts",
        },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get account ID from query parameters
    const url = new URL(req.url);
    const accountId = url.searchParams.get("id");

    if (!accountId) {
      return NextResponse.json(
        { error: "MissingAccountId", details: "Account ID is required" },
        { status: 400 }
      );
    }

    // Ensure the account belongs to the user
    const account = await db.discordAccount.findFirst({
      where: {
        id: accountId,
        userId,
      },
    });

    if (!account) {
      return NextResponse.json(
        {
          error: "AccountNotFound",
          details: "Discord account not found or doesn't belong to you",
        },
        { status: 404 }
      );
    }

    // Delete the account
    await db.discordAccount.delete({
      where: { id: accountId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting Discord account:", error);

    return NextResponse.json(
      {
        error: "DeleteError",
        details:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
