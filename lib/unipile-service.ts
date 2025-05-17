import crypto from "crypto";
import { UnipileClient } from "unipile-node-sdk";
import { db } from "@/lib/db";

export interface UnipileServiceOptions {
  /** The base URL for your Unipile instance (e.g. https://api.unipile.com) */
  baseUrl: string;
  /** Unipile access token */
  accessToken: string;
}

export class UnipileService {
  private client: UnipileClient;

  constructor(options: UnipileServiceOptions) {
    this.client = new UnipileClient(options.baseUrl, options.accessToken);
  }

  /**
   * Initiate a WhatsApp connection by retrieving the QR code string and code
   */
  async getWhatsappQRCode(): Promise<{
    qrCodeString: string;
    code: string;
    accountId: string;
  }> {
    try {
      // Initiate WhatsApp connection and retrieve QR code, code, and Unipile account ID
      const response = await this.client.account.connectWhatsapp();
      console.log("WhatsApp connection response:", response);

      if (!response || !response.account_id) {
        throw new Error("Invalid response from Unipile connectWhatsapp");
      }

      const { qrCodeString, code, account_id } = response;
      return { qrCodeString, code, accountId: account_id };
    } catch (error) {
      console.error("Error in getWhatsappQRCode:", error);
      throw error;
    }
  }

