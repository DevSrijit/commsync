import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import axios from "axios";
import { DiscordChannel } from "@prisma/client";
export async function DELETE(
  req: NextRequest,
  { params }: { params: { accountId: string } }
) {
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
    const accountId = params.accountId;

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

    // Unregister from middleware
    try {
      const middlewareUrl =
        process.env.DISCORD_MIDDLEWARE_URL || "http://localhost:3001";
      await axios.post(`${middlewareUrl}/unregister`, {
        accountId: account.id,
      });
      console.log(`Discord account ${account.id} unregistered from middleware`);
    } catch (middlewareError) {
      console.error(
        "Error unregistering from Discord middleware:",
        middlewareError
      );
      // Continue with deletion even if middleware unregistration fails
    }

    // Delete associated Discord messages
    await db.discordMessage.deleteMany({
      where: {
        discordAccountId: accountId,
      },
    });

    // Find channels that are associated only with this account
    const channelIds = await db.discordChannel.findMany({
      where: {
        discordAccounts: {
          some: {
            id: accountId,
          },
          none: {
            id: {
              not: accountId,
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    // Delete channels that are only associated with this account
    if (channelIds.length > 0) {
      await db.discordChannel.deleteMany({
        where: {
          id: {
            in: channelIds.map((channel: DiscordChannel) => channel.id),
          },
        },
      });
    }

    // Remove account from channels that are shared with other accounts
    await db.discordChannel.updateMany({
      where: {
        discordAccounts: {
          some: {
            id: accountId,
          },
        },
      },
      data: {
        discordAccounts: {
          disconnect: {
            id: accountId,
          },
        },
      },
    });

    // Delete the account
    await db.discordAccount.delete({
      where: {
        id: accountId,
      },
    });

    return NextResponse.json(
      { success: true, message: "Discord account removed successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error removing Discord account:", error);

    return NextResponse.json(
      {
        error: "ServerError",
        message: "An error occurred while removing your Discord account",
      },
      { status: 500 }
    );
  }
}
