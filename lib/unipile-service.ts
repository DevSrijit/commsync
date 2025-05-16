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
  async getWhatsappQRCode(): Promise<{ qrCodeString: string; code: string }> {
    return this.client.account.connectWhatsapp();
  }

  /**
   * Fetch all chats for a connected WhatsApp account
   */
  async getAllWhatsAppChats(accountId: string): Promise<any> {
    return this.client.messaging.getAllChats({ account_id: accountId });
  }

  /**
   * Fetch all messages for a specific WhatsApp chat
   */
  async getWhatsAppMessages(chatId: string): Promise<any> {
    return this.client.messaging.getAllMessagesFromChat({ chat_id: chatId });
  }

  /**
   * Send a WhatsApp message to a chat
   */
  async sendWhatsAppMessage(
    chatId: string,
    text: string,
    attachments?: Array<[string, Buffer]>
  ): Promise<any> {
    return this.client.messaging.sendMessage({
      chat_id: chatId,
      text,
      attachments,
    });
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

    // Fetch the SyncAccount to get the userId
    let syncAccount = null;
    if (data.account_id) {
      syncAccount = await db.syncAccount.findUnique({
        where: { id: data.account_id },
      });
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
        }
        break;

      case "message.created":
      case "messaging.message.created":
      case "whatsapp.message.created":
        // Handle new messages
        if (Array.isArray(data.messages)) {
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
            await db.message.create({
              data: {
                conversationId: conversation.id,
                syncAccountId: data.account_id,
                platform: "whatsapp",
                externalId: msg.id,
                direction: msg.direction,
                content: msg.text || msg.body || "",
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
}
