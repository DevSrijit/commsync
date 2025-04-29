import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { DiscordChannel } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    // Ensure user is authenticated
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          details: "You must be logged in to access Discord channels",
        },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Extract parameters from query string
    const url = new URL(req.url);
    const accountId = url.searchParams.get("accountId");

    // Build query
    const query: any = {
      discordAccounts: {
        some: {
          userId,
          ...(accountId ? { id: accountId } : {}),
        },
      },
    };

    // Get channels
    const channels = await db.discordChannel.findMany({
      where: query,
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        // Get message count for each channel
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    // Get unread message counts
    const unreadCounts = await Promise.all(
      channels.map(async (channel: DiscordChannel) => {
        const unreadCount = await db.discordMessage.count({
          where: {
            channelId: channel.id,
            isRead: false,
          },
        });

        return {
          channelId: channel.id,
          unreadCount,
        };
      })
    );

    // Add unread counts to channels
    const channelsWithUnread = channels.map((channel: DiscordChannel) => {
      const unreadData = unreadCounts.find(
        (data) => data.channelId === channel.id
      );
      return {
        ...channel,
        unreadCount: unreadData?.unreadCount || 0,
      };
    });

    return NextResponse.json(channelsWithUnread);
  } catch (error) {
    console.error("Error fetching Discord channels:", error);

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
