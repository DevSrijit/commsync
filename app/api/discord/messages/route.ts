import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { DiscordService } from "@/lib/discord-service";
import axios from "axios";
import { DiscordMessage } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    // Ensure user is authenticated
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          details: "You must be logged in to access Discord messages",
        },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Extract parameters from query string
    const url = new URL(req.url);
    const channelId = url.searchParams.get("channelId");
    const limit = url.searchParams.get("limit")
      ? parseInt(url.searchParams.get("limit")!)
      : 50;
    const before = url.searchParams.get("before") || undefined;

    if (!channelId) {
      return NextResponse.json(
        { error: "MissingChannelId", details: "Channel ID is required" },
        { status: 400 }
      );
    }

    // Check if the channel belongs to the user
    const channel = await db.discordChannel.findFirst({
      where: {
        id: channelId,
        discordAccounts: {
          some: {
            userId,
          },
        },
      },
      include: {
        discordAccounts: {
          where: {
            userId,
          },
          take: 1,
        },
      },
    });

    if (!channel || channel.discordAccounts.length === 0) {
      return NextResponse.json(
        {
          error: "ChannelNotFound",
          details: "Discord channel not found or doesn't belong to you",
        },
        { status: 404 }
      );
    }

    // Get messages for this channel
    const messages = await db.discordMessage.findMany({
      where: {
        channelId,
        ...(before ? { id: { lt: before } } : {}),
      },
      orderBy: {
        timestamp: "desc",
      },
      take: limit,
    });

    // Mark messages as read
    const unreadMessageIds = messages
      .filter((message: DiscordMessage) => !message.isRead)
      .map((message: DiscordMessage) => message.id);

    if (unreadMessageIds.length > 0) {
      await db.discordMessage.updateMany({
        where: {
          id: {
            in: unreadMessageIds,
          },
        },
        data: {
          isRead: true,
        },
      });
    }

    return NextResponse.json(messages);
  } catch (error) {
    console.error("Error fetching Discord messages:", error);

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

export async function POST(req: NextRequest) {
  try {
    // Get the auth session to ensure user is logged in
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be logged in" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await req.json();
    const { accountId, channelId, content } = body;

    if (!accountId || !channelId || !content) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message:
            "Discord account ID, channel ID, and message content are required",
        },
        { status: 400 }
      );
    }

    // Verify account belongs to user
    const account = await db.discordAccount.findFirst({
      where: {
        id: accountId,
        userId,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Not Found", message: "Discord account not found" },
        { status: 404 }
      );
    }

    // Verify channel exists and is associated with the account
    const channel = await db.discordChannel.findFirst({
      where: {
        id: channelId,
        discordAccounts: {
          some: {
            id: accountId,
          },
        },
      },
    });

    if (!channel) {
      return NextResponse.json(
        { error: "Not Found", message: "Discord channel not found" },
        { status: 404 }
      );
    }

    // Send message via middleware
    try {
      const middlewareUrl =
        process.env.DISCORD_MIDDLEWARE_URL || "http://localhost:3001";
      const response = await axios.post(`${middlewareUrl}/send-message`, {
        accountId: account.id,
        discordChannelId: channel.discordChannelId,
        content,
      });

      if (response.status === 200 && response.data.success) {
        // The message was already stored in the database by the middleware
        return NextResponse.json({
          success: true,
          message: response.data.message,
        });
      } else {
        throw new Error(`Middleware returned status ${response.status}`);
      }
    } catch (error) {
      console.error("Error sending message via Discord middleware:", error);
      return NextResponse.json(
        {
          error: "MessageError",
          message:
            "Failed to send Discord message. The middleware service may be unavailable.",
        },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Error sending Discord message:", error);

    return NextResponse.json(
      {
        error: "ServerError",
        message: "An error occurred while sending the Discord message",
      },
      { status: 500 }
    );
  }
}
