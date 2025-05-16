import { SyncAccountModel, JustCallMessage } from "@/lib/types";
import { decryptData } from "@/lib/encryption";
import { db } from "@/lib/db";

/**
 * Creates a properly formatted ISO timestamp from JustCall date and time fields
 *
 * @param dateStr The date string from JustCall (sms_user_date or sms_date)
 * @param timeStr The time string from JustCall (sms_user_time or sms_time)
 * @returns An ISO formatted timestamp string
 */
export function formatJustCallTimestamp(
  dateStr?: string,
  timeStr?: string
): string {
  if (!dateStr && !timeStr) {
    return new Date().toISOString();
  }

  try {
    // If we have both date and time, combine them
    if (dateStr && timeStr) {
      // Make sure dateStr is in YYYY-MM-DD format
      let formattedDate = dateStr;
      let formattedTime = timeStr;

      // Check if date is in MM/DD/YYYY format and convert to YYYY-MM-DD
      if (dateStr.includes("/")) {
        const dateParts = dateStr.split("/");
        if (dateParts.length === 3) {
          formattedDate = `${dateParts[2]}-${dateParts[0].padStart(
            2,
            "0"
          )}-${dateParts[1].padStart(2, "0")}`;
        }
      }

      // Make sure time is in HH:MM:SS format
      if (!formattedTime.includes(":")) {
        // If time isn't in the expected format, try to use it as is
      } else if (formattedTime.split(":").length === 2) {
        // Add seconds if missing
        formattedTime = `${formattedTime}:00`;
      }

      // Format: YYYY-MM-DD HH:MM:SS
      const isoTime = `${formattedDate}T${formattedTime}`;

      // Validate the timestamp by parsing it
      const date = new Date(isoTime);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    // If we only have time string (should include date info anyway)
    if (timeStr) {
      // Check if timeStr is a valid ISO timestamp
      if (timeStr.includes("T") || timeStr.includes("Z")) {
        return timeStr;
      }

      // Try to parse it as a regular timestamp
      const date = new Date(timeStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    // If we only have date string
    if (dateStr) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    // Fallback to current time if parsing fails
    return new Date().toISOString();
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

  async getMessages(
    phoneNumber?: string,
    fromDate?: Date,
    limit = 100,
    lastSmsIdFetched?: string,
    sortDirection: "asc" | "desc" = "desc"
  ): Promise<{
    messages: JustCallMessage[];
    rateLimited?: boolean;
    retryAfter?: number;
  }> {
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
      }

      // Use cursor-based pagination with last_sms_id_fetched instead of page number
      if (lastSmsIdFetched) {
        queryParams.append("last_sms_id_fetched", lastSmsIdFetched);
      }

      url = `${url}?${queryParams.toString()}`;

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

      const messages = data.data || [];
      if (!Array.isArray(messages)) {
        console.error("JustCall API returned unexpected data format:", data);
        return { messages: [] };
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

      // Return rate limit info along with messages
      return {
        messages: processedMessages,
        rateLimited: rateLimitRemaining === 0 || response.status === 429, // Only true when actually rate limited
        retryAfter: rateLimitReset > 0 ? rateLimitReset : undefined,
      };
    } catch (error) {
      console.error("Failed to fetch JustCall messages:", error);
      // Return an empty result instead of throwing
      return { messages: [], rateLimited: false };
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
        throw new Error(
          "JustCall phone number is required for sending messages"
        );
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
      // Ensure the message has all required properties
      const contactNumber = message.contact_number || "";
      const messageBody = message.sms_info?.body || message.body || "";

      if (!contactNumber) {
        return;
      }

      if (!messageBody) {
        // Still process it, just log the warning
      }
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

      const response = await fetch(url, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const statusCode = response.status;
        console.error(`[DEBUG] JustCall API error: ${statusCode}`, errorData);
        return { error: errorData, status: statusCode };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("[DEBUG] Failed to fetch all JustCall texts:", error);
      return { error };
    }
  }
}
