import { SyncAccountModel, JustCallMessage } from '@/lib/types';
import { decryptData } from '@/lib/encryption';   
import { db } from '@/lib/db';

export class JustCallService {
  private apiKey: string;
  private apiSecret: string;
  private accountId: string;
  private baseUrl = 'https://api.justcall.io/v2.1'; // Updated to v2.1 API

  constructor(syncAccount: SyncAccountModel) {
    try {
      const decryptedCredentials = decryptData(syncAccount.credentials);
      const credentials = typeof decryptedCredentials === 'string' 
        ? JSON.parse(decryptedCredentials) 
        : decryptedCredentials;
      
      this.apiKey = credentials.apiKey;
      this.apiSecret = credentials.apiSecret;
      this.accountId = syncAccount.id;
      
      if (!this.apiKey || !this.apiSecret) {
        throw new Error('Invalid JustCall credentials: API key or secret is missing');
      }
    } catch (error) {
      console.error('Error initializing JustCall service:', error);
      throw new Error('Failed to initialize JustCall service: Invalid credentials');
    }
  }

  private getAuthHeaders() {
    const basicAuth = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
    return {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
    };
  }

  async getMessages(phoneNumber?: string, fromDate?: Date, limit = 100): Promise<JustCallMessage[]> {
    try {
      // Using the V2 SMS endpoints as per the documentation
      let url = `${this.baseUrl}/texts`;
      const queryParams = new URLSearchParams();
      
      queryParams.append('per_page', limit.toString());
      
      if (phoneNumber) {
        queryParams.append('contact_number', phoneNumber);
      }
      
      if (fromDate) {
        queryParams.append('from_datetime', fromDate.toISOString());
      }

      url = `${url}?${queryParams.toString()}`;
      console.log('JustCall fetch URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const statusCode = response.status;
        let errorMessage = `JustCall API error (${statusCode}): ${response.statusText}`;
        
        if (statusCode === 401) {
          errorMessage = 'Unauthorized: JustCall API key or secret is invalid';
        } else if (statusCode === 403) {
          errorMessage = 'Forbidden: JustCall API access denied';
        } else if (statusCode === 404) {
          errorMessage = 'Requested JustCall resource does not exist';
        } else if (statusCode === 500) {
          errorMessage = 'JustCall server error. Please contact JustCall support.';
        } else if (errorData.message) {
          errorMessage = `JustCall API error: ${errorData.message}`;
        }
        
        console.error('JustCall API error:', { statusCode, errorData });
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('JustCall API response data:', JSON.stringify(data).substring(0, 500) + '...');
      
      const messages = data.data || [];
      if (!Array.isArray(messages)) {
        console.error('JustCall API returned unexpected data format:', data);
        return [];
      }
      
      // Map the API response to our expected JustCallMessage format
      return messages.map((message: any): JustCallMessage => {
        if (!message) {
          throw new Error('Received null message from JustCall API');
        }
        
        // Handle potential format differences between v1 and v2.1
        return {
          id: message.id?.toString() || '',
          number: message.justcall_number || '',
          contact_number: message.contact_number || message.client_number || '',
          body: message.body || '',
          direction: message.direction === '1' || message.direction === 1 || 
                   message.direction === 'Incoming' || message.direction === 'incoming' ? 
                   'inbound' : 'outbound',
          created_at: message.datetime || message.created_at || new Date().toISOString(),
          updated_at: message.updated_at || message.datetime || new Date().toISOString(),
          status: message.delivery_status || message.status || '',
          agent_id: message.agent_id?.toString() || '',
          contact_id: message.contact_id?.toString() || '',
          contact_name: message.contact_name || '',
          media: message.mms || [], 
        };
      }).filter(Boolean); // Remove null messages
    } catch (error) {
      console.error('Failed to fetch JustCall messages:', error);
      throw error;
    }
  }

  async sendMessage(to: string, body: string, media?: string[]): Promise<JustCallMessage> {
    try {
      // Using the V2 SMS send endpoint
      const url = `${this.baseUrl}/texts/send`;
      
      const payload: any = {
        to,
        body,
      };

      if (media && media.length > 0) {
        payload.media = media;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const statusCode = response.status;
        let errorMessage = `JustCall API error (${statusCode}): ${response.statusText}`;
        
        if (statusCode === 401) {
          errorMessage = 'Unauthorized: JustCall API key or secret is invalid';
        } else if (statusCode === 403) {
          errorMessage = 'Forbidden: JustCall API access denied';
        } else if (statusCode === 404) {
          errorMessage = 'Requested JustCall resource does not exist';
        } else if (statusCode === 500) {
          errorMessage = 'JustCall server error. Please contact JustCall support.';
        } else if (errorData.message) {
          errorMessage = `JustCall API error: ${errorData.message}`;
        }
        
        console.error('JustCall API error:', { statusCode, errorData });
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Failed to send JustCall message:', error);
      throw error;
    }
  }

  // Process a new message from JustCall webhook
  async processIncomingMessage(message: JustCallMessage | null): Promise<void> {
    // Skip processing if message is null
    if (!message) {
      console.log('Skipping null JustCall message');
      return;
    }
    
    // Validate required fields
    if (!message.id || !message.contact_number) {
      console.error('Invalid JustCall message format - missing required fields:', message);
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
          content: message.body || '',
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

  // New methods for V2 API

  // Get phone numbers associated with the account
  async getPhoneNumbers(): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/phone-numbers`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const statusCode = response.status;
        let errorMessage = `JustCall API error (${statusCode}): ${response.statusText}`;
        
        if (statusCode === 401) {
          errorMessage = 'Unauthorized: JustCall API key or secret is invalid';
        } else if (statusCode === 403) {
          errorMessage = 'Forbidden: JustCall API access denied';
        } else if (statusCode === 404) {
          errorMessage = 'Requested JustCall resource does not exist';
        } else if (statusCode === 500) {
          errorMessage = 'JustCall server error. Please contact JustCall support.';
        } else if (errorData.message) {
          errorMessage = `JustCall API error: ${errorData.message}`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Failed to fetch JustCall phone numbers:', error);
      throw error;
    }
  }

  // Get call history
  async getCalls(params: { 
    fromDatetime?: string, 
    toDatetime?: string, 
    contactNumber?: string,
    justcallNumber?: string,
    callDirection?: 'Incoming' | 'Outgoing',
    page?: number,
    perPage?: number 
  } = {}): Promise<any[]> {
    try {
      let url = `${this.baseUrl}/calls`;
      const queryParams = new URLSearchParams();
      
      if (params.fromDatetime) {
        queryParams.append('from_datetime', params.fromDatetime);
      }
      
      if (params.toDatetime) {
        queryParams.append('to_datetime', params.toDatetime);
      }
      
      if (params.contactNumber) {
        queryParams.append('contact_number', params.contactNumber);
      }
      
      if (params.justcallNumber) {
        queryParams.append('justcall_number', params.justcallNumber);
      }
      
      if (params.callDirection) {
        queryParams.append('call_direction', params.callDirection);
      }
      
      if (params.page) {
        queryParams.append('page', params.page.toString());
      }
      
      if (params.perPage) {
        queryParams.append('per_page', params.perPage.toString());
      }
      
      if (queryParams.toString()) {
        url = `${url}?${queryParams.toString()}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const statusCode = response.status;
        let errorMessage = `JustCall API error (${statusCode}): ${response.statusText}`;
        
        if (statusCode === 401) {
          errorMessage = 'Unauthorized: JustCall API key or secret is invalid';
        } else if (statusCode === 403) {
          errorMessage = 'Forbidden: JustCall API access denied';
        } else if (statusCode === 404) {
          errorMessage = 'Requested JustCall resource does not exist';
        } else if (statusCode === 500) {
          errorMessage = 'JustCall server error. Please contact JustCall support.';
        } else if (errorData.message) {
          errorMessage = `JustCall API error: ${errorData.message}`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Failed to fetch JustCall calls:', error);
      throw error;
    }
  }

  // Get users associated with the account
  async getUsers(): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/users`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const statusCode = response.status;
        let errorMessage = `JustCall API error (${statusCode}): ${response.statusText}`;
        
        if (statusCode === 401) {
          errorMessage = 'Unauthorized: JustCall API key or secret is invalid';
        } else if (statusCode === 403) {
          errorMessage = 'Forbidden: JustCall API access denied';
        } else if (statusCode === 404) {
          errorMessage = 'Requested JustCall resource does not exist';
        } else if (statusCode === 500) {
          errorMessage = 'JustCall server error. Please contact JustCall support.';
        } else if (errorData.message) {
          errorMessage = `JustCall API error: ${errorData.message}`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Failed to fetch JustCall users:', error);
      throw error;
    }
  }
} 