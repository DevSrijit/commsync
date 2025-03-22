import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserIdFromSession } from "@/lib/auth-utils";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const userId = await getUserIdFromSession(session);
    const groups = await db.group.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });

    return NextResponse.json({ groups });
  } catch (error) {
    console.error("Error fetching groups:", error);
    return NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { action, group } = await req.json();
    const userId = await getUserIdFromSession(session);

    // Create a new group
    if (action === "create") {
      const newGroup = await db.group.create({
        data: {
          name: group.name,
          addresses: group.addresses,
          phoneNumbers: group.phoneNumbers || [],
          userId
        }
      });

      // Return all groups for the user after creation
      const groups = await db.group.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' }
      });

      return NextResponse.json({ success: true, groups });
    }

    // Update an existing group
    if (action === "update") {
      const updatedGroup = await db.group.update({
        where: { 
          id: group.id,
          userId // Ensure user owns this group
        },
        data: {
          name: group.name,
          addresses: group.addresses,
          phoneNumbers: group.phoneNumbers || [],
          updatedAt: new Date()
        }
      });

      // Return all groups for the user after update
      const groups = await db.group.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' }
      });

      return NextResponse.json({ success: true, groups });
    }

    // Delete a group
    if (action === "delete") {
      await db.group.delete({
        where: { 
          id: group.id,
          userId // Ensure user owns this group
        }
      });
      
      // Return all groups for the user after deletion
      const groups = await db.group.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' }
      });
      
      return NextResponse.json({ success: true, groups });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error processing group action:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}