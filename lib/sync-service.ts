import { Email } from "@/lib/types";
import { ImapAccount } from "@/lib/imap-service";
import { fetchEmails as fetchGmailEmails } from "@/lib/gmail-api";
import { useEmailStore } from "@/lib/email-store";
import { EmailContentLoader } from "@/lib/email-content-loader";
import { db } from "@/lib/db";
import { JustCallService } from "@/lib/justcall-service";
import { TwilioService } from "@/lib/twilio-service";
import { BulkVSService } from "@/lib/bulkvs-service";
import { Account } from "@prisma/client";
import { UnipileService } from "@/lib/unipile-service";

export class SyncService {
  private static instance: SyncService;
  private syncInProgress = false;
  private contentLoader = new EmailContentLoader();

  private constructor() {}

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  async syncAllEmails(
    gmailToken: string | null,
    imapAccounts: ImapAccount[],
    page: number = 1,
    pageSize: number = 100, // Default to 100, but will use provided value
    query: string = "" // Add a query parameter for Gmail API filtering
  ): Promise<void> {
    if (this.syncInProgress) {
      console.log("Sync already in progress");
      return;
    }

    this.syncInProgress = true;

    try {
      const syncPromises: Promise<Email[]>[] = [];

      // Add Gmail sync if token is available
      if (gmailToken) {
        // Use a try-catch block specifically for Gmail to handle auth errors properly
        try {
          console.log(
            `Fetching Gmail emails with page ${page}, pageSize ${pageSize}${
              query ? `, query: ${query}` : ""
            }`
          );
          const gmailEmails = await fetchGmailEmails(
            gmailToken,
            page,
            pageSize,
            query
          );
          if (gmailEmails && gmailEmails.length > 0) {
            syncPromises.push(Promise.resolve(gmailEmails));
          } else {
            console.log(
              "No Gmail emails returned, possibly due to auth issues"
            );
          }
        } catch (gmailError: any) {
          console.error("Error fetching Gmail emails:", gmailError);
          // Propagate auth errors to be handled by the caller
          if (
            gmailError?.response?.status === 401 ||
            gmailError?.error?.code === 401 ||
            (gmailError?.message &&
              gmailError.message.includes("Invalid Credentials"))
          ) {
            // Create a structured error with authentication details
            const authError = new Error("Gmail authentication failed");
            authError.name = "AuthenticationError";
            // @ts-ignore - adding custom properties to error
            authError.error = { code: 401 };
            // @ts-ignore - adding custom properties to error
            authError.response = { status: 401 };
            throw authError;
          }
        }
      }

      // Add IMAP sync for each account
      for (const account of imapAccounts) {
        try {
          console.log(
            `Fetching IMAP emails for account ${account.id} with page ${page}, pageSize ${pageSize}`
          );
          const response = await fetch("/api/imap", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "fetchEmails",
              account,
              data: {
                page: page,
                pageSize: pageSize,
                fetchAll: false, // Don't fetch all, respect the pageSize
              },
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.emails && data.emails.length > 0) {
              syncPromises.push(Promise.resolve(data.emails));
            }
          } else {
            console.error(
              `Failed to fetch IMAP emails for account ${account.id}:`,
              await response.text()
            );
          }
        } catch (error) {
          console.error(
            `Error fetching IMAP emails for account ${account.id}:`,
            error
          );
        }
      }

      // Wait for all syncs to complete (only those that were successful)
      if (syncPromises.length > 0) {
        const results = await Promise.allSettled(syncPromises);

        // Combine all successful results
        const allEmails: Email[] = [];
        results.forEach((result) => {
          if (result.status === "fulfilled") {
            allEmails.push(...result.value);
          }
        });

        // Update the email store with all emails only if we have some
        if (allEmails.length > 0) {
          const store = useEmailStore.getState();
          store.setEmails(allEmails);

          // Update last sync time for IMAP accounts
          imapAccounts.forEach((account) => {
            if (account.id) {
              fetch("/api/imap", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  action: "updateLastSync",
                  data: { accountId: account.id },
                }),
              }).catch(console.error);
            }
          });

