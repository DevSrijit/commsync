import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import axios from "axios";
import { DiscordService } from "@/lib/discord-service";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "Missing account ID" },
        { status: 400 }
      );
    }

    // Verify account belongs to the user
    const account = await db.discordAccount.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Discord account not found" },
        { status: 404 }
      );
    }

    // Sync channels and messages
    const discordService = new DiscordService(account);
    const success = await discordService.syncChannels();

    if (!success) {
      return NextResponse.json(
        { error: "Failed to sync Discord channels" },
        { status: 500 }
      );
    }

    // Update last sync time
    await db.discordAccount.update({
      where: {
        id: accountId,
      },
      data: {
        lastSync: new Date(),
      },
    });

    // Get updated channels
    const channels = await db.discordChannel.findMany({
      where: {
        discordAccounts: {
          some: {
            id: accountId,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      channels,
    });
  } catch (error) {
    console.error("Error syncing Discord account:", error);
    return NextResponse.json(
      { error: "Failed to sync Discord account" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "Missing account ID" },
        { status: 400 }
      );
    }

    // Verify account belongs to the user
    const account = await db.discordAccount.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Discord account not found" },
        { status: 404 }
      );
    }

    // Get channels for the account
    const channels = await db.discordChannel.findMany({
      where: {
        discordAccounts: {
          some: {
            id: accountId,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json(channels);
  } catch (error) {
    console.error("Error fetching Discord channels:", error);
    return NextResponse.json(
      { error: "Failed to fetch Discord channels" },
      { status: 500 }
    );
  }
}
