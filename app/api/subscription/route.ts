import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getUserSubscriptionData,
  updateSubscriptionUsage,
  calculateUserCacheSize,
  countUserConnections,
} from "@/lib/subscription";

/**
 * GET /api/subscription
 * Fetch the current user's subscription data
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id as string;

    // Check if we should update usage data (pass updateUsage=true query param)
    const searchParams = request.nextUrl.searchParams;
    const shouldUpdateUsage = searchParams.get("updateUsage") === "true";

    // Get subscription data, optionally updating usage
    const subscriptionData = await getUserSubscriptionData(
      userId,
      shouldUpdateUsage
    );

    if (!subscriptionData) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      subscription: subscriptionData,
    });
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription data" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/subscription
 * Update subscription usage data
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id as string;

    // Get current subscription without updating usage yet
    const subscriptionData = await getUserSubscriptionData(userId, false);

    if (!subscriptionData) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 404 }
      );
    }

    // Calculate current usage
    const userStorageUsed = await calculateUserCacheSize(userId);
    const userConnections = await countUserConnections(userId);

    // Parse request body for AI credits update
    const body = await request.json();
    const aiCreditsUsed = body.aiCreditsUsed || 0;

    // Update subscription usage
    const updatedSubscription = await updateSubscriptionUsage(
      subscriptionData.id,
      userStorageUsed,
      userConnections,
      aiCreditsUsed
    );

    if (!updatedSubscription) {
      return NextResponse.json(
        { error: "Failed to update subscription" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      subscription: {
        id: updatedSubscription.id,
        planType: updatedSubscription.planType,
        status: updatedSubscription.status,
        usedStorage: updatedSubscription.usedStorage,
        totalStorage: updatedSubscription.totalStorage,
        usedConnections: updatedSubscription.usedConnections,
        totalConnections: updatedSubscription.totalConnections,
        usedAiCredits: updatedSubscription.usedAiCredits,
        totalAiCredits: updatedSubscription.totalAiCredits,
      },
    });
  } catch (error) {
    console.error("Error updating subscription:", error);
    return NextResponse.json(
      { error: "Failed to update subscription data" },
      { status: 500 }
    );
  }
}
