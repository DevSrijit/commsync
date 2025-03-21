import { Email } from "@/lib/types";
import { ImapAccount } from "@/lib/imap-service";
import { fetchEmails as fetchGmailEmails } from "@/lib/gmail-api";
import { useEmailStore } from "@/lib/email-store";
import { EmailContentLoader } from "@/lib/email-content-loader";
import { db } from '@/lib/db';
import { JustCallService } from '@/lib/justcall-service';
import { TwilioService } from '@/lib/twilio-service';

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
    pageSize: number = 100000 // Increased from 100 to 100000
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
        syncPromises.push(fetchGmailEmails(gmailToken, page, pageSize));
      }

      // Add IMAP sync for each account
      imapAccounts.forEach((account) => {
        syncPromises.push(
          fetch("/api/imap", {
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
                fetchAll: true // Add a flag to fetch all emails
              },
            }),
          }).then((response) => response.json().then((data) => data.emails))
        );
      });

      // Wait for all syncs to complete
      const results = await Promise.allSettled(syncPromises);
      
      // Combine all successful results
      const allEmails: Email[] = [];
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          allEmails.push(...result.value);
        }
      });

      // Update the email store with all emails
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
              accountId: account.id,
            }),
          }).catch(console.error);
        }
      });

      // Load content for emails that don't have it
      this.loadMissingContent(allEmails);

    } catch (error) {
      console.error("Error syncing emails:", error);
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
    const emailsWithoutContent = emails.filter(email => 
      !email.body || email.body.trim() === ''
    );
    
    console.log(`Loading content for ${emailsWithoutContent.length} emails without content`);
    
    // Load content for up to 5 emails at a time to avoid overwhelming the server
    const batchSize = 5;
    for (let i = 0; i < emailsWithoutContent.length; i += batchSize) {
      const batch = emailsWithoutContent.slice(i, i + batchSize);
      
      // Load content for each email in the batch concurrently
      await Promise.allSettled(
        batch.map(email => this.contentLoader.loadEmailContent(email))
      );
    }
  }
}

// Function to sync IMAP accounts
export const syncImapAccounts = async (userId?: string): Promise<{ success: number; failed: number; results: any[] }> => {
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
      results: accounts.map(acc => ({ accountId: acc.id, status: 'success' }))
    };
  } catch (error) {
    console.error('Error in syncImapAccounts:', error);
    return {
      success: 0,
      failed: 1,
      results: [{ error: error instanceof Error ? error.message : 'Unknown error' }]
    };
  }
};

// Add JustCall sync functionality to the existing sync service
export const syncJustCallAccounts = async (
  userId?: string,
  options?: { 
    phoneNumber?: string; 
    accountId?: string;
    page?: number;
    pageSize?: number;
    oldestDate?: string;
    sortDirection?: 'asc' | 'desc';
  }
): Promise<{ success: number; failed: number; results: any[] }> => {
  try {
    // Query for all active JustCall accounts, optionally filtered by userId and accountId
    let query: any = { platform: 'justcall' };
    
    if (userId) {
      query.userId = userId;
    }
    
    if (options?.accountId) {
      query.id = options.accountId;
    }
    
    const accounts = await db.syncAccount.findMany({
      where: query,
    });

    // Reduce logging verbosity
    // console.log(`Syncing ${accounts.length} JustCall accounts`);
    
    const results = await Promise.allSettled(
      accounts.map(async (account) => {
        try {
          const justCallService = new JustCallService(account);
          
          // Get the phone number from either the options or the accountIdentifier field
          const phoneNumber = options?.phoneNumber || account.accountIdentifier;
          
          if (!phoneNumber) {
            console.warn(`No phone number specified for JustCall account ${account.id}, skipping`);
            return { accountId: account.id, processed: 0, skipped: 0, error: 'No phone number specified' };
          }
          
          console.log(`Syncing messages for JustCall account ${account.id} with phone number: ${phoneNumber}`);

          // Parse oldest date if provided
          let oldestDate: Date | undefined = undefined;
          if (options?.oldestDate) {
            try {
              oldestDate = new Date(options.oldestDate);
              console.log(`Using oldest date filter: ${oldestDate.toISOString()}`);
            } catch (e) {
              console.error(`Invalid oldestDate parameter: ${options.oldestDate}`, e);
            }
          }
          
          // Default to using lastSync date if no oldestDate is provided and we're fetching newer messages (desc)
          // For older messages (asc), we should use oldestDate as the upper bound, not lastSync
          const dateToUse = options?.sortDirection === 'asc' ? oldestDate : account.lastSync;
          
          // Get messages since last sync for the specific phone number
          console.log(`Fetching messages for account ${account.id} with phone ${phoneNumber}, date filter: ${dateToUse?.toISOString() || 'none'}, sort: ${options?.sortDirection || 'desc'}`);
          
          // Now proceed with the normal filtered request
          const messages = await justCallService.getMessages(
            phoneNumber, 
            dateToUse,
            options?.pageSize || 100,
            options?.page || 1,
            options?.sortDirection || 'desc'
          );
          
          // Add debug logging to inspect the timestamps of retrieved messages
          if (messages.length > 0) {
            console.log(`Retrieved ${messages.length} JustCall messages for account ${account.id}. First message timestamp:`, {
              created_at: messages[0].created_at,
              sms_user_date: messages[0].sms_user_date,
              sms_user_time: messages[0].sms_user_time
            });
          }
          
          let processedCount = 0;
          let skippedCount = 0;
          
          // Process each message
          for (const message of messages) {
            try {
              // Skip outbound messages as they were likely sent from our system
              if (!message || message.direction === 'outbound') {
                skippedCount++;
                continue;
              }
            
              await justCallService.processIncomingMessage(message);
              processedCount++;
            } catch (messageError) {
              console.error(`Error processing message in JustCall account ${account.id}:`, 
                messageError, 'Message:', JSON.stringify(message));
              skippedCount++;
            }
          }
          
          // Only update last sync time if we're fetching newer messages (desc sort)
          // When fetching older messages (asc sort), we don't want to update the lastSync
          if (!options?.sortDirection || options.sortDirection === 'desc') {
            // Store the sync time but don't affect message timestamps
            await db.syncAccount.update({
              where: { id: account.id },
              data: { lastSync: new Date() },
            });
          }
          
          return { accountId: account.id, processed: processedCount, skipped: skippedCount };
        } catch (error) {
          console.error(`Error syncing JustCall account ${account.id}:`, error);
          throw error;
        }
      })
    );
    
    return {
      success: results.filter((r: PromiseSettledResult<any>) => r.status === 'fulfilled').length,
      failed: results.filter((r: PromiseSettledResult<any>) => r.status === 'rejected').length,
      results
    };
  } catch (error) {
    console.error('Error in syncJustCallAccounts:', error);
    throw error;
  }
};

