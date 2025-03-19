import { SyncAccountModel } from '@/lib/types';
import { decryptData } from '@/lib/encryption';
import { db } from '@/lib/db';

interface TwilioMessage {
  accountId: string;
  sid: string;
  body: string;
  direction: 'inbound' | 'outbound-api' | 'outbound-reply';
  from: string;
  to: string;
  date_created: string;
  date_updated: string;
  status: string;
  media?: TwilioMedia[];
  num_media?: string;
}

interface TwilioMedia {
  sid: string;
  content_type: string;
  url: string;
  filename?: string;
}

export class TwilioService {
  private accountSid: string;
  private authToken: string;
  private phoneNumber: string;
  private accountId: string;

  constructor(syncAccount: SyncAccountModel) {
    try {
      let credentials;
      
      // Try to get credentials from both possible fields
      if (syncAccount.credentials) {
        // Primary location - credentials field
        credentials = decryptData(syncAccount.credentials);
      } else if (syncAccount.accountIdentifier) {
        // Legacy location - accountIdentifier field
        credentials = decryptData(syncAccount.accountIdentifier);
      } else {
        throw new Error('No credentials found for Twilio account');
      }
      
      // Handle string format (JSON string)
      if (typeof credentials === 'string') {
        try {
          credentials = JSON.parse(credentials);
        } catch (e) {
          console.error('Failed to parse Twilio credentials JSON:', e);
          throw new Error('Invalid Twilio credentials format');
        }
      }
      
      this.accountSid = credentials.accountSid;
      this.authToken = credentials.authToken;
      this.phoneNumber = credentials.phoneNumber;
      this.accountId = syncAccount.id;
      
      if (!this.accountSid || !this.authToken || !this.phoneNumber) {
        throw new Error('Invalid Twilio credentials: missing required fields');
      }
    } catch (error) {
      console.error('Error initializing Twilio service:', error);
      throw new Error('Failed to initialize Twilio service: Invalid credentials');
    }
  }

  private getAuthHeader() {
    return 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
  }

  async getMessages(fromDate?: Date, limit = 100): Promise<TwilioMessage[]> {
    try {
      let url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json?PageSize=${limit}`;
      
      if (fromDate) {
        // Format date as YYYY-MM-DD
        const dateStr = fromDate.toISOString().split('T')[0];
        url += `&DateSent>=${dateStr}`;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Twilio API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.messages || [];
    } catch (error) {
      console.error('Failed to fetch Twilio messages:', error);
      throw error;
    }
  }

  async sendMessage(to: string, body: string, mediaUrls?: string[]): Promise<any> {
    try {
      const formData = new URLSearchParams();
      formData.append('To', to);
      formData.append('From', this.phoneNumber);
      formData.append('Body', body);
      
      // Add media URLs if provided
      if (mediaUrls && mediaUrls.length > 0) {
        mediaUrls.forEach(url => {
          formData.append('MediaUrl', url);
        });
      }
      
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Twilio API error: ${errorData.message || response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to send Twilio message:', error);
      throw error;
    }
  }

  // Process a new message from Twilio webhook
  async processIncomingMessage(message: TwilioMessage | null): Promise<void> {
    // Skip processing if message is null
    if (!message) {
      console.log('Skipping null Twilio message');
      return;
    }
    
    // Validate required fields
    if (!message.sid || !message.from) {
      console.error('Invalid Twilio message format - missing required fields:', message);
      return;
    }
    
    try {
      // Get the syncAccount
      const syncAccount = await db.syncAccount.findFirst({
        where: { id: this.accountId }
      });

      if (!syncAccount) {
        throw new Error(`Sync account not found: ${this.accountId}`);
      }

      // Find or create contact based on the phone number
      const phoneNumber = message.from;
      // Use a simple name derived from the phone number for now
      // In a real app, you might want to do contact lookup
      const contactName = `Contact ${phoneNumber.slice(-4)}`;

      // Find sender by phone number and platform
      const existingSender = await db.sender.findFirst({
        where: {
          platform: 'twilio',
          identifier: phoneNumber,
        },
        include: {
          contact: true,
        },
      });

      let contactId: string;

      if (existingSender) {
        // Use existing contact
        contactId = existingSender.contactId;
      } else {
        // Create new contact and sender
        const newContact = await db.contact.create({
          data: {
            userId: syncAccount.userId,
            name: contactName,
            phone: phoneNumber,
            senders: {
              create: {
                platform: 'twilio',
                identifier: phoneNumber,
              },
            },
          },
        });
        contactId = newContact.id;
      }

      // Find or create conversation
      let conversation = await db.conversation.findFirst({
        where: {
          contactId,
        },
      });

      if (!conversation) {
        conversation = await db.conversation.create({
          data: {
            contactId,
            title: `Conversation with ${contactName}`,
          },
        });
      }
      
      // Process media attachments if any
      const attachments = message.media && message.media.length > 0 
        ? JSON.stringify(message.media) 
        : null;

      // Create the message
      await db.message.create({
        data: {
          conversationId: conversation.id,
          syncAccountId: syncAccount.id,
          platform: 'twilio',
          externalId: message.sid,
          direction: message.direction === 'inbound' ? 'inbound' : 'outbound',
          content: message.body,
          contentType: 'text',
          metadata: JSON.stringify(message),
          attachments,
          sentAt: new Date(message.date_created),
          isRead: false,
        },
      });

      // Update conversation last activity
      await db.conversation.update({
        where: { id: conversation.id },
        data: { lastActivity: new Date() },
      });

    } catch (error) {
      console.error('Failed to process incoming Twilio message:', error);
      throw error;
    }
  }
} 