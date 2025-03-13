import { Email } from "@/lib/types";
import { ImapAccount } from "@/lib/imap-service";
import { fetchEmails as fetchGmailEmails } from "@/lib/gmail-api";
import { useEmailStore } from "@/lib/email-store";

export class SyncService {
  private static instance: SyncService;
  private syncInProgress = false;

  private constructor() {}

  static getInstance(): SyncService {
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

    } catch (error) {
      console.error("Error syncing emails:", error);
    } finally {
      this.syncInProgress = false;
    }
  }
}