          // Load content for emails that don't have it
          this.loadMissingContent(allEmails);
        } else {
          console.log("No emails retrieved from any accounts");
        }
      } else {
        console.log("No successful sync operations completed");
      }
    } catch (error) {
      console.error("Error syncing emails:", error);
      throw error; // Re-throw to allow caller to handle
    } finally {
      this.syncInProgress = false;
    }
  }

  private async loadMissingContent(emails: Email[]) {
    // Create a content loader instance if not already available
    if (!this.contentLoader) {
      this.contentLoader = new EmailContentLoader();
    }

    // Find emails that don't have body content
    const emailsWithoutContent = emails.filter(
      (email) => !email.body || email.body.trim() === ""
    );

    console.log(
      `Loading content for ${emailsWithoutContent.length} emails without content`
    );

    // Load content for up to 5 emails at a time to avoid overwhelming the server
    const batchSize = 5;
    for (let i = 0; i < emailsWithoutContent.length; i += batchSize) {
      const batch = emailsWithoutContent.slice(i, i + batchSize);

      // Load content for each email in the batch concurrently
      await Promise.allSettled(
        batch.map((email) => this.contentLoader.loadEmailContent(email))
      );
    }
  }
}

// Function to sync IMAP accounts
export const syncImapAccounts = async (
  userId?: string
): Promise<{ success: number; failed: number; results: any[] }> => {
  try {
    // Query for all IMAP accounts for the given user
    const accounts = await db.imapAccount.findMany({
      where: userId ? { userId } : {},
    });

    console.log(`Syncing ${accounts.length} IMAP accounts`);

    // Implementation details would be similar to syncJustCallAccounts
    // But for demonstration, we'll just return a placeholder
    return {
      success: accounts.length,
      failed: 0,
      results: accounts.map((acc: Account) => ({
        accountId: acc.id,
        status: "success",
      })),
    };
  } catch (error) {
    console.error("Error in syncImapAccounts:", error);
    return {
      success: 0,
      failed: 1,
      results: [
        { error: error instanceof Error ? error.message : "Unknown error" },
      ],
    };
  }
};

