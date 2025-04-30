import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
import { DiscordService } from "@/lib/discord-service";

// GET handler to fetch all Discord accounts for the user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const discordAccounts = await db.discordAccount.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(discordAccounts);
  } catch (error) {
    console.error("Error fetching Discord accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch Discord accounts" },
      { status: 500 }
    );
  }
}

// POST handler to add a new Discord account
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await req.json();
    const {
      accessToken,
      refreshToken,
      expiresAt,
      discordUserId,
      username,
      avatar,
    } = json;

    if (!accessToken || !refreshToken || !expiresAt || !discordUserId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if account already exists
    const existingAccount = await db.discordAccount.findFirst({
      where: {
        userId: session.user.id,
        discordUserId,
      },
    });

    if (existingAccount) {
      // Update existing account
      const updatedAccount = await db.discordAccount.update({
        where: {
          id: existingAccount.id,
        },
        data: {
          accessToken,
          refreshToken,
          expiresAt: new Date(expiresAt),
          username,
          avatar,
        },
      });

      // Register with middleware server
      const discordService = new DiscordService(updatedAccount);
      await discordService.register();

      return NextResponse.json(updatedAccount);
    }

    // Create new account
    const newAccount = await db.discordAccount.create({
      data: {
        userId: session.user.id,
        accessToken,
        refreshToken,
        expiresAt: new Date(expiresAt),
        discordUserId,
        username,
        avatar,
      },
    });

    // Register with middleware server
    const discordService = new DiscordService(newAccount);
    await discordService.register();

    return NextResponse.json(newAccount);
  } catch (error) {
    console.error("Error adding Discord account:", error);
    return NextResponse.json(
      { error: "Failed to add Discord account" },
      { status: 500 }
    );
  }
}

// DELETE handler to remove a Discord account
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing account ID" },
        { status: 400 }
      );
    }

    // Get the account before deleting
    const account = await db.discordAccount.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Discord account not found" },
        { status: 404 }
      );
    }

    // Unregister from middleware server
    const discordService = new DiscordService(account);
    await discordService.unregister();

    // Delete account
    await db.discordAccount.delete({
      where: {
        id,
      },
    });

    // Delete related channels and messages
    await db.discordChannel.deleteMany({
      where: {
        discordAccounts: {
          some: {
            id,
          },
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting Discord account:", error);
    return NextResponse.json(
      { error: "Failed to delete Discord account" },
      { status: 500 }
    );
  }
}
