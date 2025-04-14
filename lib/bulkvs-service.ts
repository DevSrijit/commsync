import { SyncAccountModel, BulkVSMessage } from "@/lib/types";
import { decryptData } from "@/lib/encryption";
import { db } from "@/lib/db";

/**
 * Creates a properly formatted ISO timestamp from BulkVS date fields
 *
 * @param timestamp The timestamp string from BulkVS
 * @returns An ISO formatted timestamp string
 */
export function formatBulkVSTimestamp(timestamp?: string): string {
  if (!timestamp) {
    const fallbackTime = new Date().toISOString();
    console.log(`No timestamp provided, using current time: ${fallbackTime}`);
    return fallbackTime;
  }

  try {
    // First try to parse it directly as an ISO timestamp
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }

    // If that fails, try to handle other formats
    // Fallback to current time if parsing fails
    const fallbackTime = new Date().toISOString();
    return fallbackTime;
  } catch (error) {
    return new Date().toISOString();
  }
}

export class BulkVSService {
  private apiKey: string;
  private accountId: string;
  private phoneNumber: string;
  private baseUrl = "https://portal.bulkvs.com/api/v1.0";

  constructor(syncAccount: SyncAccountModel) {
    try {
      const decryptedCredentials = decryptData(syncAccount.credentials);
      const credentials =
        typeof decryptedCredentials === "string"
          ? JSON.parse(decryptedCredentials)
          : decryptedCredentials;

      this.apiKey = credentials.apiKey;
      this.accountId = syncAccount.id;
      this.phoneNumber =
        credentials.phoneNumber || syncAccount.accountIdentifier || "";

      if (!this.apiKey) {
        throw new Error("Invalid BulkVS credentials: API key is missing");
      }

      if (!this.phoneNumber) {
        console.warn(
          `No phone number found for BulkVS account ${this.accountId}, some functionality may be limited`
        );
      } else {
        console.log(
          `BulkVS service initialized for phone number: ${this.phoneNumber}`
        );
      }
    } catch (error) {
      console.error("Error initializing BulkVS service:", error);
      throw new Error(
        "Failed to initialize BulkVS service: Invalid credentials"
      );
    }
  }

  private getAuthHeaders() {
    return {
      "X-API-KEY": this.apiKey,
      "Content-Type": "application/json",
    };
  }

