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
  private apiUsername: string;
  private accountId: string;
  private phoneNumber: string;
  private baseUrl = "https://portal.bulkvs.com/api/v1.0";
  private useBasicAuth: boolean = true;

  constructor(syncAccount: SyncAccountModel) {
    try {
      const decryptedCredentials = decryptData(syncAccount.credentials);
      const credentials =
        typeof decryptedCredentials === "string"
          ? JSON.parse(decryptedCredentials)
          : decryptedCredentials;

      this.apiKey = credentials.apiKey;
      this.apiUsername =
        credentials.apiUsername || "admin@havenmediasolutions.com"; // Default username if not provided
      this.accountId = syncAccount.id;
      this.phoneNumber =
        credentials.phoneNumber || syncAccount.accountIdentifier || "";

      // Allow overriding auth method if explicitly set
      if (credentials.useBasicAuth !== undefined) {
        this.useBasicAuth = credentials.useBasicAuth;
      }

      if (!this.apiKey) {
        throw new Error("Invalid BulkVS credentials: API key is missing");
      }

      if (this.useBasicAuth && !this.apiUsername) {
        throw new Error(
          "Invalid BulkVS credentials: API username is missing for Basic Auth"
        );
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

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.useBasicAuth) {
      // Use Basic Authentication
      const basicAuth = Buffer.from(
        `${this.apiUsername}:${this.apiKey}`
      ).toString("base64");
      headers["Authorization"] = `Basic ${basicAuth}`;
    } else {
      // Use API Key in header
      headers["X-API-KEY"] = this.apiKey;
    }

    return headers;
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
    // BulkVS does not provide a way to fetch messages through API
    // Messages are only received via webhook, so this method returns an empty result
    console.warn(
      "BulkVS API does not provide a message retrieval endpoint. Messages are received via webhook only."
    );

    return { messages: [], rateLimited: false };
  }

  async sendMessage(
    contact_number: string,
    body: string,
    media?: string[],
    from_number?: string
  ): Promise<BulkVSMessage> {
    try {
      // BulkVS messageSend endpoint
      const url = `${this.baseUrl}/messageSend`;

      // Use provided from_number or fall back to the account's phone number
      const phone_number = from_number || this.phoneNumber;

      if (!phone_number) {
        throw new Error("BulkVS phone number is required for sending messages");
      }

      // Make sure contact_number is in E.164 format (with + prefix)
      const formattedContactNumber = contact_number.startsWith("+")
        ? contact_number
        : `+${contact_number}`;

      // Format payload according to BulkVS API documentation
      // From the docs: { "From": "(FROM NUMBER)", "To": ["(TO NUMBER)"], "Message": "(UPTO-160-CHARACTER-MESSAGE)" }
      const payload: any = {
        From: phone_number,
        To: [formattedContactNumber],
        Message: body,
      };

      // Add media URLs if provided
      // From the docs: "MediaURLs": ["https://s3.aws.com/file1.png"]
      if (media && media.length > 0) {
        payload.MediaURLs = media;
      }

      console.log(
        `Sending message via BulkVS API to ${formattedContactNumber}`,
        {
          payload,
        }
      );

      const response = await fetch(url, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const responseText = await response.text();
        console.error(`BulkVS API error response: ${responseText}`);

        const statusCode = response.status;
        let errorMessage = `BulkVS API error (${statusCode}): ${response.statusText}`;

        if (statusCode === 401) {
          errorMessage = "Unauthorized: BulkVS API credentials are invalid";
        } else if (statusCode === 403) {
          errorMessage = "Forbidden: BulkVS API access denied";
        } else if (statusCode === 404) {
          errorMessage = "Requested BulkVS resource does not exist";
        } else if (statusCode === 500) {
          errorMessage = "BulkVS server error. Please contact BulkVS support.";
        }

        throw new Error(errorMessage);
      }

      // Response should be parsed and handled according to actual BulkVS API response format
      // Expected format from docs:
      // {
      //   "RefId": "(Reference ID for this Message)",
      //   "From": "(FROM NUMBER)",
      //   "MessageType": "SMS|MMS",
      //   "Results": [{
      //     "To": "(TO NUMBER)",
      //     "Status": "SUCCESS"
      //   }]
      // }
      const responseText = await response.text();
      console.log(`BulkVS message send response: ${responseText}`);

      if (!responseText || responseText.trim() === "") {
        throw new Error("Empty response from BulkVS API");
      }

      try {
        const data = JSON.parse(responseText);
        const messageType = data.MessageType || "SMS";
        const refId = data.RefId || `bulkvs-${Date.now()}`;
        const status =
          data.Results && data.Results[0] ? data.Results[0].Status : "UNKNOWN";

        // Transform the BulkVS response to match our expected message format
        return {
          id: refId,
          number: phone_number,
          contact_number: formattedContactNumber,
          body: body,
          direction: "outbound",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: status === "SUCCESS" ? "sent" : "failed",
          media: media || [],
          threadId: [phone_number, formattedContactNumber].sort().join("-"),
          from: phone_number,
          to: formattedContactNumber,
          message: body,
          media_urls: media || [],
        };
      } catch (parseError) {
        console.error("Failed to parse BulkVS API response:", parseError);
        // Return a minimal successful response if parsing fails
        return {
          id: `bulkvs-${Date.now()}`,
          number: phone_number,
          contact_number: formattedContactNumber,
          body: body,
          direction: "outbound",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: "sent",
          media: media || [],
          threadId: [phone_number, formattedContactNumber].sort().join("-"),
          from: phone_number,
          to: formattedContactNumber,
          message: body,
          media_urls: media || [],
        };
      }
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
      // Handle both PascalCase (From/To/Message) and camelCase (from/to/message) formats
      const fromNumber = message.From || message.from || "";
      const toNumbers = message.To || message.to || [];
      const toNumber = Array.isArray(toNumbers) ? toNumbers[0] : toNumbers;
      const messageBody =
        message.Message || message.message || message.body || "";
      const mediaUrls =
        message.MediaURLs || message.media_urls || message.media || [];

      const contactNumber = message.contact_number || "";
      const direction = message.direction || "inbound";
      const threadId =
        message.threadId || [fromNumber, toNumber].sort().join("-");

      if (!fromNumber || !toNumber) {
        console.warn(`Skipping message with missing from/to: ${message.id}`);
        return;
      }

      if (!messageBody && mediaUrls.length === 0) {
        console.warn(`Message ${message.id} has no content or media`);
        // Still process it, just log the warning
      }

      const messageType = mediaUrls.length > 0 ? "MMS" : "SMS";

      console.log(
        `Processing ${direction} BulkVS ${messageType} message ${message.id} from thread ${threadId}`
      );

      // Store the message in the database
      try {
        await db.message.create({
          data: {
            externalId: message.id,
            syncAccountId: this.accountId,
            direction: direction,
            from: fromNumber,
            to: toNumber,
            body: messageBody,
            timestamp: new Date(message.created_at || Date.now()),
            status: message.status || "delivered",
            metadata: {
              // Store any additional metadata that might be useful
              platform: "bulkvs",
              threadId,
              media: mediaUrls,
              messageType,
              originalMessage: message,
            },
          },
        });

        console.log(
          `Stored BulkVS ${messageType} message ${message.id} in database`
        );
      } catch (dbError) {
        // Check if it's a duplicate message
        if (
          dbError instanceof Error &&
          dbError.message.includes("unique constraint")
        ) {
          console.log(`Skipping duplicate BulkVS message: ${message.id}`);
          return;
        }

        console.error(`Error storing BulkVS message ${message.id}:`, dbError);
        throw dbError;
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
      // BulkVS endpoint for retrieving phone numbers - using webhooks endpoint to test connectivity
      const url = `${this.baseUrl}/webhooks`;

      console.log(`Testing API connectivity with: ${url}`);

      const response = await fetch(url, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const statusCode = response.status;
        const statusText = response.statusText;
        let errorMessage = `BulkVS API error (${statusCode}): ${statusText}`;

        // Try to get error details if possible
        try {
          const errorText = await response.text();
          console.error(`BulkVS API error response body: ${errorText}`);

          if (errorText && errorText.trim()) {
            try {
              // Try to parse as JSON if possible
              const errorData = JSON.parse(errorText);
              if (errorData.message) {
                errorMessage = `BulkVS API error: ${errorData.message}`;
              }
            } catch (parseError) {
              // If it's not valid JSON, use the text directly
              errorMessage = `BulkVS API error: ${errorText}`;
            }
          }
        } catch (textError) {
          console.error("Could not read error response text:", textError);
        }

        if (statusCode === 401) {
          errorMessage = "Unauthorized: BulkVS API credentials are invalid";
        } else if (statusCode === 403) {
          errorMessage = "Forbidden: BulkVS API access denied";
        } else if (statusCode === 404) {
          errorMessage = "Requested BulkVS resource does not exist";
        } else if (statusCode === 500) {
          errorMessage = "BulkVS server error. Please contact BulkVS support.";
        }

        throw new Error(errorMessage);
      }

      // If we can connect to the API but phone numbers aren't available via API,
      // assume the phone number provided during account setup is valid
      // This is specific to BulkVS's API limitations
      console.log("API connection successful, using provided phone number");
      return [{ number: this.phoneNumber, active: true }];
    } catch (error) {
      console.error("Failed to fetch BulkVS phone numbers:", error);
      throw error;
    }
  }

  // Debug method to fetch message data
  async getAllMessagesDebug(limit = 100): Promise<any> {
    try {
      // Try to get webhooks as a test of API connectivity
      let url = `${this.baseUrl}/webhooks`;

      console.log(`[DEBUG] Testing BulkVS API connectivity with: ${url}`);

      const response = await fetch(url, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const statusCode = response.status;
        console.error(`[DEBUG] BulkVS API error: ${statusCode}`, errorText);
        return { error: errorText, status: statusCode };
      }

      const responseText = await response.text();
      console.log(`[DEBUG] BulkVS API response: ${responseText}`);

      try {
        // Try to parse as JSON if possible
        return JSON.parse(responseText);
      } catch (parseError) {
        // If not valid JSON, return the text
        return { text: responseText };
      }
    } catch (error) {
      console.error("[DEBUG] Failed to test BulkVS API connectivity:", error);
      return { error };
    }
  }

  // Simple API check to test connectivity and authentication
  async checkApiStatus(): Promise<{
    success: boolean;
    message: string;
    responseCode?: number;
    responseBody?: string;
  }> {
    try {
      // Check API connectivity with webhooks endpoint
      const url = `${this.baseUrl}/webhooks`;

      console.log(`[DEBUG] Testing BulkVS API connectivity at ${url}`);

      const response = await fetch(url, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      const statusCode = response.status;
      const responseText = await response.text();

      console.log(`[DEBUG] BulkVS API status check response: ${statusCode}`);
      console.log(`[DEBUG] Response body: ${responseText}`);

      if (statusCode === 401 || statusCode === 403) {
        return {
          success: false,
          message: "Authentication failed. Please check your API credentials.",
          responseCode: statusCode,
          responseBody: responseText,
        };
      }

      if (statusCode === 404) {
        return {
          success: false,
          message: "API endpoint not found. Please verify the BulkVS API URL.",
          responseCode: statusCode,
          responseBody: responseText,
        };
      }

      // Even if we don't get a 2xx, if we get any response that's not a specific error,
      // it suggests the API is reachable
      return {
        success: statusCode >= 200 && statusCode < 300,
        message:
          statusCode >= 200 && statusCode < 300
            ? "API connection successful"
            : `API returned status code ${statusCode}`,
        responseCode: statusCode,
        responseBody: responseText,
      };
    } catch (error) {
      console.error("[DEBUG] BulkVS API connectivity test failed:", error);
      return {
        success: false,
        message: `API connection failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }
}