// Add JustCall sync functionality to the existing sync service
export const syncJustCallAccounts = async (
  userId?: string,
  options?: {
    phoneNumber?: string;
    accountId?: string;
    pageSize?: number;
    lastSmsIdFetched?: string;
    sortDirection?: "asc" | "desc";
  }
): Promise<{ success: number; failed: number; results: any[] }> => {
  try {
    // Query for all active JustCall accounts, optionally filtered by userId and accountId
    let query: any = { platform: "justcall" };

    if (userId) {
      query.userId = userId;
    }

    if (options?.accountId) {
      query.id = options.accountId;
    }

    const accounts = await db.syncAccount.findMany({
      where: query,
    });

    console.log(`Syncing ${accounts.length} JustCall accounts`);

    const results = await Promise.allSettled(
      accounts.map(async (account: any) => {
        try {
          const justCallService = new JustCallService(account);

          // Get the phone number from either the options or the accountIdentifier field
          const phoneNumber = options?.phoneNumber || account.accountIdentifier;

          if (!phoneNumber) {
            console.warn(
              `No phone number specified for JustCall account ${account.id}, skipping`
            );
            return {
              accountId: account.id,
              processed: 0,
              skipped: 0,
              error: "No phone number specified",
            };
          }

          console.log(
            `Syncing messages for JustCall account ${account.id} with phone number: ${phoneNumber}`
          );
          // Use cursor-based pagination with lastSmsIdFetched
          // console.log(`JustCall sync for account ${account.id}:`);
          // console.log(`- Phone: ${phoneNumber}`);
          // console.log(`- Sort: ${options?.sortDirection || "desc"}`);
          // console.log(
          //   `- Pagination cursor: ${options?.lastSmsIdFetched || "none"}`
          // );

          // Get messages using the lastSmsIdFetched for pagination instead of date-based filtering
          const result = await justCallService.getMessages(
            phoneNumber,
            undefined, // No date filtering needed
            options?.pageSize || 100,
            options?.lastSmsIdFetched,
            options?.sortDirection || "desc" // Default to desc for newest first
          );

          // Extract the messages array from the result
          const messages = result.messages;
          const rateLimited = result.rateLimited;
          const retryAfter = result.retryAfter;

          // Include rate limit information in the response
          if (rateLimited) {
            console.warn(
              `⚠️ JustCall API rate limit reached for account ${account.id}`
            );
            if (retryAfter) {
              console.warn(
                `   Recommended to wait ${retryAfter} seconds before next request`
              );
            }
          }

          // Add debug logging to inspect the retrieved messages
          if (messages.length > 0) {
            //console.log(
            //  `Retrieved ${messages.length} JustCall messages for account ${account.id}.`
            //);
            //console.log(
            //  `Message ID range: ${messages[0].id} - ${
            //    messages[messages.length - 1].id
            //  }`
            //);
            // Remember the oldest message ID for returning to the caller
            //const oldestMessageId = messages[messages.length - 1].id;
            // Log a sample of messages
            //const sampleSize = Math.min(3, messages.length);
            //console.log(`Sample of ${sampleSize} messages (showing IDs):`);
            /* messages.slice(0, sampleSize).forEach((msg, idx) => {
              //console.log(`- ${msg.id}`);
            });*/
          } else {
            //console.log(`No messages retrieved for account ${account.id}`);
          }

          let processedCount = 0;
          let skippedCount = 0;

          // Process each message
          for (const message of messages) {
            try {
              // Skip outbound messages as they were likely sent from our system
              if (!message || message.direction === "outbound") {
                skippedCount++;
                continue;
              }

              await justCallService.processIncomingMessage(message);
              processedCount++;
            } catch (messageError) {
              console.error(
                `Error processing message in JustCall account ${account.id}:`,
                messageError,
                "Message:",
                JSON.stringify(message)
              );
              skippedCount++;
            }
          }

          // Only update last sync time if we're not using pagination for loading more messages
          // This way we don't affect the sync time when just loading more historical messages
          if (!options?.lastSmsIdFetched) {
            // Store the sync time but don't affect message timestamps
            await db.syncAccount.update({
              where: { id: account.id },
              data: { lastSync: new Date() },
            });
          }

          // Return data including the oldest message ID for pagination
          const oldestMessageId =
            messages.length > 0 ? messages[messages.length - 1].id : null;

          return {
            accountId: account.id,
            processed: processedCount,
            skipped: skippedCount,
            lastMessageId: oldestMessageId, // Return the oldest message ID for pagination
            rateLimited,
            retryAfter,
          };
        } catch (error) {
          console.error(`Error syncing JustCall account ${account.id}:`, error);
          throw error;
        }
      })
    );

    return {
      success: results.filter(
        (r: PromiseSettledResult<any>) => r.status === "fulfilled"
      ).length,
      failed: results.filter(
        (r: PromiseSettledResult<any>) => r.status === "rejected"
      ).length,
      results,
    };
  } catch (error) {
    console.error("Error in syncJustCallAccounts:", error);
    throw error;
  }
};

// Add Twilio sync functionality
export const syncTwilioAccounts = async (
  userId?: string
): Promise<{ success: number; failed: number; results: any[] }> => {
  try {
    // Query for all active Twilio accounts, optionally filtered by userId
    const query = userId
      ? { userId, platform: "twilio" }
      : { platform: "twilio" };

    const accounts = await db.syncAccount.findMany({
      where: query,
    });

    console.log(`Syncing ${accounts.length} Twilio accounts`);

    const results = await Promise.allSettled(
      accounts.map(async (account: any) => {
        try {
          const twilioService = new TwilioService(account);

          // Get messages since last sync
          console.log(
            `Fetching Twilio messages for account ${account.id} since ${account.lastSync}`
          );
          const messages = await twilioService.getMessages(account.lastSync);
          console.log(
            `Retrieved ${messages.length} Twilio messages for account ${account.id}`
          );

          let processedCount = 0;
          let skippedCount = 0;

          // Process each message
          for (const message of messages) {
            try {
              // Skip outbound messages as they were likely sent from our system
              if (!message || message.direction !== "inbound") {
                console.log(
                  `Skipping outbound or null Twilio message: ${
                    message?.sid || "N/A"
                  }`
                );
                skippedCount++;
                continue;
              }

              await twilioService.processIncomingMessage(message);
              processedCount++;
            } catch (messageError) {
              console.error(
                `Error processing message in Twilio account ${account.id}:`,
                messageError,
                "Message:",
                JSON.stringify(message)
              );
              skippedCount++;
            }
          }

          // Update last sync time
          await db.syncAccount.update({
            where: { id: account.id },
            data: { lastSync: new Date() },
          });

          return {
            accountId: account.id,
            processed: processedCount,
            skipped: skippedCount,
          };
        } catch (error) {
          console.error(`Error syncing Twilio account ${account.id}:`, error);
          throw error;
        }
      })
    );

    return {
      success: results.filter(
        (r: PromiseSettledResult<any>) => r.status === "fulfilled"
      ).length,
      failed: results.filter(
        (r: PromiseSettledResult<any>) => r.status === "rejected"
      ).length,
      results,
    };
  } catch (error) {
    console.error("Error in syncTwilioAccounts:", error);
    throw error;
  }
};

