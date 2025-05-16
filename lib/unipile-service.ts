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
      console.log(`Checking connection status for account ID: ${accountId}`);

      // Get the pending account from our database
      const pendingAccount = await db.unipileAccount.findUnique({
        where: { id: accountId },
      });

      if (!pendingAccount) {
        throw new Error("Account not found");
      }

      console.log(
        `Found pending account with status: ${pendingAccount.status}`
      );

      // If account is already marked as connected in our DB, return that status
      if (
        pendingAccount.status === "connected" &&
        pendingAccount.accountIdentifier
      ) {
        console.log("Account already marked as connected in database");
        return {
          status: "connected",
          accountIdentifier: pendingAccount.accountIdentifier,
        };
      }

      // Get all accounts from Unipile
      console.log("Fetching all accounts from Unipile");
      const accounts = await this.client.account.getAll();
      console.log(`Received ${accounts.items.length} accounts from Unipile`);

      // Debug log accounts structure
      console.log(
        "Accounts structure:",
        JSON.stringify(
          accounts.items.map((a) => ({
            id: a.id,
            providerInfo: a.connection_params
              ? JSON.stringify(a.connection_params).substring(0, 100)
              : "none",
            hasWhatsAppSignature:
              typeof a.id === "string" &&
              a.id.toLowerCase().includes("whatsapp"),
          })),
          null,
          2
        )
      );

      // Find any recently connected WhatsApp accounts
      // More robust matching: check for connection types and ID patterns
      const whatsappAccounts = accounts.items.filter((a: any) => {
        console.log(`Checking account ${a.id} for WhatsApp indicators`);

        // Check ID format (not always reliable)
        if (
          typeof a.id === "string" &&
          a.id.toLowerCase().includes("whatsapp")
        ) {
          console.log(`Account ${a.id} matched by ID containing 'whatsapp'`);
          return true;
        }

        // Check if it has phone number in the im field (strong indicator of WhatsApp)
        if (
          a.connection_params &&
          a.connection_params.im &&
          a.connection_params.im.phone_number
        ) {
          console.log(
            `Account ${a.id} matched by having im.phone_number: ${a.connection_params.im.phone_number}`
          );
          return true;
        }

        // Check provider field if available
        if (
          a.provider &&
          typeof a.provider === "string" &&
          a.provider.toLowerCase() === "whatsapp"
        ) {
          console.log(
            `Account ${a.id} matched by provider field being 'whatsapp'`
          );
          return true;
        }

        // Check connection params type (not always reliable)
        if (
          a.connection_params &&
          a.connection_params.type &&
          typeof a.connection_params.type === "string" &&
          a.connection_params.type.toLowerCase() === "whatsapp"
        ) {
          console.log(
            `Account ${a.id} matched by connection_params.type being 'whatsapp'`
          );
          return true;
        }

        // Check any other field in connection_params that might indicate WhatsApp
        if (a.connection_params) {
          const paramsStr = JSON.stringify(a.connection_params).toLowerCase();
          if (paramsStr.includes("whatsapp")) {
            console.log(
              `Account ${a.id} matched by 'whatsapp' appearing in connection_params`
            );
            return true;
          }
        }

        // For the account shown in logs, we know it has a phone number in im.phone_number
        // This is a good indicator that it's a WhatsApp account
        console.log(`Account ${a.id} did not match any WhatsApp indicators`);
        return false;
      });

      console.log(`Found ${whatsappAccounts.length} WhatsApp accounts`);

      if (whatsappAccounts.length > 0) {
        // Get the most recently created WhatsApp account
        const mostRecentAccount = whatsappAccounts.sort((a, b) => {
          // Sort by creation time if available, newest first
          if (a.created_at && b.created_at) {
            return (
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
            );
          }
          return 0;
        })[0];

        console.log(`Most recent WhatsApp account ID: ${mostRecentAccount.id}`);

        // Update the account with proper details
        const updatedAccount = await db.unipileAccount.update({
          where: { id: accountId },
          data: {
            accountIdentifier: mostRecentAccount.id,
            status: "connected",
            updatedAt: new Date(),
            lastSync: new Date(),
          },
        });

        console.log(`Updated account in database, new status: connected`);

        // Start syncing messages for this account
        this.syncUnipileMessages(accountId, mostRecentAccount.id);

        return {
          status: "connected",
          accountIdentifier: mostRecentAccount.id,
        };
      }

      // FALLBACK: If no WhatsApp accounts were detected but there's only one account total,
      // it's very likely to be our WhatsApp account that didn't match our detection criteria
      if (whatsappAccounts.length === 0 && accounts.items.length === 1) {
        const onlyAccount = accounts.items[0];
        console.log(
          `Using fallback detection: Single account found with ID ${onlyAccount.id}`
        );

        // Check if it has any phone number indicators (strong WhatsApp signal)
        const accountJson = JSON.stringify(onlyAccount).toLowerCase();
        const hasPhoneRef =
          accountJson.includes("phone") || accountJson.includes("whatsapp");

        // Safely check if connection_params has an 'im' property
        const hasImField =
          onlyAccount.connection_params &&
          typeof onlyAccount.connection_params === "object" &&
          Object.prototype.hasOwnProperty.call(
            onlyAccount.connection_params,
            "im"
          );

        const likelyWhatsApp = hasPhoneRef || hasImField;

        if (likelyWhatsApp) {
          console.log(
            `The single account has phone number indicators, treating as WhatsApp`
          );

          // Update the account with the details
          const updatedAccount = await db.unipileAccount.update({
            where: { id: accountId },
            data: {
              accountIdentifier: onlyAccount.id,
              status: "connected",
              updatedAt: new Date(),
              lastSync: new Date(),
            },
          });

          console.log(`Updated account in database using fallback detection`);

          // Start syncing messages for this account
          this.syncUnipileMessages(accountId, onlyAccount.id);

          return {
            status: "connected",
            accountIdentifier: onlyAccount.id,
          };
        }
      }

      // No connected WhatsApp account found
      console.log("No connected WhatsApp account found");
      return { status: "pending" };
    } catch (error) {
      console.error("Failed to check connection status:", error);
      throw error;
    }
  }

  // Method to sync messages for any Unipile-connected account (WhatsApp, Instagram, etc)
  public async syncUnipileMessages(
    dbAccountId: string,
    unipileAccountId: string
  ): Promise<void> {
    if (!this.client) {
      throw new Error("Unipile client not initialized");
    }

    // Get the account info to identify the provider
    const account = await db.unipileAccount.findUnique({
      where: { id: dbAccountId },
    });

    const provider = account?.provider || "unknown";
    console.log(
      `Starting Unipile message sync for ${provider} account: ${unipileAccountId}`
    );

    try {
      // Get all chats for the account
      const chats = await this.client.messaging.getAllChats({
        account_id: unipileAccountId,
      });

      console.log(`Found ${chats?.items?.length || 0} ${provider} chats`);

      // Process each chat to get messages
      let allMessages: Email[] = [];

      // Safely access the items array using optional chaining
      const chatItems = chats?.items || [];

      if (chatItems.length > 0) {
        // Process chats in parallel with a concurrency limit
        const concurrencyLimit = 3; // Process 3 chats at a time
        let processedCount = 0;

        // Process chats in batches
        for (let i = 0; i < chatItems.length; i += concurrencyLimit) {
          const chatBatch = chatItems.slice(i, i + concurrencyLimit);
          const chatPromises = chatBatch.map(async (chat: any) => {
            try {
              // Make sure chat and chat.id are defined
              if (!chat || !chat.id) {
                console.warn("Found invalid chat without ID, skipping");
                return [];
              }

              console.log(`Fetching messages for chat: ${chat.id}`);

              // Get all messages from this chat
              const messages =
                await this?.client?.messaging?.getAllMessagesFromChat({
                  chat_id: chat.id,
                });

              // Safely access the items array using optional chaining
              const messageItems = messages?.items || [];

              console.log(
                `Found ${messageItems.length} messages in chat ${chat.id}`
              );

              // Convert messages to our Email format
              return messageItems.map((message: any) =>
                this.convertToEmailFormat(message, dbAccountId)
              );
            } catch (chatError) {
              console.error(
                `Error fetching messages for chat ${chat.id}:`,
                chatError
              );
              return [];
            }
          });

          // Wait for this batch to complete
          const batchResults = await Promise.all(chatPromises);
          const batchMessages = batchResults.flat();
          allMessages = [...allMessages, ...batchMessages];

          processedCount += chatBatch.length;
          console.log(
            `Processed ${processedCount}/${chatItems.length} chats, found ${batchMessages.length} messages in this batch`
          );
        }
      }

      console.log(`Total ${provider} messages fetched: ${allMessages.length}`);

      // Add messages to email store
      if (allMessages.length > 0) {
        const emailStore = require("./email-store").useEmailStore.getState();

        // Add each message to the store
        for (const message of allMessages) {
          emailStore.addEmail(message);
        }

        console.log(
          `Added ${allMessages.length} ${provider} messages to email store`
        );

        // Update last sync time
        await db.unipileAccount.update({
          where: { id: dbAccountId },
          data: {
            lastSync: new Date(),
          },
        });
      }
    } catch (error) {
      console.error(`Error syncing ${provider} messages:`, error);
      // Don't throw the error - allow the connection to proceed even if sync fails
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
        // Use the accountIdentifier from Unipile, not our internal ID
        await this.client.account.delete(account.accountIdentifier);
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
