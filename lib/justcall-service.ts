import { SyncAccountModel, JustCallMessage } from "@/lib/types";
import { decryptData } from "@/lib/encryption";
import { db } from "@/lib/db";

export interface RateLimitInfo {
  isRateLimited: boolean;
  remaining: number;
  limit: number;
  resetTimestamp: number;
  retryAfterSeconds: number;
}

/**
 * Creates a properly formatted ISO timestamp from JustCall date and time fields
 * 
 * @param dateStr The date string from JustCall (sms_user_date or sms_date)
 * @param timeStr The time string from JustCall (sms_user_time or sms_time)
 * @returns An ISO formatted timestamp string
 */
export function formatJustCallTimestamp(dateStr?: string, timeStr?: string): string {
  
  if (!dateStr && !timeStr) {
    const fallbackTime = new Date().toISOString();
    console.log(`No date or time provided, using current time: ${fallbackTime}`);
    return fallbackTime;
  }
  
  try {
    // If we have both date and time, combine them
    if (dateStr && timeStr) {
      // Make sure dateStr is in YYYY-MM-DD format
      let formattedDate = dateStr;
      let formattedTime = timeStr;
      
      // Check if date is in MM/DD/YYYY format and convert to YYYY-MM-DD
      if (dateStr.includes('/')) {
        const dateParts = dateStr.split('/');
        if (dateParts.length === 3) {
          formattedDate = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;
        }
      }
      
      // Make sure time is in HH:MM:SS format
      if (!formattedTime.includes(':')) {
        // If time isn't in the expected format, try to use it as is
      } else if (formattedTime.split(':').length === 2) {
        // Add seconds if missing
        formattedTime = `${formattedTime}:00`;
      }
      
      // Format: YYYY-MM-DD HH:MM:SS
      const isoTime = `${formattedDate}T${formattedTime}`;
      
      // Validate the timestamp by parsing it
      const date = new Date(isoTime);
      if (!isNaN(date.getTime())) {
        const result = date.toISOString();
        return result;
      } else {
        // Continue to fallback methods
      }
    }
    
    // If we only have time string (should include date info anyway)
    if (timeStr) {
      // Check if timeStr is a valid ISO timestamp
      if (timeStr.includes('T') || timeStr.includes('Z')) {
        return timeStr;
      }
      
      // Try to parse it as a regular timestamp
      const date = new Date(timeStr);
      if (!isNaN(date.getTime())) {
        const result = date.toISOString();
        return result;
      }
    }
    
    // If we only have date string
    if (dateStr) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        const result = date.toISOString();
        return result;
      }
    }
    
    // Fallback to current time if parsing fails
    const fallbackTime = new Date().toISOString();
    return fallbackTime;
  } catch (error) {
    return new Date().toISOString();
  }
}

export class JustCallService {
  private apiKey: string;
  private apiSecret: string;
  private accountId: string;
  private phoneNumber: string;
  private baseUrl = "https://api.justcall.io/v2.1"; // Updated to v2.1 API

  constructor(syncAccount: SyncAccountModel) {
    try {
      const decryptedCredentials = decryptData(syncAccount.credentials);
      const credentials =
        typeof decryptedCredentials === "string"
          ? JSON.parse(decryptedCredentials)
          : decryptedCredentials;

      this.apiKey = credentials.apiKey;
      this.apiSecret = credentials.apiSecret;
      this.accountId = syncAccount.id;
      this.phoneNumber =
        credentials.phoneNumber || syncAccount.accountIdentifier || "";

      if (!this.apiKey || !this.apiSecret) {
        throw new Error(
          "Invalid JustCall credentials: API key or secret is missing"
        );
      }

      if (!this.phoneNumber) {
        console.warn(
          `No phone number found for JustCall account ${this.accountId}, some functionality may be limited`
        );
      } else {
        console.log(
          `JustCall service initialized for phone number: ${this.phoneNumber}`
        );
      }
    } catch (error) {
      console.error("Error initializing JustCall service:", error);
      throw new Error(
        "Failed to initialize JustCall service: Invalid credentials"
      );
    }
  }

