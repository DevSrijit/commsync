import { SyncAccountModel, JustCallMessage } from '@/lib/types';
import { decryptData } from '@/lib/encryption';   
import { db } from '@/lib/db';

export class JustCallService {
  private apiKey: string;
  private apiSecret: string;
  private accountId: string;

  constructor(syncAccount: SyncAccountModel) {
    const credentials = decryptData(syncAccount.accountIdentifier);
    this.apiKey = credentials.apiKey;
    this.apiSecret = credentials.apiSecret;
    this.accountId = syncAccount.id;
  }

  private getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}:${this.apiSecret}`,
      'Content-Type': 'application/json',
    };
  }

  async getMessages(phoneNumber?: string, fromDate?: Date, limit = 100): Promise<JustCallMessage[]> {
    try {
      let url = `https://api.justcall.io/v1/texts?limit=${limit}`;
      
      if (phoneNumber) {
        url += `&number=${encodeURIComponent(phoneNumber)}`;
      }
      
      if (fromDate) {
        url += `&from=${fromDate.toISOString()}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`JustCall API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Failed to fetch JustCall messages:', error);
      throw error;
    }
  }

  async sendMessage(to: string, body: string, media?: string[]): Promise<JustCallMessage> {
    try {
      const payload: any = {
        to,
        body,
      };

      if (media && media.length > 0) {
        payload.media = media;
      }

      const response = await fetch('https://api.justcall.io/v1/texts/send', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`JustCall API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Failed to send JustCall message:', error);
      throw error;
    }
  }

  // Process a new message from JustCall webhook
  async processIncomingMessage(message: JustCallMessage): Promise<void> {
    try {
      // Get the syncAccount
      const syncAccount = await db.syncAccount.findFirst({
        where: { id: this.accountId }
      });

      if (!syncAccount) {
        throw new Error(`Sync account not found: ${this.accountId}`);
      }

      // Find or create contact based on the phone number
      const phoneNumber = message.contact_number;
      const contactName = message.contact_name || phoneNumber;

      // Find sender by phone number and platform
      const existingSender = await db.sender.findFirst({
        where: {
          platform: 'justcall',
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
                platform: 'justcall',
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

      // Create the message
      await db.message.create({
        data: {
          conversationId: conversation.id,
          syncAccountId: syncAccount.id,
          platform: 'justcall',
          externalId: message.id,
          direction: message.direction,
          content: message.body,
          contentType: 'text',
          metadata: JSON.stringify(message),
          attachments: message.media ? JSON.stringify(message.media) : null,
          sentAt: new Date(message.created_at),
          isRead: false,
        },
      });

      // Update conversation last activity
      await db.conversation.update({
        where: { id: conversation.id },
        data: { lastActivity: new Date() },
      });

    } catch (error) {
      console.error('Failed to process incoming JustCall message:', error);
      throw error;
    }
  }
} 