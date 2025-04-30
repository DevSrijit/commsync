import { create } from "zustand";
import { DiscordService } from "@/lib/discord-service";
import { db } from "@/lib/db";
import {
  getCacheValue,
  getMultipleCacheValues,
  setCacheValue,
  removeCacheValue,
} from "./client-cache-browser";

// Define types for realtime platforms
export type RealtimePlatform =
  | "discord"
  | "whatsapp"
  | "telegram"
  | "twitter"
  | "linkedin";

// Define types for realtime messages
export interface RealtimeMessage {
  id: string;
  channelId: string;
  content: string;
  author: {
    id: string;
    username: string;
    avatar?: string;
  };
  timestamp: Date;
  editedTimestamp?: Date | null;
  platform: RealtimePlatform;
  isRead?: boolean;
  attachments?: any[];
  embeds?: any[];
  reactions?: any[];
  mentions?: any[];
  reference?: RealtimeMessageReference;
}

// Message reference for replies
export interface RealtimeMessageReference {
  messageId: string;
  channelId: string;
}

// Channel types
export interface RealtimeChannel {
  id: string;
  name: string;
  type: string;
  platform: RealtimePlatform;
  platformChannelId: string; // Original ID from the platform
  lastMessageId?: string;
  updatedAt: Date;
  recipients?: any[];
  accountId: string;
  unreadCount?: number;
}

// Interface for Discord accounts
export interface DiscordAccount {
  id: string;
  discordUserId: string;
  username?: string;
  avatar?: string;
  lastSync?: Date;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

// Interface for the store state
interface RealtimeStore {
  // State
  channels: RealtimeChannel[];
  messages: Record<string, RealtimeMessage[]>; // channelId -> messages
  activeChannelId: string | null;
  activePlatform: RealtimePlatform | null;
  discordAccounts: DiscordAccount[];
  isLoading: boolean;

