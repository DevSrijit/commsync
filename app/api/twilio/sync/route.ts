import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncTwilioMessages } from "@/lib/twilio";
import { z } from "zod";

const syncSchema = z.object({
  twilioAccountId: z.string().min(1, "Twilio account ID is required"),
});

export async function POST(req: Request) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validationResult = syncSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { twilioAccountId } = validationResult.data;

    // Verify that the Twilio account belongs to this user
    const twilioAccount = await db.twilioAccount.findUnique({
      where: {
        id: twilioAccountId,
        userId: session.user.id,
      },
    });

    if (!twilioAccount) {
      return NextResponse.json(
        { error: "Twilio account not found or not authorized" },
        { status: 404 }
      );
    }

    // Sync messages
    const results = await syncTwilioMessages(twilioAccountId);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Error syncing Twilio messages:", error);
    return NextResponse.json(
      { error: "An error occurred while syncing Twilio messages" },
      { status: 500 }
    );
  }
} 