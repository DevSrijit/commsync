import { Twilio, twiml } from "twilio";
import { db } from "@/lib/db";

type TwilioMessageInput = {
  twilioAccountId: string;
  messageSid: string;
  from: string;
  to: string;
  body: string;
  status: string;
  direction: "inbound" | "outbound";
  sentAt: Date;
};

export async function saveTwilioMessage(messageData: TwilioMessageInput) {
  try {
    // First save the Twilio message
    const twilioMessage = await db.twilioMessage.create({
      data: {
        twilioAccountId: messageData.twilioAccountId,
        messageSid: messageData.messageSid,
        from: messageData.from,
        to: messageData.to,
        body: messageData.body,
        status: messageData.status,
        direction: messageData.direction,
        sentAt: messageData.sentAt,
      },
    });

    // Find or create a contact based on the phone number
    const phoneNumber = messageData.direction === "inbound" ? messageData.from : messageData.to;
    
    // Get the Twilio account to find the user ID
    const twilioAccount = await db.twilioAccount.findUnique({
      where: { id: messageData.twilioAccountId },
    });
    
    if (!twilioAccount) {
      throw new Error(`Twilio account not found: ${messageData.twilioAccountId}`);
    }
    
    // Look for an existing contact with this phone number
    let contact = await db.contact.findFirst({
      where: {
        userId: twilioAccount.userId,
        phone: phoneNumber,
      },
    });
    
    // If no contact exists, create one
    if (!contact) {
      contact = await db.contact.create({
        data: {
          userId: twilioAccount.userId,
          name: phoneNumber, // Use phone number as name initially
          phone: phoneNumber,
        },
      });
      
      // Create a sender record for this contact
      await db.sender.create({
        data: {
          contactId: contact.id,
          platform: "twilio",
          identifier: phoneNumber,
        },
      });
    }
    
    // Find or create a conversation for this contact
    let conversation = await db.conversation.findFirst({
      where: {
        contactId: contact.id,
      },
    });
    
    if (!conversation) {
      conversation = await db.conversation.create({
        data: {
          contactId: contact.id,
          title: `Conversation with ${contact.name}`,
          lastActivity: new Date(),
        },
      });
    } else {
      // Update the last activity timestamp
      await db.conversation.update({
        where: { id: conversation.id },
        data: { lastActivity: new Date() },
      });
    }
    
    // Update the Twilio message with the conversation ID
    await db.twilioMessage.update({
      where: { id: twilioMessage.id },
      data: { conversationId: conversation.id },
    });
    
    // Create a regular message record for the conversation view
    await db.message.create({
      data: {
        conversationId: conversation.id,
        platform: "twilio",
        externalId: messageData.messageSid,
        direction: messageData.direction,
        content: messageData.body,
        contentType: "text",
        sentAt: messageData.sentAt,
        receivedAt: new Date(),
        isRead: messageData.direction === "outbound", // Outbound messages are considered read
        syncAccountId: null, // We're not using syncAccount for Twilio, we have our own model
        metadata: {
          twilioMessageId: twilioMessage.id,
          twilioAccountId: messageData.twilioAccountId,
          from: messageData.from,
          to: messageData.to,
          status: messageData.status,
        },
      },
    });
    
    return twilioMessage;
  } catch (error) {
    console.error("Error saving Twilio message:", error);
    throw error;
  }
}

export async function sendTwilioMessage(
  twilioAccountId: string,
  to: string,
  body: string
) {
  try {
    // Get the Twilio account
    const twilioAccount = await db.twilioAccount.findUnique({
      where: { id: twilioAccountId },
    });
    
    if (!twilioAccount) {
      throw new Error(`Twilio account not found: ${twilioAccountId}`);
    }
    
    // Create a Twilio client
    const client = new Twilio(twilioAccount.accountSid, twilioAccount.authToken);
    
    // Send the message
    const message = await client.messages.create({
      body,
      from: twilioAccount.phoneNumber,
      to,
    });
    
    // Save the sent message
    const twilioMessage = await saveTwilioMessage({
      twilioAccountId,
      messageSid: message.sid,
      from: twilioAccount.phoneNumber,
      to,
      body,
      status: message.status,
      direction: "outbound",
      sentAt: new Date(),
    });
    
    return twilioMessage;
  } catch (error) {
    console.error("Error sending Twilio message:", error);
    throw error;
  }
}

export async function syncTwilioMessages(twilioAccountId: string) {
  try {
    // Get the Twilio account
    const twilioAccount = await db.twilioAccount.findUnique({
      where: { id: twilioAccountId },
    });
    
    if (!twilioAccount) {
      throw new Error(`Twilio account not found: ${twilioAccountId}`);
    }
    
    // Create a Twilio client
    const client = new Twilio(twilioAccount.accountSid, twilioAccount.authToken);
    
    // Get the most recent message we've synced
    const mostRecentMessage = await db.twilioMessage.findFirst({
      where: {
        twilioAccountId,
      },
      orderBy: {
        sentAt: "desc",
      },
    });
    
    // Fetch messages from Twilio API
    const messages = await client.messages.list({
      limit: 100, // Adjust as needed
      // If we have a recent message, only get messages after that
      dateSentAfter: mostRecentMessage 
        ? new Date(mostRecentMessage.sentAt) 
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default to 30 days back
    });
    
    // Process each message
    const results = {
      processed: 0,
      skipped: 0,
      failed: 0,
    };
    
    for (const message of messages) {
      try {
        // Check if we already have this message
        const existingMessage = await db.twilioMessage.findUnique({
          where: {
            messageSid: message.sid,
          },
        });
        
        if (existingMessage) {
          results.skipped++;
          continue;
        }
        
        // Save the message
        await saveTwilioMessage({
          twilioAccountId,
          messageSid: message.sid,
          from: message.from,
          to: message.to,
          body: message.body || "",
          status: message.status,
          direction: message.direction === "inbound" ? "inbound" : "outbound",
          sentAt: new Date(message.dateSent || message.dateCreated),
        });
        
        results.processed++;
      } catch (error) {
        console.error(`Error processing Twilio message ${message.sid}:`, error);
        results.failed++;
      }
    }
    
    // Update the last sync timestamp
    await db.twilioAccount.update({
      where: { id: twilioAccountId },
      data: { lastSync: new Date() },
    });
    
    return results;
  } catch (error) {
    console.error("Error syncing Twilio messages:", error);
    throw error;
  }
} 