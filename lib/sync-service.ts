import { Email } from "@/lib/types";
import { ImapAccount } from "@/lib/imap-service";
import { fetchEmails as fetchGmailEmails } from "@/lib/gmail-api";
import { useEmailStore } from "@/lib/email-store";
import { EmailContentLoader } from "@/lib/email-content-loader";
import { db } from "@/lib/db";
import { JustCallService } from "@/lib/justcall-service";
import { TwilioService } from "@/lib/twilio-service";
import { BulkVSService } from "@/lib/bulkvs-service";
import { UnipileService } from "@/lib/unipile-service";
import { Account } from "@prisma/client";

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
          console.log(`JustCall sync for account ${account.id}:`);
          console.log(`- Phone: ${phoneNumber}`);
          console.log(`- Sort: ${options?.sortDirection || "desc"}`);
          console.log(
            `- Pagination cursor: ${options?.lastSmsIdFetched || "none"}`
          );

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
            console.log(
              `Retrieved ${messages.length} JustCall messages for account ${account.id}.`
            );
            console.log(
              `Message ID range: ${messages[0].id} - ${
                messages[messages.length - 1].id
              }`
            );

            // Remember the oldest message ID for returning to the caller
            const oldestMessageId = messages[messages.length - 1].id;

            // Log a sample of messages
            const sampleSize = Math.min(3, messages.length);
            console.log(`Sample of ${sampleSize} messages (showing IDs):`);
            messages.slice(0, sampleSize).forEach((msg, idx) => {
              console.log(`- ${msg.id}`);
            });
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
            const sampleSize = Math.min(3, messages.length);
            console.log(`Sample of ${sampleSize} messages (showing IDs):`);
            messages.slice(0, sampleSize).forEach((msg, idx) => {
              console.log(`- ${msg.id}`);
            });
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

// Add WhatsApp sync functionality using Unipile
export const syncUnipileWhatsappAccounts = async (
  userId?: string,
  options?: {
    accountId?: string;
  }
): Promise<{ success: number; failed: number; results: any[] }> => {
  try {
    // Query for all active Unipile WhatsApp accounts, optionally filtered by userId and accountId
    let query: any = { provider: "whatsapp" };

    if (userId) {
      query.userId = userId;
    }

    if (options?.accountId) {
      query.id = options.accountId;
    }

    const accounts = await db.unipileAccount.findMany({
      where: query,
    });

    console.log(`Syncing ${accounts.length} WhatsApp accounts through Unipile`);

    const unipileService = UnipileService.getInstance();

    const results = await Promise.allSettled(
      accounts.map(async (account: any) => {
        try {
          console.log(`Syncing WhatsApp account ${account.id}`);

          // Skip accounts that are not connected
          if (account.status !== "connected" || !account.accountIdentifier) {
            console.warn(`Account ${account.id} is not connected, skipping`);
            return {
              accountId: account.id,
              status: "skipped",
              error: "Account is not connected",
            };
          }

          // Sync messages for this account
          await unipileService.syncUnipileMessages(
            account.id,
            account.accountIdentifier
          );

          // Update last sync time
          await db.unipileAccount.update({
            where: { id: account.id },
            data: { lastSync: new Date() },
          });

          return {
            accountId: account.id,
            status: "success",
          };
        } catch (error) {
          console.error(`Error syncing WhatsApp account ${account.id}:`, error);
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
    console.error("Error in syncUnipileWhatsappAccounts:", error);
    throw error;
  }
};

// Update syncAllAccountsForUser to include WhatsApp sync
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
    // Sync WhatsApp accounts through Unipile
    results.whatsapp = await syncUnipileWhatsappAccounts(userId);
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
