import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Organization, Subscription, User } from "@prisma/client";

/**
 * GET /api/organization
 * Get the user's organization and members
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id as string;

    // Find the user with their organizations
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        organizations: {
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
            members: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
            subscription: true,
          },
        },
        ownedOrganizations: {
          include: {
            members: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
            subscription: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Find organization with subscription
    const organization =
      user.organizations.find((org: Organization & { subscription: Subscription | null }) => org.subscription) ||
      user.ownedOrganizations.find((org: Organization & { subscription: Subscription | null }) => org.subscription);

    if (!organization) {
      return NextResponse.json(
        { error: "No organization with subscription found" },
        { status: 404 }
      );
    }

    // Prepare response data
    const isAdmin = organization.ownerId === userId;

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        accessKey: organization.id, // Use org ID as access key
        members: organization.members.map((member: User) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          image: member.image,
          isAdmin: member.id === organization.ownerId,
        })),
        subscription: organization.subscription
          ? {
              status: organization.subscription.status,
              plan: organization.subscription.planType,
              maxUsers: organization.subscription.maxUsers,
              usedStorage: organization.subscription.usedStorage,
              totalStorage: organization.subscription.totalStorage,
              usedConnections: organization.subscription.usedConnections,
              totalConnections: organization.subscription.totalConnections,
              usedAiCredits: organization.subscription.usedAiCredits,
              totalAiCredits: organization.subscription.totalAiCredits,
            }
          : null,
        isAdmin,
      },
    });
  } catch (error) {
    console.error("Error fetching organization:", error);
    return NextResponse.json(
      { error: "Failed to fetch organization data" },
      { status: 500 }
    );
  }
}

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
      (member: User) => member.id === userId
    );
    if (isMember) {
      return NextResponse.json({
        message: "You are already a member of this organization",
      });
    }

    // Check if the organization has an active subscription
    if (!organization.subscription) {
      return NextResponse.json(
        { error: "This organization does not have an active subscription" },
        { status: 400 }
      );
    }

    // Check if the organization has reached its member limit
    if (organization.members.length >= organization.subscription.maxUsers) {
      return NextResponse.json(
        { error: "This organization has reached its member limit" },
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

/**
 * DELETE /api/organization/members
 * Remove a member from an organization (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id as string;
    const { memberId, organizationId } = await request.json();

    if (!memberId || !organizationId) {
      return NextResponse.json(
        { error: "Member ID and organization ID are required" },
        { status: 400 }
      );
    }

    // Find the organization
    const organization = await db.organization.findUnique({
      where: { id: organizationId },
      include: { owner: true },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check if the user is the organization owner
    if (organization.owner.id !== userId) {
      return NextResponse.json(
        { error: "Only the organization admin can remove members" },
        { status: 403 }
      );
    }

    // Cannot remove the owner
    if (memberId === organization.owner.id) {
      return NextResponse.json(
        { error: "Cannot remove the organization admin" },
        { status: 400 }
      );
    }

    // Remove the member
    await db.organization.update({
      where: { id: organizationId },
      data: {
        members: {
          disconnect: {
            id: memberId,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Member removed successfully",
    });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
