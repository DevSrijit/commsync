import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import axios from "axios";

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
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "Bad Request", message: "Discord account ID is required" },
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

    // Trigger sync with middleware
    try {
      const middlewareUrl =
        process.env.DISCORD_MIDDLEWARE_URL || "http://localhost:3001";
      const response = await axios.post(`${middlewareUrl}/sync`, {
        accountId: account.id,
      });

      if (response.status === 200) {
        // Update last sync time
        await db.discordAccount.update({
          where: { id: account.id },
          data: { lastSync: new Date() },
        });

        return NextResponse.json({
          success: true,
          message: "Discord messages synchronized successfully",
        });
      } else {
        throw new Error(`Middleware returned status ${response.status}`);
      }
    } catch (error) {
      console.error("Error syncing with Discord middleware:", error);
      return NextResponse.json(
        {
          error: "SyncError",
          message:
            "Failed to sync Discord messages. The middleware service may be unavailable.",
        },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Error in Discord sync route:", error);

    return NextResponse.json(
      {
        error: "ServerError",
        message: "An error occurred while syncing Discord messages",
      },
      { status: 500 }
    );
  }
}