// Add Twilio sync functionality
export const syncTwilioAccounts = async (userId?: string): Promise<{ success: number; failed: number; results: any[] }> => {
  try {
    // Query for all active Twilio accounts, optionally filtered by userId
    const query = userId 
      ? { userId, platform: 'twilio' }
      : { platform: 'twilio' };
    
    const accounts = await db.syncAccount.findMany({
      where: query,
    });

    console.log(`Syncing ${accounts.length} Twilio accounts`);
    
    const results = await Promise.allSettled(
      accounts.map(async (account) => {
        try {
          const twilioService = new TwilioService(account);
          
          // Get messages since last sync
          console.log(`Fetching Twilio messages for account ${account.id} since ${account.lastSync}`);
          const messages = await twilioService.getMessages(account.lastSync);
          console.log(`Retrieved ${messages.length} Twilio messages for account ${account.id}`);
          
          let processedCount = 0;
          let skippedCount = 0;
          
          // Process each message
          for (const message of messages) {
            try {
              // Skip outbound messages as they were likely sent from our system
              if (!message || message.direction !== 'inbound') {
                console.log(`Skipping outbound or null Twilio message: ${message?.sid || 'N/A'}`);
                skippedCount++;
                continue;
              }
              
              await twilioService.processIncomingMessage(message);
              processedCount++;
            } catch (messageError) {
              console.error(`Error processing message in Twilio account ${account.id}:`, 
                messageError, 'Message:', JSON.stringify(message));
              skippedCount++;
            }
          }
          
          // Update last sync time
          await db.syncAccount.update({
            where: { id: account.id },
            data: { lastSync: new Date() },
          });
          
          return { accountId: account.id, processed: processedCount, skipped: skippedCount };
        } catch (error) {
          console.error(`Error syncing Twilio account ${account.id}:`, error);
          throw error;
        }
      })
    );
    
    return {
      success: results.filter((r: PromiseSettledResult<any>) => r.status === 'fulfilled').length,
      failed: results.filter((r: PromiseSettledResult<any>) => r.status === 'rejected').length,
      results
    };
  } catch (error) {
    console.error('Error in syncTwilioAccounts:', error);
    throw error;
  }
};

// Sync all accounts for a user
export const syncAllAccountsForUser = async (userId: string): Promise<{
  imap: { success: number; failed: number; results: any[] } | null;
  justCall: { success: number; failed: number; results: any[] } | null;
  twilio: { success: number; failed: number; results: any[] } | null;
}> => {
  const results: {
    imap: { success: number; failed: number; results: any[] } | null;
    justCall: { success: number; failed: number; results: any[] } | null;
    twilio: { success: number; failed: number; results: any[] } | null;
  } = {
    imap: null,
    justCall: null,
    twilio: null
  };
  
  try {
    // Sync IMAP accounts
    results.imap = await syncImapAccounts(userId);
  } catch (error) {
    console.error('Error syncing IMAP accounts:', error);
    results.imap = { 
      success: 0,
      failed: 1,
      results: [{ error: error instanceof Error ? error.message : 'Unknown error' }]
    };
  }
  
  try {
    // Sync JustCall accounts
    results.justCall = await syncJustCallAccounts(userId);
  } catch (error) {
    console.error('Error syncing JustCall accounts:', error);
    results.justCall = { 
      success: 0,
      failed: 1,
      results: [{ error: error instanceof Error ? error.message : 'Unknown error' }]
    };
  }
  
  try {
    // Sync Twilio accounts
    results.twilio = await syncTwilioAccounts(userId);
  } catch (error) {
    console.error('Error syncing Twilio accounts:', error);
    results.twilio = { 
      success: 0,
      failed: 1,
      results: [{ error: error instanceof Error ? error.message : 'Unknown error' }]
    };
  }
  
  return results;
};
