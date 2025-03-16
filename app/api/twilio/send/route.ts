import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendTwilioMessage } from "@/lib/twilio";
import { z } from "zod";

const sendSmsSchema = z.object({
  twilioAccountId: z.string().min(1, "Twilio account ID is required"),
  to: z.string().min(1, "Recipient phone number is required"),
  body: z.string().min(1, "Message body is required"),
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
    const validationResult = sendSmsSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { twilioAccountId, to, body: messageBody } = validationResult.data;

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

    // Send the message
    const message = await sendTwilioMessage(
      twilioAccountId,
      to,
      messageBody
    );

    return NextResponse.json({
      success: true,
      messageSid: message.messageSid,
    });
  } catch (error) {
    console.error("Error sending SMS:", error);
    return NextResponse.json(
      { error: "An error occurred while sending the SMS" },
      { status: 500 }
    );
  }
} 