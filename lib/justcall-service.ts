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

  async getMessages(phoneNumber?: string, fromDate?: Date, limit = 100, page = 1): Promise<JustCallMessage[]> {
    try {
      // Using the V2 SMS endpoints as per the documentation
      let url = `${this.baseUrl}/texts`;
      const queryParams = new URLSearchParams();
      
      queryParams.append('per_page', limit.toString());
      queryParams.append('page', page.toString());
      
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
      console.log('JustCall API response data:', JSON.stringify(data, null, 2));
      
      const messages = data.data || [];
      if (!Array.isArray(messages)) {
        console.error('JustCall API returned unexpected data format:', data);
        return [];
      }
      
      // Create a map to group messages by conversation
      const conversationMap = new Map<string, JustCallMessage[]>();
      
      // First pass: group messages by conversation
      messages.forEach((message: any) => {
        // Create a unique thread ID using both numbers
        const threadId = [message.contact_number, message.justcall_number].sort().join('-');
        if (!conversationMap.has(threadId)) {
          conversationMap.set(threadId, []);
        }
        conversationMap.get(threadId)?.push(message);
      });
      
      // Second pass: map messages and add threadId
      return messages.map((message: any): JustCallMessage => {
        if (!message) {
          throw new Error('Received null message from JustCall API');
        }
        
        // Get the thread ID for this message
        const threadId = [message.contact_number, message.justcall_number].sort().join('-');
        
        // Handle potential format differences between v1 and v2.1
        return {
          id: message.id?.toString() || '',
          number: message.justcall_number || '',
          contact_number: message.contact_number || message.client_number || '',
          body: message.sms_info?.body || message.body || '',
          direction: message.direction === '1' || message.direction === 1 || 
                   message.direction === 'Incoming' || message.direction === 'incoming' ? 
                   'inbound' : 'outbound',
          created_at: message.datetime || message.created_at || new Date().toISOString(),
          updated_at: message.updated_at || message.datetime || new Date().toISOString(),
          status: message.delivery_status || message.status || '',
          agent_id: message.agent_id?.toString() || '',
          contact_id: message.contact_id?.toString() || '',
          contact_name: message.contact_name || '',
          media: message.sms_info?.mms || message.mms || [],
          threadId, // Add the threadId to group messages
          // New fields for JustCall V2 API
          sms_info: message.sms_info,
          justcall_number: message.justcall_number,
          justcall_line_name: message.justcall_line_name,
          delivery_status: message.delivery_status,
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
  async processIncomingMessage(message: JustCallMessage): Promise<void> {
    if (!message) {
      console.error('Received null message to process');
      return;
    }
    
    try {
      console.log(`Processing incoming JustCall message ${message.id} from ${message.contact_number}`);
      
      // Debug log the message structure to assist in troubleshooting
      console.log('JustCall message structure:', JSON.stringify({
        id: message.id,
        number: message.number,
        contact_number: message.contact_number,
        has_body: Boolean(message.body),
        has_sms_info: Boolean(message.sms_info),
        body_length: message.body?.length || 0,
        sms_info_body_length: message.sms_info?.body?.length || 0,
        direction: message.direction,
        created_at: message.created_at
      }));
      
      // You could store the message in your database here
      // For now, we'll just log it and ensure it's properly mapped
      
      // Ensure the message has all required properties
      const contactNumber = message.contact_number || '';
      const messageBody = message.sms_info?.body || message.body || '';
      
      if (!contactNumber) {
        console.warn(`Skipping message with empty contact number: ${message.id}`);
        return;
      }
      
      if (!messageBody) {
        console.warn(`Message ${message.id} has no body content`);
        // Still process it, just log the warning
      }
      
      // Additional processing could happen here
      console.log(`Successfully processed JustCall message ${message.id}`);
      
    } catch (error) {
      console.error(`Error processing JustCall message ${message.id}:`, error);
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