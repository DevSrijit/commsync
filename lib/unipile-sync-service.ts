import { UnipileService, UnipileAccount } from "./unipile-service";
import { useEmailStore } from "./email-store";
import { Email } from "./types";
import { db } from "./db";

export class UnipileSyncService {
  private static instance: UnipileSyncService;
  private unipileService: UnipileService;
  private syncIntervalId: NodeJS.Timeout | null = null;
  private syncInProgress = false;
  private syncInterval = 30000; // 30 seconds

  private constructor() {
    this.unipileService = UnipileService.getInstance();
  }

  public static getInstance(): UnipileSyncService {
    if (!UnipileSyncService.instance) {
      UnipileSyncService.instance = new UnipileSyncService();
    }
    return UnipileSyncService.instance;
  }

  // Start periodic syncing
  public startSyncService(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }

    this.syncIntervalId = setInterval(() => {
      this.syncAllAccounts();
    }, this.syncInterval);

    console.log("Unipile sync service started");
  }

  // Stop periodic syncing
  public stopSyncService(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
      console.log("Unipile sync service stopped");
    }
  }

  // Sync all accounts for a user
  public async syncAccountsForUser(userId: string): Promise<number> {
    if (!userId) {
      return 0;
    }

    try {
      // Get all WhatsApp accounts for the user
      const accounts = await this.unipileService.getWhatsappAccounts(userId);

      if (accounts.length === 0) {
        return 0;
      }

      let totalMessages = 0;
      for (const account of accounts) {
        const messageCount = await this.syncAccount(account);
        totalMessages += messageCount;
      }

      return totalMessages;
    } catch (error) {
      console.error("Error syncing Unipile accounts for user:", error);
      return 0;
    }
  }

  // Sync all accounts (used for periodic sync)
  private async syncAllAccounts(): Promise<void> {
    if (this.syncInProgress) {
      return;
    }

    this.syncInProgress = true;

    try {
      // Get all accounts
      const accounts = await db.unipileAccount.findMany({
        where: { status: "connected" },
      });

      for (const account of accounts) {
        try {
          await this.syncAccount(account as unknown as UnipileAccount);
        } catch (error) {
          console.error(`Error syncing account ${account.id}:`, error);
        }
      }
    } catch (error) {
      console.error("Error syncing all Unipile accounts:", error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Sync a specific account
  private async syncAccount(account: UnipileAccount): Promise<number> {
    try {
      const chatResponse = await this.unipileService.getAllChats(account.id);

      if (!chatResponse || !chatResponse.items) {
        console.log(`No chats found for account ${account.id}`);
        return 0;
      }

      const chats = chatResponse.items || [];

      let totalMessages = 0;
      // For each chat, get all messages and update the store
      for (const chat of chats) {
        try {
          const messagesResponse =
            await this.unipileService.getAllMessagesFromChat(
              account.id,
              chat.id
            );

          if (messagesResponse && messagesResponse.items) {
            const formattedMessages = messagesResponse.items.map(
              (message: any) =>
                this.unipileService.convertToEmailFormat(message, account.id)
            );

            // Update the store with the new messages
            if (formattedMessages.length > 0) {
              this.updateEmailStore(formattedMessages);
              totalMessages += formattedMessages.length;
            }
          }
        } catch (error) {
          console.error(`Error syncing chat ${chat.id}:`, error);
        }
      }

      // Update the last sync time
      await db.unipileAccount.update({
        where: { id: account.id },
        data: { lastSync: new Date() },
      });

      return totalMessages;
    } catch (error) {
      console.error(`Error syncing account ${account.id}:`, error);
      return 0;
    }
  }

  // Handle webhook notifications
  public async handleWebhookEvent(event: any): Promise<void> {
    try {
      if (!event || !event.type) {
        console.error("Invalid webhook event:", event);
        return;
      }

      switch (event.type) {
        case "new_message":
          await this.handleNewMessage(event.data);
          break;
        case "account_status":
          await this.handleAccountStatus(event.data);
          break;
        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (error) {
      console.error("Error handling webhook event:", error);
    }
  }

  // Handle new message webhook
  private async handleNewMessage(data: any): Promise<void> {
    try {
      if (!data || !data.message) {
        return;
      }

      // Find the account in our database
      const account = await db.unipileAccount.findFirst({
        where: { accountIdentifier: data.account_id },
      });

      if (!account) {
        console.warn(`Account not found for webhook: ${data.account_id}`);
        return;
      }

      // Convert message to our format
      const formattedMessage = this.unipileService.convertToEmailFormat(
        data.message,
        account.id
      );

      // Update the store
      this.updateEmailStore([formattedMessage]);
    } catch (error) {
      console.error("Error handling new message webhook:", error);
    }
  }

  // Handle account status webhook
  private async handleAccountStatus(data: any): Promise<void> {
    try {
      if (!data || !data.account_id || !data.status) {
        return;
      }

      // Find the account in our database
      const account = await db.unipileAccount.findFirst({
        where: { accountIdentifier: data.account_id },
      });

      if (!account) {
        console.warn(
          `Account not found for status webhook: ${data.account_id}`
        );
        return;
      }

      // Update the account status
      await db.unipileAccount.update({
        where: { id: account.id },
        data: { status: data.status.toLowerCase() },
      });

      // If the account is disconnected, notify the user
      if (data.status.toLowerCase() === "disconnected") {
        // This would be handled by the UI when it checks account status
        console.log(`Account ${account.id} disconnected`);
      }
    } catch (error) {
      console.error("Error handling account status webhook:", error);
    }
  }

  // Update the email store with new messages
  private updateEmailStore(messages: Email[]): void {
    if (!messages || messages.length === 0) {
      return;
    }

    try {
      const store = useEmailStore.getState();
      const currentEmails = store.emails;

      // Check for duplicates and add only new messages
      const existingIds = new Set(currentEmails.map((e) => e.id));
      const newMessages = messages.filter((msg) => !existingIds.has(msg.id));

      if (newMessages.length > 0) {
        store.setEmails([...currentEmails, ...newMessages]);
      }
    } catch (error) {
      console.error("Error updating email store:", error);
    }
  }
}

// Get instance of the sync service
export const getUnipileSyncService = (): UnipileSyncService => {
  return UnipileSyncService.getInstance();
};
