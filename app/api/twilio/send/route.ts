import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
import { TwilioService } from "@/lib/twilio-service";
import { z } from "zod";

const sendSmsSchema = z.object({
  twilioAccountId: z.string().min(1, "Twilio account ID is required"),
  to: z.string().min(1, "Recipient phone number is required"),
  body: z.string().min(1, "Message body is required"),
  mediaUrls: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
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

    const { twilioAccountId, to, body: messageBody, mediaUrls } = validationResult.data;

    // Verify that the Twilio account belongs to this user
    const twilioAccount = await db.syncAccount.findFirst({
      where: {
        id: twilioAccountId,
        userId: session.user.id,
        platform: 'twilio'
      },
    });

    if (!twilioAccount) {
      return NextResponse.json(
        { error: "Twilio account not found or not authorized" },
        { status: 404 }
      );
    }

    // Send the message
    const twilioService = new TwilioService(twilioAccount);
    const message = await twilioService.sendMessage(to, messageBody, mediaUrls);

    // Format the message as Email type for consistent handling in UI
    const formattedMessage = {
      id: message.sid || `sent-${Date.now()}`,
      threadId: [to, twilioAccount.accountIdentifier].sort().join('-'),
      from: {
        name: 'You',
        email: twilioAccount.accountIdentifier,
      },
      to: [{
        name: 'Contact',
        email: to,
      }],
      subject: 'SMS Message',
      body: messageBody,
      date: new Date().toISOString(),
      labels: ['SMS', 'sent'],
      accountType: 'twilio',
      accountId: twilioAccount.id,
      platform: 'twilio'
    };

    return NextResponse.json({
      success: true,
      message: formattedMessage
    });
  } catch (error: any) {
    console.error("Error sending SMS:", error);
    return NextResponse.json(
      { error: error.message || "An error occurred while sending the SMS" },
      { status: 500 }
    );
  }
} 