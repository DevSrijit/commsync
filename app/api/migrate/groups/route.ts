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
    
    // Get all groups for this user
    const groups = await db.group.findMany({
      where: { userId }
    });
    
    // Count of groups updated
    let updatedCount = 0;
    
    // Update each group to ensure it has phoneNumbers array
    for (const group of groups) {
      // Check if the phoneNumbers array is missing or not defined
      if (!group.phoneNumbers || !Array.isArray(group.phoneNumbers)) {
        await db.group.update({
          where: { id: group.id },
          data: { phoneNumbers: [] }
        });
        updatedCount++;
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Migration complete. Updated ${updatedCount} of ${groups.length} groups.` 
    });
  } catch (error) {
    console.error("Error migrating groups:", error);
    return NextResponse.json({ error: "Failed to migrate groups" }, { status: 500 });
  }
} 