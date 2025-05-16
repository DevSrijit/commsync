import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Update the last sync timestamp for a specific account
 * Used for various platforms including WhatsApp
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { accountId, platform } = await req.json();

    if (!accountId) {
      return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
    }

    // Update the syncAccount record with the current timestamp
    const updated = await db.syncAccount.update({
      where: {
        id: accountId,
        userId: session.user.id, // Ensure user owns this account
        ...(platform ? { platform } : {}), // Filter by platform if provided
      },
      data: {
        lastSync: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      accountId: updated.id,
      lastSync: updated.lastSync,
    });
  } catch (error) {
    console.error("Failed to update last sync time:", error);
    return NextResponse.json(
      { error: "Failed to update sync time" },
      { status: 500 }
    );
  }
}
