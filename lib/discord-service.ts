import { db } from "@/lib/db";
import axios from "axios";

interface DiscordAccountData {
  id: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  discordUserId: string;
}

export class DiscordService {
  private account: DiscordAccountData;
  private baseUrl: string;

  constructor(account: DiscordAccountData) {
    this.account = account;
    this.baseUrl =
      process.env.DISCORD_MIDDLEWARE_URL || "http://localhost:3001";
  }

  /**
   * Register a Discord account with the middleware
   */
  public async register(): Promise<boolean> {
    try {
      const response = await axios.post(`${this.baseUrl}/register`, {
        accountId: this.account.id,
        accessToken: this.account.accessToken,
        refreshToken: this.account.refreshToken,
        expiresAt: this.account.expiresAt.toISOString(),
        discordUserId: this.account.discordUserId,
      });

      return response.status === 200;
    } catch (error) {
      console.error("Error registering Discord account:", error);
      return false;
    }
  }

  /**
   * Unregister a Discord account from the middleware
   */
  public async unregister(): Promise<boolean> {
    try {
      const response = await axios.post(`${this.baseUrl}/unregister`, {
        accountId: this.account.id,
      });

      return response.status === 200;
    } catch (error) {
      console.error("Error unregistering Discord account:", error);
      return false;
    }
  }

  /**
   * Sync channels and their messages
   */
  public async syncChannels(): Promise<boolean> {
    try {
      const response = await axios.post(`${this.baseUrl}/sync`, {
        accountId: this.account.id,
      });

      if (response.status === 200) {
        // Update last sync time
        await db.discordAccount.update({
          where: { id: this.account.id },
          data: { lastSync: new Date() },
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error syncing Discord channels:", error);
      return false;
    }
  }

  /**
   * Send a message to a Discord channel
   */
  public async sendMessage(
    channelId: string,
    content: string
  ): Promise<boolean> {
    try {
      // Get the channel from the database
      const dbChannel = await db.discordChannel.findFirst({
        where: {
          id: channelId,
          discordAccounts: {
            some: {
              id: this.account.id,
            },
          },
        },
      });

      if (!dbChannel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      const response = await axios.post(`${this.baseUrl}/send-message`, {
        accountId: this.account.id,
        discordChannelId: dbChannel.discordChannelId,
        content,
      });

      // The middleware server already creates the message record in the database
      // So we just need to check if the request was successful
      return response.status === 200 && response.data.success;
    } catch (error) {
      console.error("Error sending Discord message:", error);
      return false;
    }
  }

  /**
   * Get messages for a channel
   */
  public async getMessages(
    channelId: string,
    limit: number = 50,
    before?: string
  ): Promise<any[]> {
    try {
      // Get messages from the database
      const messages = await db.discordMessage.findMany({
        where: {
          channelId: channelId,
          ...(before ? { discordMessageId: { lt: before } } : {}),
        },
        orderBy: {
          timestamp: "desc",
        },
        take: limit,
      });

      return messages;
    } catch (error) {
      console.error("Error getting Discord messages:", error);
      return [];
    }
  }

  /**
   * Mark a message as read
   */
  public async markMessageAsRead(messageId: string): Promise<boolean> {
    try {
      await db.discordMessage.update({
        where: { id: messageId },
        data: { isRead: true },
      });
      return true;
    } catch (error) {
      console.error("Error marking Discord message as read:", error);
      return false;
    }
  }

  /**
   * Get channels for this account
   */
  public async getChannels(): Promise<any[]> {
    try {
      const channels = await db.discordChannel.findMany({
        where: {
          discordAccounts: {
            some: {
              id: this.account.id,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      return channels;
    } catch (error) {
      console.error("Error getting Discord channels:", error);
      return [];
    }
  }
}