  async getMessages(
    phoneNumber?: string,
    fromDate?: Date,
    limit = 100,
    lastSmsIdFetched?: string,
    sortDirection: "asc" | "desc" = "desc"
  ): Promise<{
    messages: BulkVSMessage[];
    rateLimited?: boolean;
    retryAfter?: number;
  }> {
    try {
      // BulkVS endpoint for SMS messages
      let url = `${this.baseUrl}/sms/messages`;
      const queryParams = new URLSearchParams();

      // Set pagination parameters
      queryParams.append("limit", limit.toString());

      // Set sort direction
      queryParams.append("direction", sortDirection);

      // Use the provided phone number or fall back to the one from credentials
      const bulkvsNumber = phoneNumber || this.phoneNumber;

      if (bulkvsNumber) {
        // This should be the number assigned to your BulkVS account
        queryParams.append("from", bulkvsNumber);
        console.log(`Filtering messages for BulkVS number: ${bulkvsNumber}`);
      } else {
        console.warn("No BulkVS phone number provided for filtering messages");
      }

      // Use cursor-based pagination with last_sms_id_fetched
      if (lastSmsIdFetched) {
        queryParams.append("after", lastSmsIdFetched);
        console.log(
          `Using cursor-based pagination with last_sms_id_fetched: ${lastSmsIdFetched}`
        );
      } else {
        console.log("Initial fetch (no pagination cursor)");
      }

      url = `${url}?${queryParams.toString()}`;
      console.log(`BulkVS API request: ${url}`);

      const response = await fetch(url, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      // Check for rate limiting headers
      const rateLimitRemaining = parseInt(
        response.headers.get("X-RateLimit-Remaining") || "-1"
      );
      const rateLimitReset = parseInt(
        response.headers.get("X-RateLimit-Reset") || "-1"
      );

      if (rateLimitRemaining === 0 || response.status === 429) {
        console.warn(
          `⚠️ BulkVS API rate limit reached! Reset in ${rateLimitReset} seconds`
        );

        // If we got a 429 but no specific rate limit headers, use a default wait time
        const retryAfter = rateLimitReset > 0 ? rateLimitReset : 60; // Default to 60 seconds

        // Return an empty result with rate limit info
        return {
          messages: [],
          rateLimited: true,
          retryAfter,
        };
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const statusCode = response.status;
        let errorMessage = `BulkVS API error (${statusCode}): ${response.statusText}`;

        if (statusCode === 401) {
          errorMessage = "Unauthorized: BulkVS API key is invalid";
        } else if (statusCode === 403) {
          errorMessage = "Forbidden: BulkVS API access denied";
        } else if (statusCode === 404) {
          errorMessage = "Requested BulkVS resource does not exist";
        } else if (statusCode === 500) {
          errorMessage = "BulkVS server error. Please contact BulkVS support.";
        } else if (errorData.message) {
          errorMessage = `BulkVS API error: ${errorData.message}`;
        }

        console.error("BulkVS API error:", { statusCode, errorData });
        throw new Error(errorMessage);
      }

      const data = await response.json();

      const messages = data.data || [];
      if (!Array.isArray(messages)) {
        console.error("BulkVS API returned unexpected data format:", data);
        return { messages: [] };
      }

      // Log all messages with their timestamps for debugging
      if (messages.length > 0) {
        console.log(`Retrieved ${messages.length} BulkVS messages.`);
        console.log(
          `First message ID: ${messages[0].id}, Last message ID: ${
            messages[messages.length - 1].id
          }`
        );

        // Show the first 3 messages for debugging
        const sampleSize = Math.min(3, messages.length);
        console.log(`Sample of first ${sampleSize} messages:`);
        messages.slice(0, sampleSize).forEach((msg, idx) => {
          console.log(`Message ${idx + 1}:`, {
            id: msg.id,
            direction: msg.direction,
            to: msg.to,
            from: msg.from,
            created_at: msg.created_at,
          });
        });
      } else {
        console.log("No messages returned from BulkVS API");
      }

      // Create a map to group messages by conversation
      const conversationMap = new Map<string, BulkVSMessage[]>();

      // First pass: group messages by conversation
      messages.forEach((message: any) => {
        // Create a unique thread ID using both numbers
        const threadId = [message.to, message.from].sort().join("-");
        if (!conversationMap.has(threadId)) {
          conversationMap.set(threadId, []);
        }
        conversationMap.get(threadId)?.push(message);
      });

      // Second pass: map messages and add threadId
      const processedMessages = messages
        .map((message: any): BulkVSMessage => {
          if (!message) {
            throw new Error("Received null message from BulkVS API");
          }

          // Get the thread ID for this message
          const threadId = [message.to, message.from].sort().join("-");

          // Format timestamp using the utility function
          const timestamp = formatBulkVSTimestamp(message.created_at);

          // Determine if message is inbound or outbound
          const isInbound =
            message.direction === "inbound" ||
            message.from !== this.phoneNumber;

          return {
            id: message.id?.toString() || "",
            number: isInbound ? message.to : message.from,
            contact_number: isInbound ? message.from : message.to,
            body: message.message || "",
            direction: isInbound ? "inbound" : "outbound",
            created_at: timestamp,
            updated_at: message.updated_at || timestamp,
            status: message.status || "delivered",
            media: message.media_urls || [],
            threadId,
            // BulkVS specific fields
            from: message.from,
            to: message.to,
            message: message.message,
            media_urls: message.media_urls || [],
          };
        })
        .filter(Boolean); // Remove null messages

      // Return rate limit info along with messages
      return {
        messages: processedMessages,
        rateLimited: rateLimitRemaining === 0 || response.status === 429,
        retryAfter: rateLimitReset > 0 ? rateLimitReset : undefined,
      };
    } catch (error) {
      console.error("Failed to fetch BulkVS messages:", error);
      // Return an empty result instead of throwing
      return { messages: [], rateLimited: false };
    }
  }

  async sendMessage(
    contact_number: string,
    body: string,
    media?: string[],
    from_number?: string
  ): Promise<BulkVSMessage> {
    try {
      // BulkVS SMS send endpoint
      const url = `${this.baseUrl}/sms/send`;

      // Use provided from_number or fall back to the account's phone number
      const phone_number = from_number || this.phoneNumber;

      if (!phone_number) {
        throw new Error("BulkVS phone number is required for sending messages");
      }

      const payload: any = {
        from: phone_number,
        to: contact_number,
        message: body,
      };

      if (media && media.length > 0) {
        payload.media_urls = media;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const statusCode = response.status;
        let errorMessage = `BulkVS API error (${statusCode}): ${response.statusText}`;

        if (statusCode === 401) {
          errorMessage = "Unauthorized: BulkVS API key is invalid";
        } else if (statusCode === 403) {
          errorMessage = "Forbidden: BulkVS API access denied";
        } else if (statusCode === 404) {
          errorMessage = "Requested BulkVS resource does not exist";
        } else if (statusCode === 500) {
          errorMessage = "BulkVS server error. Please contact BulkVS support.";
        } else if (errorData.message) {
          errorMessage = `BulkVS API error: ${errorData.message}`;
        }

        console.error("BulkVS API error:", { statusCode, errorData });
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error("Failed to send BulkVS message:", error);
      throw error;
    }
  }

  // Process a new message from BulkVS webhook
  async processIncomingMessage(message: BulkVSMessage): Promise<void> {
    if (!message || !message.id) {
      throw new Error("Invalid message object received");
    }

    try {
      // Ensure the message has all required properties
      const contactNumber = message.contact_number || "";
      const messageBody = message.body || message.message || "";

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
    } catch (error) {
      console.error(`Error processing BulkVS message ${message.id}:`, error);
      throw error;
    }
  }

  // Get phone numbers associated with the account
  async getPhoneNumbers(): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/numbers`;

      const response = await fetch(url, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const statusCode = response.status;
        let errorMessage = `BulkVS API error (${statusCode}): ${response.statusText}`;

        if (statusCode === 401) {
          errorMessage = "Unauthorized: BulkVS API key is invalid";
        } else if (statusCode === 403) {
          errorMessage = "Forbidden: BulkVS API access denied";
        } else if (statusCode === 404) {
          errorMessage = "Requested BulkVS resource does not exist";
        } else if (statusCode === 500) {
          errorMessage = "BulkVS server error. Please contact BulkVS support.";
        } else if (errorData.message) {
          errorMessage = `BulkVS API error: ${errorData.message}`;
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error("Failed to fetch BulkVS phone numbers:", error);
      throw error;
    }
  }

  // Debug method to fetch all texts without filters to help troubleshoot
  async getAllMessagesDebug(limit = 100): Promise<any> {
    try {
      let url = `${this.baseUrl}/sms/messages?limit=${limit}`;

      console.log(`[DEBUG] Fetching all messages without filters from: ${url}`);

      const response = await fetch(url, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const statusCode = response.status;
        console.error(`[DEBUG] BulkVS API error: ${statusCode}`, errorData);
        return { error: errorData, status: statusCode };
      }

      const data = await response.json();
      console.log(
        `[DEBUG] BulkVS API response: Found ${data?.data?.length || 0} messages`
      );

      // Log the first few messages to see what's coming back
      if (data?.data?.length > 0) {
        const sampleMessages = data.data.slice(0, 3);
        console.log(
          `[DEBUG] Sample messages: ${JSON.stringify(sampleMessages, null, 2)}`
        );

        // Extract unique phone numbers to help with debugging
        const fromNumbers = new Set();
        const toNumbers = new Set();

        data.data.forEach((msg: any) => {
          if (msg.from) fromNumbers.add(msg.from);
          if (msg.to) toNumbers.add(msg.to);
        });

        console.log(
          `[DEBUG] From numbers in messages: ${Array.from(fromNumbers).join(
            ", "
          )}`
        );
        console.log(
          `[DEBUG] To numbers in messages: ${Array.from(toNumbers).join(", ")}`
        );
      }

      return data;
    } catch (error) {
      console.error("[DEBUG] Failed to fetch all BulkVS messages:", error);
      return { error };
    }
  }
}
