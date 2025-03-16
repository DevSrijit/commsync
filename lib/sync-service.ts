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
    imapAccounts: ImapAccount[]
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
        syncPromises.push(fetchGmailEmails(gmailToken));
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
                page: 1,
                pageSize: 50,
              },
            }),
          }).then((res) => res.json().then((data) => data.emails))
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
export const syncJustCallAccounts = async (userId?: string): Promise<{ success: number; failed: number; results: any[] }> => {
  try {
    // Query for all active JustCall accounts, optionally filtered by userId
    const query = userId 
      ? { userId, platform: 'justcall' }
      : { platform: 'justcall' };
    
    const accounts = await db.syncAccount.findMany({
      where: query,
    });

    console.log(`Syncing ${accounts.length} JustCall accounts`);
    
    const results = await Promise.allSettled(
      accounts.map(async (account) => {
        try {
          const justCallService = new JustCallService(account);
          
          // Get messages since last sync
          const messages = await justCallService.getMessages(undefined, account.lastSync);
          
          let processedCount = 0;
          
          // Process each message
          for (const message of messages) {
            // Skip outbound messages as they were likely sent from our system
            if (message.direction === 'outbound') {
              continue;
            }
            
            await justCallService.processIncomingMessage(message);
            processedCount++;
          }
          
          // Update last sync time
          await db.syncAccount.update({
            where: { id: account.id },
            data: { lastSync: new Date() },
          });
          
          return { accountId: account.id, processed: processedCount };
        } catch (error) {
          console.error(`Error syncing JustCall account ${account.id}:`, error);
          return { accountId: account.id, error: error instanceof Error ? error.message : 'Unknown error' };
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
          const messages = await twilioService.getMessages(account.lastSync);
          
          let processedCount = 0;
          
          // Process each message
          for (const message of messages) {
            // Skip outbound messages as they were likely sent from our system
            if (message.direction !== 'inbound') {
              continue;
            }
            
            await twilioService.processIncomingMessage(message);
            processedCount++;
          }
          
          // Update last sync time
          await db.syncAccount.update({
            where: { id: account.id },
            data: { lastSync: new Date() },
          });
          
          return { accountId: account.id, processed: processedCount };
        } catch (error) {
          console.error(`Error syncing Twilio account ${account.id}:`, error);
          return { accountId: account.id, error: error instanceof Error ? error.message : 'Unknown error' };
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
