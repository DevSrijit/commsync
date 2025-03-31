import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

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
