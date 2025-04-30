import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { DiscordService } from "@/lib/discord-service";
import axios from "axios";
import { DiscordMessage } from "@prisma/client";

// GET handler to fetch messages for a Discord channel
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get("channelId");
    const before = searchParams.get("before");
    const limit = searchParams.get("limit") || "50";

    if (!channelId) {
      return NextResponse.json(
        { error: "Missing channel ID" },
        { status: 400 }
      );
    }

    // Verify channel belongs to a discord account owned by the user
    const channel = await db.discordChannel.findFirst({
      where: {
        id: channelId,
        discordAccounts: {
          some: {
            userId: session.user.id,
          },
        },
      },
      include: {
        discordAccounts: true,
      },
    });

    if (!channel) {
      return NextResponse.json(
        { error: "Discord channel not found" },
        { status: 404 }
      );
    }

    // Get the account for this channel
    const account = channel.discordAccounts[0];

    if (!account) {
      return NextResponse.json(
        { error: "Discord account not found for this channel" },
        { status: 404 }
      );
    }

    // Get messages
    const discordService = new DiscordService(account);
    const messages = await discordService.getMessages(
      channelId,
      parseInt(limit),
      before || undefined
    );

    return NextResponse.json(messages);
  } catch (error) {
    console.error("Error fetching Discord messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch Discord messages" },
      { status: 500 }
    );
  }
}

// POST handler to send a message to a Discord channel
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { channelId, content } = body;

    if (!channelId || !content) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify channel belongs to a discord account owned by the user
    const channel = await db.discordChannel.findFirst({
      where: {
        id: channelId,
        discordAccounts: {
          some: {
            userId: session.user.id,
          },
        },
      },
      include: {
        discordAccounts: true,
      },
    });

    if (!channel) {
      return NextResponse.json(
        { error: "Discord channel not found" },
        { status: 404 }
      );
    }

    // Get the account for this channel
    const account = channel.discordAccounts[0];

    if (!account) {
      return NextResponse.json(
        { error: "Discord account not found for this channel" },
        { status: 404 }
      );
    }

    // Send message
    const discordService = new DiscordService(account);
    const success = await discordService.sendMessage(channelId, content);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to send Discord message" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending Discord message:", error);
    return NextResponse.json(
      { error: "Failed to send Discord message" },
      { status: 500 }
    );
  }
}

// PATCH handler to mark a Discord message as read
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { messageId, channelId } = body;

    if (!messageId || !channelId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify channel belongs to a discord account owned by the user
    const channel = await db.discordChannel.findFirst({
      where: {
        id: channelId,
        discordAccounts: {
          some: {
            userId: session.user.id,
          },
        },
      },
      include: {
        discordAccounts: true,
      },
    });

    if (!channel) {
      return NextResponse.json(
        { error: "Discord channel not found" },
        { status: 404 }
      );
    }

    // Get the account for this channel
    const account = channel.discordAccounts[0];

    if (!account) {
      return NextResponse.json(
        { error: "Discord account not found for this channel" },
        { status: 404 }
      );
    }

    // Mark message as read
    const discordService = new DiscordService(account);
    const success = await discordService.markMessageAsRead(messageId);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to mark Discord message as read" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking Discord message as read:", error);
    return NextResponse.json(
      { error: "Failed to mark Discord message as read" },
      { status: 500 }
    );
  }
}