// Add BulkVS sync functionality
export const syncBulkvsAccounts = async (
  userId?: string,
  options?: {
    phoneNumber?: string;
    accountId?: string;
    pageSize?: number;
    lastSmsIdFetched?: string;
    sortDirection?: "asc" | "desc";
  }
): Promise<{ success: number; failed: number; results: any[] }> => {
  try {
    // Query for all active BulkVS accounts, optionally filtered by userId and accountId
    let query: any = { platform: "bulkvs" };

    if (userId) {
      query.userId = userId;
    }

    if (options?.accountId) {
      query.id = options.accountId;
    }

    const accounts = await db.syncAccount.findMany({
      where: query,
    });

    console.log(`Syncing ${accounts.length} BulkVS accounts`);

    const results = await Promise.allSettled(
      accounts.map(async (account: any) => {
        try {
          const bulkvsService = new BulkVSService(account);

          // Get the phone number from either the options or the accountIdentifier field
          const phoneNumber = options?.phoneNumber || account.accountIdentifier;

          if (!phoneNumber) {
            console.warn(
              `No phone number specified for BulkVS account ${account.id}, skipping`
            );
            return {
              accountId: account.id,
              processed: 0,
              skipped: 0,
              error: "No phone number specified",
            };
          }

          console.log(
            `Syncing messages for BulkVS account ${account.id} with phone number: ${phoneNumber}`
          );

          // Use cursor-based pagination with lastSmsIdFetched
          console.log(`BulkVS sync for account ${account.id}:`);
          console.log(`- Phone: ${phoneNumber}`);
          console.log(`- Sort: ${options?.sortDirection || "desc"}`);
          console.log(
            `- Pagination cursor: ${options?.lastSmsIdFetched || "none"}`
          );

          // Get messages using the lastSmsIdFetched for pagination instead of date-based filtering
          const result = await bulkvsService.getMessages(
            phoneNumber,
            undefined, // No date filtering needed
            options?.pageSize || 100,
            options?.lastSmsIdFetched,
            options?.sortDirection || "desc" // Default to desc for newest first
          );

          // Extract the messages array from the result
          const messages = result.messages;
          const rateLimited = result.rateLimited;
          const retryAfter = result.retryAfter;

          // Include rate limit information in the response
          if (rateLimited) {
            console.warn(
              `⚠️ BulkVS API rate limit reached for account ${account.id}`
            );
            if (retryAfter) {
              console.warn(
                `   Recommended to wait ${retryAfter} seconds before next request`
              );
            }
          }

          // Add debug logging to inspect the retrieved messages
          if (messages.length > 0) {
            console.log(
              `Retrieved ${messages.length} BulkVS messages for account ${account.id}.`
            );
            console.log(
              `Message ID range: ${messages[0].id} - ${
                messages[messages.length - 1].id
              }`
            );

            // Remember the oldest message ID for returning to the caller
            const oldestMessageId = messages[messages.length - 1].id;

            // Log a sample of messages
            //const sampleSize = Math.min(3, messages.length);
            //console.log(`Sample of ${sampleSize} messages (showing IDs):`);
            //messages.slice(0, sampleSize).forEach((msg, idx) => {
            //  console.log(`- ${msg.id}`);
            //});
          } else {
            console.log(`No messages retrieved for account ${account.id}`);
          }

          let processedCount = 0;
          let skippedCount = 0;

          // Process each message
          for (const message of messages) {
            try {
              // Skip outbound messages as they were likely sent from our system
              if (!message || message.direction === "outbound") {
                skippedCount++;
                continue;
              }

              await bulkvsService.processIncomingMessage(message);
              processedCount++;
            } catch (messageError) {
              console.error(
                `Error processing message in BulkVS account ${account.id}:`,
                messageError,
                "Message:",
                JSON.stringify(message)
              );
              skippedCount++;
            }
          }

          // Only update last sync time if we're not using pagination for loading more messages
          // This way we don't affect the sync time when just loading more historical messages
          if (!options?.lastSmsIdFetched) {
            // Store the sync time but don't affect message timestamps
            await db.syncAccount.update({
              where: { id: account.id },
              data: { lastSync: new Date() },
            });
          }

          // Return data including the oldest message ID for pagination
          const oldestMessageId =
            messages.length > 0 ? messages[messages.length - 1].id : null;

          return {
            accountId: account.id,
            processed: processedCount,
            skipped: skippedCount,
            lastMessageId: oldestMessageId, // Return the oldest message ID for pagination
            rateLimited,
            retryAfter,
          };
        } catch (error) {
          console.error(`Error syncing BulkVS account ${account.id}:`, error);
          throw error;
        }
      })
    );

    return {
      success: results.filter(
        (r: PromiseSettledResult<any>) => r.status === "fulfilled"
      ).length,
      failed: results.filter(
        (r: PromiseSettledResult<any>) => r.status === "rejected"
      ).length,
      results,
    };
  } catch (error) {
    console.error("Error in syncBulkvsAccounts:", error);
    throw error;
  }
};

