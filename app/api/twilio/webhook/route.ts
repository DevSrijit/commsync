import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { TwilioService } from '@/lib/twilio-service';
import { saveTwilioMessage } from "@/lib/twilio";

// Process a Twilio webhook event
export async function POST(req: NextRequest) {
  try {
    // Twilio sends form data, not JSON
    const formData = await req.formData();
    
    // Extract SMS information from the Twilio webhook
    const messageSid = formData.get("MessageSid") as string;
    const from = formData.get("From") as string;
    const to = formData.get("To") as string;
    const body = formData.get("Body") as string;
    const status = formData.get("SmsStatus") as string;
    
    // Validate required fields
    if (!messageSid || !from || !to || !body) {
      console.error("Missing required SMS fields", { messageSid, from, to, body });
      return NextResponse.json({ error: "Missing required SMS fields" }, { status: 400 });
    }
    
    // Find the Twilio account by the 'to' phone number
    const twilioAccount = await db.twilioAccount.findFirst({
      where: {
        phoneNumber: to,
      },
    });
    
    if (!twilioAccount) {
      console.error(`No Twilio account found for phone number: ${to}`);
      return NextResponse.json({ error: "Twilio account not found" }, { status: 404 });
    }
    
    // Check if this message has already been processed
    const existingMessage = await db.twilioMessage.findUnique({
      where: {
        messageSid,
      },
    });
    
    if (existingMessage) {
      console.log(`Message ${messageSid} already processed, updating status to ${status}`);
      // Update the status if it changed
      if (existingMessage.status !== status) {
        await db.twilioMessage.update({
          where: { id: existingMessage.id },
          data: { status },
        });
      }
      return NextResponse.json({ success: true, status: "updated" });
    }
    
    // Process and save the new message
    await saveTwilioMessage({
      twilioAccountId: twilioAccount.id,
      messageSid,
      from,
      to,
      body,
      status,
      direction: "inbound",
      sentAt: new Date(),
    });
    
    return NextResponse.json({ success: true, status: "processed" });
  } catch (error) {
    console.error("Error processing Twilio webhook:", error);
    return NextResponse.json(
      { error: "An error occurred while processing the webhook" },
      { status: 500 }
    );
  }
} 