  // Actions
  setActiveChannel: (channelId: string, platform: RealtimePlatform) => void;
  clearActiveChannel: () => void;
  fetchChannels: () => Promise<void>;
  fetchMessages: (
    channelId: string,
    before?: string
  ) => Promise<RealtimeMessage[]>;
  sendMessage: (content: string, attachments?: File[]) => Promise<boolean>;
  markMessageAsRead: (messageId: string, channelId: string) => Promise<boolean>;
  syncDiscordChannels: (accountId?: string) => Promise<boolean>;
  addDiscordAccount: (account: DiscordAccount) => void;
  removeDiscordAccount: (id: string) => void;
  getDiscordAccount: (id: string) => DiscordAccount | undefined;
  setDiscordAccounts: (accounts: DiscordAccount[]) => void;
}

// Helper function to load persisted data
const loadPersistedData = async () => {
  // Always return empty arrays during server-side rendering
  if (typeof window === "undefined") {
    return {
      channels: [],
      messages: {},
      discordAccounts: [],
    };
  }

  try {
    // Use the browser cache client to get multiple values at once
    const cacheData = await getMultipleCacheValues([
      "realtimeChannels",
      "realtimeMessages",
      "discordAccounts",
    ]);

    return {
      channels: cacheData.realtimeChannels || [],
      messages: cacheData.realtimeMessages || {},
      discordAccounts: cacheData.discordAccounts || [],
    };
  } catch (e) {
    console.error("Failed to load persisted realtime data:", e);
    return {
      channels: [],
      messages: {},
      discordAccounts: [],
    };
  }
};

// Create the realtime store
export const useRealtimeStore = create<RealtimeStore>((set, get) => {
  // Initialize with empty data, we'll load asynchronously
  const initialData = {
    channels: [],
    messages: {},
    discordAccounts: [],
  };

  // Load data asynchronously after initialization
  if (typeof window !== "undefined") {
    void (async () => {
      try {
        const persistedData = await loadPersistedData();
        set({
          channels: persistedData.channels,
          messages: persistedData.messages,
          discordAccounts: persistedData.discordAccounts,
        });
      } catch (error) {
        console.error("Error loading persisted realtime data:", error);
      }
    })();
  }

  return {
    // State
    channels: initialData.channels,
    messages: initialData.messages,
    activeChannelId: null,
    activePlatform: null,
    discordAccounts: initialData.discordAccounts,
    isLoading: false,

    // Actions
    setActiveChannel: (channelId: string, platform: RealtimePlatform) => {
      set({
        activeChannelId: channelId,
        activePlatform: platform,
      });
    },

    clearActiveChannel: () => {
      set({
        activeChannelId: null,
        activePlatform: null,
      });
    },

    fetchChannels: async () => {
      set({ isLoading: true });
      try {
        const { discordAccounts } = get();
        const allChannels: RealtimeChannel[] = [];

        // Discord channels
        for (const account of discordAccounts) {
          try {
            const discordService = new DiscordService(account);
            const discordChannels = await discordService.getChannels();

            // Convert discord channels to standardized format
            const formattedChannels = discordChannels.map((channel: any) => ({
              id: channel.id,
              name: channel.name || "Direct Message",
              type: channel.type,
              platform: "discord" as RealtimePlatform,
              platformChannelId: channel.discordChannelId,
              lastMessageId: channel.lastMessageId,
              updatedAt: new Date(channel.updatedAt),
              recipients: channel.recipients || [],
              accountId: account.id,
              unreadCount: 0, // Will be calculated later
            }));

            allChannels.push(...formattedChannels);
          } catch (error) {
            console.error(
              `Error fetching Discord channels for account ${account.id}:`,
              error
            );
          }
        }

        // Add more platform channels here as we implement them...

        // Sort channels by updatedAt descending
        allChannels.sort(
          (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
        );

        set({ channels: allChannels });
        setCacheValue("realtimeChannels", allChannels);
      } catch (error) {
        console.error("Error fetching realtime channels:", error);
      } finally {
        set({ isLoading: false });
      }
    },

    fetchMessages: async (channelId: string, before?: string) => {
      set({ isLoading: true });
      try {
        const { channels, messages } = get();
        const channel = channels.find((c) => c.id === channelId);

        if (!channel) {
          console.error(`Channel not found: ${channelId}`);
          return [];
        }

        let fetchedMessages: RealtimeMessage[] = [];

        // Discord messages
        if (channel.platform === "discord") {
          const { discordAccounts } = get();
          const account = discordAccounts.find(
            (a) => a.id === channel.accountId
          );

          if (account) {
            const discordService = new DiscordService(account);
            const discordMessages = await discordService.getMessages(
              channelId,
              50,
              before
            );

            // Convert discord messages to standardized format
            fetchedMessages = discordMessages.map((msg: any) => ({
              id: msg.id,
              channelId: msg.channelId,
              content: msg.content || "",
              author: msg.author || { id: "unknown", username: "Unknown User" },
              timestamp: new Date(msg.timestamp),
              editedTimestamp: msg.editedTimestamp
                ? new Date(msg.editedTimestamp)
                : null,
              platform: "discord" as RealtimePlatform,
              isRead: msg.isRead || false,
              attachments: msg.attachments || [],
              embeds: msg.embeds || [],
              reactions: [], // Not yet implemented in discord-service
              mentions: [], // Not yet implemented in discord-service
            }));
          } else {
            console.error(
              `Discord account not found for channel: ${channelId}`
            );
          }
        }

        // Add more platform message fetching here as we implement them...

        // Update messages state - maintain existing messages for other channels
        const existingMessages = messages[channelId] || [];
        const combinedMessages = [...existingMessages, ...fetchedMessages];

        // Sort messages by timestamp descending (newest first)
        combinedMessages.sort(
          (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
        );

        // Remove duplicates by ID
        const uniqueMessages = combinedMessages.filter(
          (message, index, self) =>
            index === self.findIndex((m) => m.id === message.id)
        );

        const updatedMessages = {
          ...messages,
          [channelId]: uniqueMessages,
        };

        set({ messages: updatedMessages });
        setCacheValue("realtimeMessages", updatedMessages);

        return fetchedMessages;
      } catch (error) {
        console.error(
          `Error fetching messages for channel ${channelId}:`,
          error
        );
        return [];
      } finally {
        set({ isLoading: false });
      }
    },

    sendMessage: async (content: string, attachments?: File[]) => {
      const { activeChannelId, activePlatform, channels } = get();

      if (!activeChannelId || !activePlatform) {
        console.error("No active channel selected");
        return false;
      }

      try {
        const channel = channels.find((c) => c.id === activeChannelId);

        if (!channel) {
          console.error(`Channel not found: ${activeChannelId}`);
          return false;
        }

        // Discord message
        if (activePlatform === "discord") {
          const { discordAccounts } = get();
          const account = discordAccounts.find(
            (a) => a.id === channel.accountId
          );

          if (account) {
            const discordService = new DiscordService(account);
            const success = await discordService.sendMessage(
              activeChannelId,
              content
            );

            if (success) {
              // Fetch updated messages to show the new message
              await get().fetchMessages(activeChannelId);
              return true;
            }
          } else {
            console.error(
              `Discord account not found for channel: ${activeChannelId}`
            );
          }
        }

        // Add more platform message sending here as we implement them...

        return false;
      } catch (error) {
        console.error(
          `Error sending message to channel ${activeChannelId}:`,
          error
        );
        return false;
      }
    },

    markMessageAsRead: async (messageId: string, channelId: string) => {
      const { channels } = get();
      const channel = channels.find((c) => c.id === channelId);

      if (!channel) {
        console.error(`Channel not found: ${channelId}`);
        return false;
      }

      try {
        // Discord message
        if (channel.platform === "discord") {
          const { discordAccounts } = get();
          const account = discordAccounts.find(
            (a) => a.id === channel.accountId
          );

          if (account) {
            const discordService = new DiscordService(account);
            const success = await discordService.markMessageAsRead(messageId);

            if (success) {
              // Update the message in the local store
              const { messages } = get();
              const channelMessages = messages[channelId] || [];
              const updatedMessages = channelMessages.map((msg) => {
                if (msg.id === messageId) {
                  return { ...msg, isRead: true };
                }
                return msg;
              });

              const updatedMessagesState = {
                ...messages,
                [channelId]: updatedMessages,
              };

              set({ messages: updatedMessagesState });
              setCacheValue("realtimeMessages", updatedMessagesState);

              return true;
            }
          }
        }

        // Add more platform message marking as read here as we implement them...

        return false;
      } catch (error) {
        console.error(`Error marking message ${messageId} as read:`, error);
        return false;
      }
    },

    syncDiscordChannels: async (accountId?: string) => {
      try {
        const { discordAccounts } = get();
        let synced = false;

        // If accountId is provided, sync only that account
        if (accountId) {
          const account = discordAccounts.find((a) => a.id === accountId);
          if (account) {
            const discordService = new DiscordService(account);
            synced = await discordService.syncChannels();
          }
        } else {
          // Sync all accounts
          for (const account of discordAccounts) {
            const discordService = new DiscordService(account);
            const accountSynced = await discordService.syncChannels();
            synced = synced || accountSynced;
          }
        }

        // Refresh channels if any sync was successful
        if (synced) {
          await get().fetchChannels();
        }

        return synced;
      } catch (error) {
        console.error("Error syncing Discord channels:", error);
        return false;
      }
    },

    addDiscordAccount: (account: DiscordAccount) => {
      const { discordAccounts } = get();
      const updatedAccounts = [...discordAccounts, account];
      set({ discordAccounts: updatedAccounts });
      setCacheValue("discordAccounts", updatedAccounts);
    },

    removeDiscordAccount: (id: string) => {
      const { discordAccounts } = get();
      const updatedAccounts = discordAccounts.filter(
        (account) => account.id !== id
      );
      set({ discordAccounts: updatedAccounts });
      setCacheValue("discordAccounts", updatedAccounts);
    },

    getDiscordAccount: (id: string) => {
      return get().discordAccounts.find((account) => account.id === id);
    },

    setDiscordAccounts: (accounts: DiscordAccount[]) => {
      set({ discordAccounts: accounts });
      setCacheValue("discordAccounts", accounts);
    },
  };
});

// Load persisted data on the client side only
if (typeof window !== "undefined") {
  // Initial load from database cache
  (async () => {
    const persistedData = await loadPersistedData();
    useRealtimeStore.setState({
      channels: persistedData.channels,
      messages: persistedData.messages,
      discordAccounts: persistedData.discordAccounts,
    });

    // Then sync with latest data
    setTimeout(async () => {
      const store = useRealtimeStore.getState();
      await store.fetchChannels();
    }, 1000);

    // Set up periodic sync every 5 minutes
    setInterval(async () => {
      const store = useRealtimeStore.getState();
      await store.syncDiscordChannels();
      await store.fetchChannels();
    }, 5 * 60 * 1000);
  })().catch((error) => {
    console.error("Error loading initial realtime data:", error);
  });
}