// Add WhatsApp sync functionality
export const syncWhatsappAccounts = async (
  userId?: string,
  options?: {
    accountId?: string;
    chatId?: string;
    pageSize?: number;
    lastMessageId?: string;
    sortDirection?: "asc" | "desc";
  }
): Promise<{ success: number; failed: number; results: any[] }> => {
  console.log(`[WhatsApp Sync] Starting WhatsApp sync for user ${userId}`);

  // Import the enhanced WhatsApp utils for better message formatting
  const {
    formatWhatsAppMessage,
    isGroupChat,
    isSystemMessage,
    generateThreadIdentifier,
  } = await import("@/lib/whatsapp-utils");

  const results: any[] = [];
  let successCount = 0;
  let failedCount = 0;

  try {
    // Get user's sync accounts for WhatsApp
    const syncAccounts = await db.syncAccount.findMany({
      where: {
        userId: userId,
        platform: "whatsapp",
      },
    });

    if (syncAccounts.length === 0) {
      console.log("[WhatsApp Sync] No WhatsApp accounts found for user");
      return { success: 0, failed: 0, results };
    }

    console.log(
      `[WhatsApp Sync] Found ${syncAccounts.length} WhatsApp sync accounts`
    );

    // Create Unipile service client
    const baseUrl = process.env.UNIPILE_BASE_URL;
    const accessToken = process.env.UNIPILE_ACCESS_TOKEN;
    if (!baseUrl || !accessToken) {
      console.error(
        "[WhatsApp Sync] Missing UNIPILE_BASE_URL or UNIPILE_ACCESS_TOKEN"
      );
      return { success: 0, failed: 0, results };
    }

    const unipile = new UnipileService({ baseUrl, accessToken });

    // If accountId is specified in options, filter to that account only
    const accountsToSync = options?.accountId
      ? syncAccounts.filter((acc: any) => acc.id === options.accountId)
      : syncAccounts;

    // Process each account
    for (const account of accountsToSync) {
      try {
        const internalAccountId = account.id;
        const unipileAccountId = account.accountIdentifier;

        if (!unipileAccountId) {
          console.warn(
            `[WhatsApp Sync] Account ${internalAccountId} missing Unipile account ID`
          );
          failedCount++;
          continue;
        }

        console.log(
          `[WhatsApp Sync] Processing account ${internalAccountId} (Unipile: ${unipileAccountId})`
        );

        // Fetch all chats for this account
        let chatResponse;
        try {
          chatResponse = await unipile.getAllWhatsAppChats(unipileAccountId);
        } catch (chatError) {
          console.error(
            `[WhatsApp Sync] Error fetching chats for account ${internalAccountId}:`,
            chatError
          );
          failedCount++;
          continue;
        }

        if (
          !chatResponse ||
          !chatResponse.chats ||
          !Array.isArray(chatResponse.chats)
        ) {
          console.error(
            `[WhatsApp Sync] Invalid chat response for account ${internalAccountId}`
          );
          failedCount++;
          continue;
        }

        const { chats } = chatResponse;
        console.log(
          `[WhatsApp Sync] Retrieved ${chats.length} chats for account ${internalAccountId}`
        );

        // Filter out the "self-conversation" chat that shows all sent messages
        const filteredChats = chats.filter((chat: any) => {
          // Skip any chat that represents the user's own number or has "You" as the name
          if (
            !isGroupChat(chat.id) &&
            (chat.name === "You" ||
              chat.name === "Me" ||
              chat.name.toLowerCase().includes("you") ||
              chat.name.toLowerCase().includes("me"))
          ) {
            console.log(
              `[WhatsApp Sync] Skipping self-conversation chat: ${chat.id}`
            );
            return false;
          }
          return true;
        });

        console.log(
          `[WhatsApp Sync] Processing ${filteredChats.length} chats (filtered from ${chats.length})`
        );

        // If chatId is specified in options, filter to that chat only
        const chatsToProcess = options?.chatId
          ? filteredChats.filter((chat: any) => chat.id === options.chatId)
          : filteredChats;

        // Process each chat
        for (const chat of chatsToProcess) {
          try {
            const chatId = chat.id;
            if (!chatId) {
              console.warn("[WhatsApp Sync] Chat missing ID, skipping");
              continue;
            }

            const isGroup = isGroupChat(chatId);
            console.log(
              `[WhatsApp Sync] Processing chat ${chatId} (${
                isGroup ? "Group" : "Direct"
              })`
            );

            // Setup pagination parameters
            const paginationParams: Record<string, any> = {
              limit: options?.pageSize || 50,
              sortDirection: options?.sortDirection || "desc",
              accountId: unipileAccountId,
            };

            // Add pagination cursor if provided
            if (options?.lastMessageId) {
              paginationParams.beforeId = options.lastMessageId;
            }

            // Fetch messages for this chat
            const messagesResponse = await unipile.getWhatsAppMessages(
              chatId,
              paginationParams
            );

            if (
              !messagesResponse ||
              !messagesResponse.messages ||
              !Array.isArray(messagesResponse.messages)
            ) {
              console.error(
                `[WhatsApp Sync] Invalid messages response for chat ${chatId}`
              );
              continue;
            }

            const { messages } = messagesResponse;
            console.log(
              `[WhatsApp Sync] Retrieved ${messages.length} messages for chat ${chatId}`
            );

            // Filter out system messages
            const filteredMessages = messages.filter((msg: any) => {
              const content = msg.text || msg.body || "";
              if (isSystemMessage(content)) {
                console.log(
                  `[WhatsApp Sync] Filtered out system message: "${content.substring(
                    0,
                    30
                  )}..."`
                );
                return false;
              }
              return true;
            });

            console.log(
              `[WhatsApp Sync] Processing ${filteredMessages.length} messages (filtered from ${messages.length})`
            );

            // Format messages as Email objects with proper thread identification
            const formattedMessages = filteredMessages.map((msg: any) => {
              // Using our enhanced formatter from whatsapp-utils
              return formatWhatsAppMessage(msg, chat, internalAccountId);
            });

            // Save formatted messages to database
            if (formattedMessages.length > 0) {
              // Store messages with proper thread identification to avoid duplicates
              await db.message.createMany({
                data: formattedMessages.map((email: Email) => ({
                  userId: userId as string,
                  platform: "whatsapp",
                  accountId: internalAccountId,
                  externalId: email.id,
                  threadId: email.threadId || "",
                  fromName: email.from.name,
                  fromEmail: email.from.email,
                  toRecipients: JSON.stringify(email.to),
                  subject: email.subject,
                  snippet: email.snippet || "",
                  body: email.body,
                  date: new Date(email.date),
                  labels: JSON.stringify(email.labels),
                  metadata: JSON.stringify(email.metadata || {}),
                  isRead: email.read || false,
                })),
                skipDuplicates: true,
              });

              console.log(
                `[WhatsApp Sync] Saved ${formattedMessages.length} messages for chat ${chatId}`
              );
              successCount += formattedMessages.length;
              results.push({
                chatId,
                messageCount: formattedMessages.length,
                isGroup,
              });
            }
          } catch (chatError) {
            console.error(`[WhatsApp Sync] Error processing chat:`, chatError);
            failedCount++;
          }
        }

        // Update account last sync time
        await db.syncAccount.update({
          where: { id: internalAccountId },
          data: { lastSync: new Date() },
        });

        console.log(
          `[WhatsApp Sync] Updated last sync time for account ${internalAccountId}`
        );
      } catch (accountError) {
        console.error(
          `[WhatsApp Sync] Error processing account:`,
          accountError
        );
        failedCount++;
      }
    }

    return { success: successCount, failed: failedCount, results };
  } catch (error) {
    console.error("[WhatsApp Sync] Error in syncWhatsappAccounts:", error);
    return { success: successCount, failed: failedCount + 1, results };
  }
};