  /**
   * Fetch all chats for a connected WhatsApp account
   */
  async getAllWhatsAppChats(accountId: string): Promise<any> {
    if (!accountId) {
      throw new Error("Missing accountId parameter");
    }

    try {
      console.log(`Fetching chats for Unipile account ID: ${accountId}`);
      const response = await this.client.messaging.getAllChats({
        account_id: accountId,
      });

      // Handle and log the response format
      if (response && response.items && Array.isArray(response.items)) {
        console.log(
          `Retrieved ${response.items.length} chats with pagination format`
        );
        // The API returns an object with 'items' array - convert to our expected format
        // to maintain compatibility with the rest of the codebase
        return {
          chats: response.items,
          cursor: response.cursor || null,
        };
      } else if (Array.isArray(response)) {
        console.log(`Retrieved ${response.length} chats as direct array`);
        // Return the array wrapped in our expected format
        return {
          chats: response,
          cursor: null,
        };
      } else {
        console.error(`Unexpected response format:`, response);
        throw new Error(`Invalid response format from Unipile API`);
      }
    } catch (error) {
      console.error(
        `Error in getAllWhatsAppChats for account ${accountId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Fetch all or incremental messages for a specific WhatsApp chat
   */
  async getWhatsAppMessages(
    chatId: string,
    options?: {
      afterId?: string;
      beforeId?: string;
      limit?: number;
      sortDirection?: "asc" | "desc";
      accountId?: string;
    }
  ): Promise<any> {
    if (!chatId) {
      throw new Error("Missing chatId parameter");
    }

    try {
      const params: any = { chat_id: chatId };

      // Apply all filtering and pagination options
      if (options?.afterId) params.after_id = options.afterId;
      if (options?.beforeId) params.before_id = options.beforeId;
      if (options?.limit) params.limit = options.limit;
      if (options?.sortDirection) params.sort_direction = options.sortDirection;
      if (options?.accountId) params.account_id = options.accountId;

      console.log(`Fetching messages for chat ${chatId} with params:`, params);
      const response = await this.client.messaging.getAllMessagesFromChat(
        params
      );

      // Handle and log the response format
      if (response && response.items && Array.isArray(response.items)) {
        console.log(
          `Retrieved ${response.items.length} messages with pagination format`
        );
        // The API returns an object with 'items' array - convert to our expected format
        return {
          messages: response.items,
          cursor: response.cursor || null,
        };
      } else if (Array.isArray(response)) {
        console.log(`Retrieved ${response.length} messages as direct array`);
        // Return the array wrapped in our expected format
        return {
          messages: response,
          cursor: null,
        };
      } else {
        console.error(`Unexpected response format:`, response);
        throw new Error(`Invalid response format from Unipile API`);
      }
    } catch (error) {
      console.error(`Error in getWhatsAppMessages for chat ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * Send a WhatsApp message to a chat
   */
  async sendWhatsAppMessage(
    chatId: string,
    text: string,
    attachments?: Array<[string, Buffer]>
  ): Promise<any> {
    if (!chatId) {
      throw new Error("Missing chatId parameter");
    }

    try {
      console.log(`Sending message to chat ${chatId}`);
      const result = await this.client.messaging.sendMessage({
        chat_id: chatId,
        text,
        attachments,
      });
      return result;
    } catch (error) {
      console.error(`Error in sendWhatsAppMessage for chat ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * Verify webhook signature using HMAC-SHA256
   */
  private verifySignature(
    rawBody: string,
    signature: string,
    secret: string
  ): boolean {
    // Signature format: sha256=<hash>
    const [algo, hash] = signature.split("=");
    if (!algo || !hash) return false;
    // Only support sha256
    if (algo !== "sha256") return false;
    const hmac = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(hash));
  }

  /**
   * Handle incoming WhatsApp webhook events: verify signature, parse JSON, dispatch logic
   */
  async handleWebhook(rawBody: string, signature?: string): Promise<any> {
    if (!signature) {
      throw new Error("Missing webhook signature");
    }
    const secret = process.env.UNIPILE_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error("Missing UNIPILE_WEBHOOK_SECRET environment variable");
    }
    if (!this.verifySignature(rawBody, signature, secret)) {
      throw new Error("Invalid webhook signature");
    }
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch (err) {
      throw new Error("Invalid JSON payload");
    }

    const eventType = payload.event || payload.type;
    const data = payload.data || payload.body;

    console.log(`Processing webhook event: ${eventType}`, data);

    // Fetch the SyncAccount to get the userId by Unipile account ID
    let syncAccount = null;
    if (data.account_id) {
      syncAccount = await db.syncAccount.findUnique({
        where: { accountIdentifier: data.account_id },
      });

      if (!syncAccount) {
        console.error(
          `SyncAccount not found for Unipile account ID: ${data.account_id}`
        );
      } else {
        console.log(
          `Found SyncAccount: ${syncAccount.id} for Unipile account ID: ${data.account_id}`
        );
      }
    }

    switch (eventType) {
      case "account.source.connection.updated":
      case "account.source.status":
        // Update lastSync timestamp for the SyncAccount
        if (syncAccount) {
          await db.syncAccount.update({
            where: { id: syncAccount.id },
            data: { lastSync: new Date() },
          });
          console.log(`Updated lastSync for account ${syncAccount.id}`);
        }
        break;

      case "message.created":
      case "messaging.message.created":
      case "whatsapp.message.created":
        // Handle new messages
        if (Array.isArray(data.messages)) {
          console.log(
            `Processing ${data.messages.length} messages from webhook`
          );
          for (const msg of data.messages) {
            // Upsert conversation by chat_id
            let conversation = await db.conversation.findUnique({
              where: { id: msg.chat_id },
            });
            if (!conversation) {
              if (!syncAccount) {
                throw new Error(
                  `SyncAccount not found for id ${data.account_id}`
                );
              }
              console.log(`Creating new conversation for chat ${msg.chat_id}`);
              conversation = await db.conversation.create({
                data: {
                  id: msg.chat_id,
                  title: msg.chat_id,
                  contact: {
                    connectOrCreate: {
                      where: { id: msg.chat_id },
                      create: {
                        id: msg.chat_id,
                        userId: syncAccount.userId,
                        name: msg.chat_id,
                        email: msg.from || msg.chat_id,
                      },
                    },
                  },
                },
              });
            }
            // Create message record
            console.log(
              `Storing message ${msg.id} in conversation ${conversation.id}`
            );
            await db.message.create({
              data: {
                conversationId: conversation.id,
                // Use internal sync account ID
                syncAccountId: syncAccount.id,
                platform: "whatsapp",
                externalId: msg.id,
                direction:
                  msg.direction || (msg.is_sender ? "outbound" : "inbound"),
                content: msg.text || msg.body || "",
                contentType: "text",
                metadata: msg,
                sentAt: msg.timestamp ? new Date(msg.timestamp) : new Date(),
              },
            });
          }
        }
        break;

      default:
        // Unknown event; ignore or log
        console.warn(`Unhandled webhook event type: ${eventType}`);
    }

    return payload;
  }

  /**
   * Reconnect an existing WhatsApp account (e.g., after device logout)
   */
  async reconnectWhatsapp(accountId: string): Promise<{
    qrCodeString: string;
    code: string;
    accountId: string;
  }> {
    try {
      if (!accountId) {
        throw new Error("Missing accountId parameter");
      }

      console.log(`Reconnecting WhatsApp account: ${accountId}`);
      const response = await this.client.account.reconnectWhatsapp(accountId);
      console.log("WhatsApp reconnection response:", response);

      if (!response || !response.account_id) {
        throw new Error("Invalid response from Unipile reconnectWhatsapp");
      }

      const { qrCodeString, code, account_id } = response;
      return { qrCodeString, code, accountId: account_id };
    } catch (error) {
      console.error(
        `Error in reconnectWhatsapp for account ${accountId}:`,
        error
      );
      throw error;
    }
  }
}