  private getAuthHeaders() {
    const basicAuth = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString(
      "base64"
    );
    return {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Extracts rate limit information from response headers
   */
  private extractRateLimitInfo(headers: Headers): RateLimitInfo {
    const remaining = parseInt(headers.get('X-Rate-Limit-Remaining') || '1000', 10);
    const limit = parseInt(headers.get('X-Rate-Limit-Limit') || '1000', 10);
    const retryAfter = parseInt(headers.get('Retry-After') || '0', 10);
    
    // Parse reset time - try both formats
    let resetTimestamp = 0;
    const resetHeader = headers.get('X-Rate-Limit-Reset');
    if (resetHeader) {
      // If it's a unix timestamp
      if (/^\d+$/.test(resetHeader)) {
        resetTimestamp = parseInt(resetHeader, 10) * 1000; // Convert to ms
      } else {
        // If it's a date string
        resetTimestamp = new Date(resetHeader).getTime();
      }
    }
    
    // If reset timestamp is invalid, calculate based on retry-after
    if (!resetTimestamp || isNaN(resetTimestamp)) {
      resetTimestamp = Date.now() + (retryAfter * 1000 || 60000); // Default 60s
    }
    
    const isRateLimited = remaining <= 0 || retryAfter > 0;
    
    // Calculate seconds until reset, ensuring it's never negative
    const retryAfterSeconds = retryAfter || Math.max(0, Math.ceil((resetTimestamp - Date.now()) / 1000));
    
    return {
      isRateLimited,
      remaining,
      limit,
      resetTimestamp,
      retryAfterSeconds
    };
  }

  async getMessages(
    phoneNumber?: string,
    fromDate?: Date,
    limit = 100,
    lastSmsIdFetched?: string,
    sortDirection: "asc" | "desc" = "desc"
  ): Promise<{ messages: JustCallMessage[], rateLimitInfo: RateLimitInfo }> {
    try {
      // Using the V2 SMS endpoints as per the documentation
      let url = `${this.baseUrl}/texts`;
      const queryParams = new URLSearchParams();

      // Set pagination parameters
      queryParams.append("per_page", limit.toString());
      
      // The 'sort' parameter should always be 'datetime'
      queryParams.append("sort", "datetime");

      // The direction should be in an 'order' parameter
      queryParams.append("order", sortDirection);

      // Use the provided phone number or fall back to the one from credentials
      const justcallNumber = phoneNumber || this.phoneNumber;

      if (justcallNumber) {
        // This should be the number assigned to your JustCall account
        queryParams.append("justcall_number", justcallNumber);
        console.log(
          `Filtering messages for JustCall number: ${justcallNumber}`
        );
      } else {
        console.warn(
          "No JustCall phone number provided for filtering messages"
        );
      }

      // Use cursor-based pagination with last_sms_id_fetched instead of page number
      if (lastSmsIdFetched) {
        queryParams.append("last_sms_id_fetched", lastSmsIdFetched);
        console.log(`Using cursor-based pagination with last_sms_id_fetched: ${lastSmsIdFetched}`);
      } else {
        console.log('Initial fetch (no pagination cursor)');
      }

      url = `${url}?${queryParams.toString()}`;
      console.log(`JustCall API request: ${url}`);

      const response = await fetch(url, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      // Extract rate limit information from headers
      const rateLimitInfo = this.extractRateLimitInfo(response.headers);
      console.log('JustCall rate limit info:', rateLimitInfo);

      // If we're rate limited, return empty data with rate limit info
      if (rateLimitInfo.isRateLimited) {
        console.warn(`JustCall API rate limited. Retry after ${rateLimitInfo.retryAfterSeconds}s`);
        return { 
          messages: [], 
          rateLimitInfo 
        };
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const statusCode = response.status;
        let errorMessage = `JustCall API error (${statusCode}): ${response.statusText}`;

        if (statusCode === 401) {
          errorMessage = "Unauthorized: JustCall API key or secret is invalid";
        } else if (statusCode === 403) {
          errorMessage = "Forbidden: JustCall API access denied";
        } else if (statusCode === 404) {
          errorMessage = "Requested JustCall resource does not exist";
        } else if (statusCode === 429) {
          // Rate limit exceeded - already handled above but just in case
          return { 
            messages: [], 
            rateLimitInfo 
          };
        } else if (statusCode === 500) {
          errorMessage =
            "JustCall server error. Please contact JustCall support.";
        } else if (errorData.message) {
          errorMessage = `JustCall API error: ${errorData.message}`;
        }

        console.error("JustCall API error:", { statusCode, errorData });
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      const messages = data.data || [];
      if (!Array.isArray(messages)) {
        console.error("JustCall API returned unexpected data format:", data);
        return { messages: [], rateLimitInfo };
      }

      // Log all messages with their timestamps for debugging
      if (messages.length > 0) {
        console.log(`Retrieved ${messages.length} JustCall messages.`);
        console.log(`First message ID: ${messages[0].id}, Last message ID: ${messages[messages.length-1].id}`);
        
        // Show the first 3 messages for debugging
        const sampleSize = Math.min(3, messages.length);
        console.log(`Sample of first ${sampleSize} messages:`);
        messages.slice(0, sampleSize).forEach((msg, idx) => {
          console.log(`Message ${idx+1}:`, {
            id: msg.id,
            direction: msg.direction,
            contact_number: msg.contact_number,
            date: msg.sms_user_date || msg.sms_date
          });
        });
      } else {
        console.log('No messages returned from JustCall API');
      }

      // Create a map to group messages by conversation
      const conversationMap = new Map<string, JustCallMessage[]>();

      // First pass: group messages by conversation
      messages.forEach((message: any) => {
        // Create a unique thread ID using both numbers
        const threadId = [message.contact_number, message.justcall_number]
          .sort()
          .join("-");
        if (!conversationMap.has(threadId)) {
          conversationMap.set(threadId, []);
        }
        conversationMap.get(threadId)?.push(message);
      });

      // Second pass: map messages and add threadId
      const processedMessages = messages
        .map((message: any): JustCallMessage => {
          if (!message) {
            throw new Error("Received null message from JustCall API");
          }

          // Get the thread ID for this message
          const threadId = [message.contact_number, message.justcall_number]
            .sort()
            .join("-");

          // Format timestamp using the utility function with user's timezone values first
          const timestamp = formatJustCallTimestamp(
            message.sms_user_date || message.sms_date,
            message.sms_user_time || message.sms_time
          );

          // Handle potential format differences between v1 and v2.1
          return {
            id: message.id?.toString() || "",
            number: message.justcall_number || "",
            contact_number:
              message.contact_number || message.client_number || "",
            body: message.sms_info?.body || message.body || "",
            direction:
              message.direction === "1" ||
              message.direction === 1 ||
              message.direction === "Incoming" ||
              message.direction === "incoming"
                ? "inbound"
                : "outbound",
            // Use the formatted timestamp
            created_at: timestamp,
            updated_at:
              message.updated_at ||
              message.datetime ||
              new Date().toISOString(),
            status: message.delivery_status || message.status || "",
            agent_id: message.agent_id?.toString() || "",
            contact_id: message.contact_id?.toString() || "",
            contact_name: message.contact_name || "",
            media: message.sms_info?.mms || message.mms || [],
            threadId, // Add the threadId to group messages
            // New fields for JustCall V2 API
            sms_info: message.sms_info,
            justcall_number: message.justcall_number,
            justcall_line_name: message.justcall_line_name,
            delivery_status: message.delivery_status,
            // Add all time fields for use in the application
            sms_user_time: message.sms_user_time || "",
            sms_time: message.sms_time || "",
            sms_user_date: message.sms_user_date || "",
            sms_date: message.sms_date || "",
          };
        })
        .filter(Boolean); // Remove null messages

      return { 
        messages: processedMessages, 
        rateLimitInfo 
      };
    } catch (error) {
      console.error("Failed to fetch JustCall messages:", error);
      throw error;
    }
  }

  async sendMessage(
    contact_number: string,
    body: string,
    media?: string[],
    justcall_number?: string,
    restrict_once?: "Yes" | "No"
  ): Promise<JustCallMessage> {
    try {
      // Using the V2 SMS send endpoint
      const url = `${this.baseUrl}/texts/new`;

      // Use provided justcall_number or fall back to the account's phone number
      const phone_number = justcall_number || this.phoneNumber;
      
      if (!phone_number) {
        throw new Error("JustCall phone number is required for sending messages");
      }

      const payload: any = {
        justcall_number: phone_number,
        contact_number,
        body,
      };

      if (media && media.length > 0) {
        payload.media_url = media;
      }
      
      if (restrict_once) {
        payload.restrict_once = restrict_once;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      // Check for rate limiting
      const rateLimitInfo = this.extractRateLimitInfo(response.headers);
      if (rateLimitInfo.isRateLimited) {
        console.warn(`JustCall API rate limited when sending message. Retry after ${rateLimitInfo.retryAfterSeconds}s`);
        throw new Error(`Rate limit exceeded: Try again in ${rateLimitInfo.retryAfterSeconds} seconds`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const statusCode = response.status;
        let errorMessage = `JustCall API error (${statusCode}): ${response.statusText}`;

        if (statusCode === 401) {
          errorMessage = "Unauthorized: JustCall API key or secret is invalid";
        } else if (statusCode === 403) {
          errorMessage = "Forbidden: JustCall API access denied";
        } else if (statusCode === 404) {
          errorMessage = "Requested JustCall resource does not exist";
        } else if (statusCode === 500) {
          errorMessage =
            "JustCall server error. Please contact JustCall support.";
        } else if (errorData.message) {
          errorMessage = `JustCall API error: ${errorData.message}`;
        }

        console.error("JustCall API error:", { statusCode, errorData });
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error("Failed to send JustCall message:", error);
      throw error;
    }
  }

  // Process a new message from JustCall webhook
  async processIncomingMessage(message: JustCallMessage): Promise<void> {
    if (!message || !message.id) {
      throw new Error("Invalid message object received");
    }

    try {
      // Remove excessive logging
      // console.log(`Processing incoming JustCall message ${message.id} from ${message.contact_number}`);

      // Remove detailed message structure logging
      // console.log('JustCall message structure:', JSON.stringify({
      //   id: message.id,
      //   number: message.number,
      //   contact_number: message.contact_number,
      //   has_body: Boolean(message.body),
      //   has_sms_info: Boolean(message.sms_info),
      //   body_length: message.body?.length || 0,
      //   sms_info_body_length: message.sms_info?.body?.length || 0,
      //   direction: message.direction,
      //   created_at: message.created_at
      // }));

      // Ensure the message has all required properties
      const contactNumber = message.contact_number || "";
      const messageBody = message.sms_info?.body || message.body || "";

      if (!contactNumber) {
        console.warn(
          `Skipping message with empty contact number: ${message.id}`
        );
        return;
      }

      if (!messageBody) {
        console.warn(`Message ${message.id} has no body content`);
        // Still process it, just log the warning
      }

      // Additional processing could happen here
      // Remove success logging
      // console.log(`Successfully processed JustCall message ${message.id}`);
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
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const statusCode = response.status;
        let errorMessage = `JustCall API error (${statusCode}): ${response.statusText}`;

        if (statusCode === 401) {
          errorMessage = "Unauthorized: JustCall API key or secret is invalid";
        } else if (statusCode === 403) {
          errorMessage = "Forbidden: JustCall API access denied";
        } else if (statusCode === 404) {
          errorMessage = "Requested JustCall resource does not exist";
        } else if (statusCode === 500) {
          errorMessage =
            "JustCall server error. Please contact JustCall support.";
        } else if (errorData.message) {
          errorMessage = `JustCall API error: ${errorData.message}`;
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error("Failed to fetch JustCall phone numbers:", error);
      throw error;
    }
  }

  // Get call history
  async getCalls(
    params: {
      fromDatetime?: string;
      toDatetime?: string;
      contactNumber?: string;
      justcallNumber?: string;
      callDirection?: "Incoming" | "Outgoing";
      page?: number;
      perPage?: number;
    } = {}
  ): Promise<any[]> {
    try {
      let url = `${this.baseUrl}/calls`;
      const queryParams = new URLSearchParams();

      if (params.fromDatetime) {
        queryParams.append("from_datetime", params.fromDatetime);
      }

      if (params.toDatetime) {
        queryParams.append("to_datetime", params.toDatetime);
      }

      if (params.contactNumber) {
        queryParams.append("contact_number", params.contactNumber);
      }

      if (params.justcallNumber) {
        queryParams.append("justcall_number", params.justcallNumber);
      }

      if (params.callDirection) {
        queryParams.append("call_direction", params.callDirection);
      }

      if (params.page) {
        queryParams.append("page", params.page.toString());
      }

      if (params.perPage) {
        queryParams.append("per_page", params.perPage.toString());
      }

      if (queryParams.toString()) {
        url = `${url}?${queryParams.toString()}`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      // Check for rate limiting
      const rateLimitInfo = this.extractRateLimitInfo(response.headers);
      if (rateLimitInfo.isRateLimited) {
        console.warn(`JustCall API rate limited when fetching calls. Retry after ${rateLimitInfo.retryAfterSeconds}s`);
        return [];
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const statusCode = response.status;
        let errorMessage = `JustCall API error (${statusCode}): ${response.statusText}`;

        if (statusCode === 401) {
          errorMessage = "Unauthorized: JustCall API key or secret is invalid";
        } else if (statusCode === 403) {
          errorMessage = "Forbidden: JustCall API access denied";
        } else if (statusCode === 404) {
          errorMessage = "Requested JustCall resource does not exist";
        } else if (statusCode === 500) {
          errorMessage =
            "JustCall server error. Please contact JustCall support.";
        } else if (errorData.message) {
          errorMessage = `JustCall API error: ${errorData.message}`;
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error("Failed to fetch JustCall calls:", error);
      throw error;
    }
  }

  // Get users associated with the account
  async getUsers(): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/users`;

      const response = await fetch(url, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      // Check for rate limiting
      const rateLimitInfo = this.extractRateLimitInfo(response.headers);
      if (rateLimitInfo.isRateLimited) {
        console.warn(`JustCall API rate limited when fetching users. Retry after ${rateLimitInfo.retryAfterSeconds}s`);
        return [];
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const statusCode = response.status;
        let errorMessage = `JustCall API error (${statusCode}): ${response.statusText}`;

        if (statusCode === 401) {
          errorMessage = "Unauthorized: JustCall API key or secret is invalid";
        } else if (statusCode === 403) {
          errorMessage = "Forbidden: JustCall API access denied";
        } else if (statusCode === 404) {
          errorMessage = "Requested JustCall resource does not exist";
        } else if (statusCode === 500) {
          errorMessage =
            "JustCall server error. Please contact JustCall support.";
        } else if (errorData.message) {
          errorMessage = `JustCall API error: ${errorData.message}`;
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error("Failed to fetch JustCall users:", error);
      throw error;
    }
  }

  // Debug method to fetch all texts without filters to help troubleshoot
  async getAllTextsDebug(limit = 100): Promise<any> {
    try {
      // Using the V2 SMS endpoints as per the documentation
      let url = `${this.baseUrl}/texts?per_page=${limit}`;

      console.log(`[DEBUG] Fetching all texts without filters from: ${url}`);

      const response = await fetch(url, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      // Check for rate limiting
      const rateLimitInfo = this.extractRateLimitInfo(response.headers);
      if (rateLimitInfo.isRateLimited) {
        console.warn(`JustCall API rate limited during debug fetch. Retry after ${rateLimitInfo.retryAfterSeconds}s`);
        return { error: "Rate limit exceeded", rateLimitInfo };
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const statusCode = response.status;
        console.error(`[DEBUG] JustCall API error: ${statusCode}`, errorData);
        return { error: errorData, status: statusCode };
      }

      const data = await response.json();
      console.log(
        `[DEBUG] JustCall API response: Found ${data?.data?.length || 0} texts`
      );

      // Log the first few texts to see what's coming back
      if (data?.data?.length > 0) {
        const sampleTexts = data.data.slice(0, 3);
        console.log(
          `[DEBUG] Sample texts: ${JSON.stringify(sampleTexts, null, 2)}`
        );

        // Extract unique phone numbers to help with debugging
        const justcallNumbers = new Set();
        const contactNumbers = new Set();

        data.data.forEach((text: any) => {
          if (text.justcall_number) justcallNumbers.add(text.justcall_number);
          if (text.contact_number) contactNumbers.add(text.contact_number);
        });

        console.log(
          `[DEBUG] JustCall numbers in texts: ${Array.from(
            justcallNumbers
          ).join(", ")}`
        );
        console.log(
          `[DEBUG] Contact numbers in texts: ${Array.from(contactNumbers).join(
            ", "
          )}`
        );
      }

      return data;
    } catch (error) {
      console.error("[DEBUG] Failed to fetch all JustCall texts:", error);
      return { error };
    }
  }
}