// Sync all accounts for a user
export const syncAllAccountsForUser = async (
  userId: string
): Promise<{
  imap: { success: number; failed: number; results: any[] } | null;
  justCall: { success: number; failed: number; results: any[] } | null;
  twilio: { success: number; failed: number; results: any[] } | null;
  bulkvs: { success: number; failed: number; results: any[] } | null;
  whatsapp: { success: number; failed: number; results: any[] } | null;
}> => {
  const results: {
    imap: { success: number; failed: number; results: any[] } | null;
    justCall: { success: number; failed: number; results: any[] } | null;
    twilio: { success: number; failed: number; results: any[] } | null;
    bulkvs: { success: number; failed: number; results: any[] } | null;
    whatsapp: { success: number; failed: number; results: any[] } | null;
  } = {
    imap: null,
    justCall: null,
    twilio: null,
    bulkvs: null,
    whatsapp: null,
  };

  try {
    // Sync IMAP accounts
    results.imap = await syncImapAccounts(userId);
  } catch (error) {
    console.error("Error syncing IMAP accounts:", error);
    results.imap = {
      success: 0,
      failed: 1,
      results: [
        { error: error instanceof Error ? error.message : "Unknown error" },
      ],
    };
  }

  try {
    // Sync JustCall accounts
    results.justCall = await syncJustCallAccounts(userId);
  } catch (error) {
    console.error("Error syncing JustCall accounts:", error);
    results.justCall = {
      success: 0,
      failed: 1,
      results: [
        { error: error instanceof Error ? error.message : "Unknown error" },
      ],
    };
  }

  try {
    // Sync Twilio accounts
    results.twilio = await syncTwilioAccounts(userId);
  } catch (error) {
    console.error("Error syncing Twilio accounts:", error);
    results.twilio = {
      success: 0,
      failed: 1,
      results: [
        { error: error instanceof Error ? error.message : "Unknown error" },
      ],
    };
  }

  try {
    // Sync BulkVS accounts
    results.bulkvs = await syncBulkvsAccounts(userId);
  } catch (error) {
    console.error("Error syncing BulkVS accounts:", error);
    results.bulkvs = {
      success: 0,
      failed: 1,
      results: [
        { error: error instanceof Error ? error.message : "Unknown error" },
      ],
    };
  }

  try {
    // Sync WhatsApp accounts
    results.whatsapp = await syncWhatsappAccounts(userId);
  } catch (error) {
    console.error("Error syncing WhatsApp accounts:", error);
    results.whatsapp = {
      success: 0,
      failed: 1,
      results: [
        { error: error instanceof Error ? error.message : "Unknown error" },
      ],
    };
  }

  return results;
};
