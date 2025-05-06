import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    // Get the current session
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { isOnboarded } = await req.json();

    // Ensure we have a valid boolean value
    if (typeof isOnboarded !== "boolean") {
      return NextResponse.json(
        { message: "isOnboarded must be a boolean value" },
        { status: 400 }
      );
    }

    // Update the user's onboarding status
    await db.user.update({
      where: { id: session.user.id },
      data: { isOnboarded },
    });

    return NextResponse.json({
      message: "Onboarding status updated successfully",
      isOnboarded,
    });
  } catch (error) {
    console.error("Error updating onboarding status:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
