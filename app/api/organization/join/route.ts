import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasActiveAccess } from "@/lib/subscription";

/**
 * POST /api/organization/join
 * Join an organization using an access key (organization ID)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id as string;
    const { accessKey } = await request.json();

    if (!accessKey) {
      return NextResponse.json(
        { error: "Access key is required" },
        { status: 400 }
      );
    }

    // Find the organization by ID (access key)
    const organization = await db.organization.findUnique({
      where: { id: accessKey },
      include: {
        subscription: true,
        members: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Invalid access key" },
        { status: 404 }
      );
    }

    // Check if the user is already a member
    const isMember = organization.members.some(
      (member) => member.id === userId
    );
    if (isMember) {
      return NextResponse.json({
        success: true,
        message: "You are already a member of this organization",
        redirect: "/dashboard",
      });
    }

    // Check if the organization has an active subscription
    if (
      !organization.subscription ||
      !hasActiveAccess(organization.subscription)
    ) {
      return NextResponse.json(
        {
          error: "This organization does not have an active subscription",
        },
        { status: 400 }
      );
    }

    // Check if the organization has reached its member limit
    if (organization.members.length >= organization.subscription.maxUsers) {
      return NextResponse.json(
        {
          error: "This organization has reached its member limit",
        },
        { status: 400 }
      );
    }

    // Add the user to the organization
    await db.organization.update({
      where: { id: organization.id },
      data: {
        members: {
          connect: {
            id: userId,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Successfully joined the organization",
      redirect: "/dashboard",
      organization: {
        id: organization.id,
        name: organization.name,
        subscription: organization.subscription
          ? {
              plan: organization.subscription.planType,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Error joining organization:", error);
    return NextResponse.json(
      { error: "Failed to join organization" },
      { status: 500 }
    );
  }
}
