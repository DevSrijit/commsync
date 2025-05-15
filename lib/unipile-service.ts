import { UnipileClient } from "unipile-node-sdk";
import { db } from "./db";
import { Email } from "./types";
import { MessageData } from "./messaging";

// Define types for Unipile account stored in our database
export interface UnipileAccount {
  id: string;
  userId: string;
  provider: string; // whatsapp, linkedin, instagram, etc.
  accountIdentifier: string;
  credentials?: any;
  lastSync?: Date;
  status: string; // pending, connected, disconnected
}

// Define types for the Unipile message
export interface UnipileMessage {
  id: string;
  chatId: string;
  accountId: string;
  provider: string;
  from: {
    name: string;
    email: string;
  };
  to: {
    name: string;
    email: string;
  }[];
  date: string;
  subject: string;
  body: string;
  text?: string;
  attachments?: any[];
  labels?: string[];
}

export class UnipileService {
  private static instance: UnipileService;
  private client: UnipileClient | null = null;
  private dsn: string;
  private accessToken: string;

  private constructor() {
    this.dsn = process.env.UNIPILE_DSN || "";
    this.accessToken = process.env.UNIPILE_ACCESS_TOKEN || "";
    this.initClient();
  }

  private initClient() {
    if (this.dsn && this.accessToken) {
      this.client = new UnipileClient(this.dsn, this.accessToken);
    } else {
      console.error("Missing Unipile credentials");
    }
  }

  public static getInstance(): UnipileService {
    if (!UnipileService.instance) {
      UnipileService.instance = new UnipileService();
    }
    return UnipileService.instance;
  }

  // Method to connect a WhatsApp account
  public async connectWhatsapp(userId: string): Promise<{
    qrCodeString: string;
    account: UnipileAccount;
  }> {
    if (!this.client) {
      throw new Error("Unipile client not initialized");
    }

    try {
      // Connect to WhatsApp and get QR code
      const response = await this.client.account.connectWhatsapp();

      // Convert ASCII QR code to SVG if needed (for display purposes)
      let qrCodeString = response.qrCodeString;

      // Create a temporary account entry in the database
      const newAccount = await db.unipileAccount.create({
        data: {
          userId,
          provider: "whatsapp",
          accountIdentifier: "pending", // Will be updated once connection is complete
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      return {
        qrCodeString,
        account: newAccount as unknown as UnipileAccount,
      };
    } catch (error) {
      console.error("Failed to connect WhatsApp:", error);
      throw error;
    }
  }

  // Method to check connection status and update account if connected
  public async checkConnectionStatus(
    accountId: string
  ): Promise<{ status: string; accountIdentifier?: string }> {
    if (!this.client) {
      throw new Error("Unipile client not initialized");
    }

    try {
      const account = await db.unipileAccount.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        throw new Error("Account not found");
      }

      // Get all accounts to find any connected WhatsApp accounts
      const accounts = await this.client.account.getAll();

      // Find WhatsApp account by checking credentials or other identifiers
      const whatsappAccount = accounts.items.find(
        (a: any) =>
          a.id.includes("whatsapp") ||
          (a.connection_params && a.connection_params.type === "WHATSAPP")
      );

      if (whatsappAccount) {
        // Update the account with proper details
        const updatedAccount = await db.unipileAccount.update({
          where: { id: accountId },
          data: {
            accountIdentifier: whatsappAccount.id,
            status: "connected",
            updatedAt: new Date(),
            lastSync: new Date(),
          },
        });

        return {
          status: "connected",
          accountIdentifier: whatsappAccount.id,
        };
      }

      return { status: "pending" };
    } catch (error) {
      console.error("Failed to check connection status:", error);
      throw error;
    }
  }

  // Method to get all chats for an account
  public async getAllChats(accountId: string): Promise<any> {
    if (!this.client) {
      throw new Error("Unipile client not initialized");
    }

    try {
      const account = await db.unipileAccount.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        throw new Error("Account not found");
      }

      const chats = await this.client.messaging.getAllChats({
        account_id: account.accountIdentifier,
      });

      return chats;
    } catch (error) {
      console.error("Failed to get chats:", error);
      throw error;
    }
  }

  // Method to get all messages from a chat
  public async getAllMessagesFromChat(
    accountId: string,
    chatId: string
  ): Promise<any> {
    if (!this.client) {
      throw new Error("Unipile client not initialized");
    }

    try {
      const account = await db.unipileAccount.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        throw new Error("Account not found");
      }

      const messages = await this.client.messaging.getAllMessagesFromChat({
        chat_id: chatId,
      });

      return messages;
    } catch (error) {
      console.error("Failed to get messages:", error);
      throw error;
    }
  }

