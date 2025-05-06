import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the platform from URL params
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform");

    if (!platform) {
      return NextResponse.json(
        { error: "Platform parameter is required" },
        { status: 400 }
      );
    }

    // Get accounts for the specified platform and user
    const accounts = await db.syncAccount.findMany({
      where: {
        userId: session.user.id,
        platform: platform,
      },
    });

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("Error fetching sync accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch sync accounts" },
      { status: 500 }
    );
  }
}
