import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUnipileService } from "@/lib/unipile-service";
import { db } from "@/lib/db";
import { UnipileAccount } from "@/lib/unipile-service";

// GET all WhatsApp accounts for the current user
export async function GET(request: NextRequest) {
  try {
    // Get the user's session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get account ID from query params if provided
    const accountId = request.nextUrl.searchParams.get("id");

    // If ID is provided, return that specific account
    if (accountId) {
      const account = await db.unipileAccount.findUnique({
        where: {
          id: accountId,
          userId: session.user.id,
        },
      });

      if (!account) {
        return NextResponse.json(
          { error: "Account not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(account);
    }

    // Otherwise, return all WhatsApp accounts for the user
    const accounts = await db.unipileAccount.findMany({
      where: {
        userId: session.user.id,
        provider: "whatsapp",
        status: "connected",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(accounts);
  } catch (error) {
    console.error("Error fetching WhatsApp accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}

// DELETE a WhatsApp account
export async function DELETE(request: NextRequest) {
  try {
    // Get the user's session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get account ID from query params
    const accountId = request.nextUrl.searchParams.get("id");
    if (!accountId) {
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 }
      );
    }

    // Verify the account belongs to the user
    const account = await db.unipileAccount.findUnique({
      where: {
        id: accountId,
        userId: session.user.id,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Delete the account using the Unipile service
    const unipileService = getUnipileService();
    await unipileService.deleteAccount(accountId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting WhatsApp account:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