  // Method to send a message
  public async sendMessage(
    messageData: MessageData,
    userAccessToken?: string
  ): Promise<any> {
    if (!this.client) {
      throw new Error("Unipile client not initialized");
    }

    try {
      // Get the account from our database
      const account = await db.unipileAccount.findFirst({
        where: { accountIdentifier: messageData.accountId },
      });

      if (!account) {
        throw new Error("Account not found");
      }

      // Check if we need to start a new chat or send to existing chat
      if (messageData.threadId) {
        // Send to existing chat
        const response = await this.client.messaging.sendMessage({
          chat_id: messageData.threadId,
          text: messageData.content,
          // Handle attachments if needed
          attachments: messageData.attachments
            ? await this.processAttachments(messageData.attachments)
            : undefined,
        });

        return response;
      } else if (messageData.recipients && messageData.recipients.length > 0) {
        // Start a new chat
        const response = await this.client.messaging.startNewChat({
          account_id: account.accountIdentifier,
          attendees_ids: Array.isArray(messageData.recipients)
            ? messageData.recipients
            : [messageData.recipients],
          text: messageData.content,
          // Handle attachments if needed
          attachments: messageData.attachments
            ? await this.processAttachments(messageData.attachments)
            : undefined,
        });

        return response;
      } else {
        throw new Error("No recipients or thread ID provided");
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      throw error;
    }
  }

  // Helper method to process attachments for Unipile
  private async processAttachments(files: File[]): Promise<any[]> {
    // Implementation for handling attachments with Unipile
    // This would involve converting each file to the format expected by Unipile
    const attachments = [];

    try {
      for (const file of files) {
        const buffer = await file.arrayBuffer();
        const base64Data = Buffer.from(buffer).toString("base64");

        attachments.push({
          filename: file.name,
          content_type: file.type,
          data: base64Data,
        });
      }
    } catch (error) {
      console.error("Error processing attachments:", error);
    }

    return attachments;
  }

  // Convert Unipile message to our Email type
  public convertToEmailFormat(message: any, accountId: string): Email {
    return {
      id: message.id,
      threadId: message.chatId,
      from: {
        name: message.from?.name || "",
        email: message.from?.email || "",
      },
      to: message.to || [],
      subject: message.subject || "",
      snippet: message.text?.substring(0, 100) || "",
      body: message.text || message.body || "",
      date: message.date || new Date().toISOString(),
      labels: ["UNIPILE", `PROVIDER_${message.provider.toUpperCase()}`],
      attachments: message.attachments || [],
      accountId: accountId,
      accountType: "unipile",
      platform: message.provider.toLowerCase(),
    };
  }

  // Get all WhatsApp accounts for a user
  public async getWhatsappAccounts(userId: string): Promise<UnipileAccount[]> {
    try {
      const accounts = await db.unipileAccount.findMany({
        where: {
          userId,
          provider: "whatsapp",
          status: "connected",
        },
      });

      return accounts as unknown as UnipileAccount[];
    } catch (error) {
      console.error("Failed to get WhatsApp accounts:", error);
      throw error;
    }
  }

  // Delete a Unipile account
  public async deleteAccount(accountId: string): Promise<void> {
    if (!this.client) {
      throw new Error("Unipile client not initialized");
    }

    if (!accountId) {
      throw new Error("Account ID is required");
    }

    try {
      const account = await db.unipileAccount.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        throw new Error("Account not found");
      }

      // First remove from Unipile if possible
      try {
        await this.client.account.delete(accountId);
      } catch (error) {
        console.warn("Failed to remove account from Unipile:", error);
        // Continue to remove locally even if Unipile removal fails
      }

      // Then remove from our database
      await db.unipileAccount.delete({
        where: { id: accountId },
      });
    } catch (error) {
      console.error("Failed to delete account:", error);
      throw error;
    }
  }
}

// Get instance of the service
export const getUnipileService = (): UnipileService => {
  return UnipileService.getInstance();
};
