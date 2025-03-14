import { Email } from "@/lib/types";
import { useEmailStore } from "@/lib/email-store";

interface EmailLoadOptions {
  maxRetries?: number;
  retryDelay?: number;
}

export class EmailContentLoader {
  private static instance: EmailContentLoader;
  private loadingEmails = new Set<string>();
  private retryMap = new Map<string, number>();

  public constructor() {}

  static getInstance(): EmailContentLoader {
    if (!EmailContentLoader.instance) {
      EmailContentLoader.instance = new EmailContentLoader();
    }
    return EmailContentLoader.instance;
  }

  /**
   * Load email content for a specific email
   */
  async loadEmailContent(
    email: Email,
    options: EmailLoadOptions = {}
  ): Promise<Email | null> {
    const { maxRetries = 3, retryDelay = 2000 } = options;
    const emailKey = this.getEmailKey(email);

    // Skip if email already has content
    if (this.hasContent(email)) {
      return email;
    }

    // Prevent duplicate loading requests
    if (this.loadingEmails.has(emailKey)) {
      return null;
    }

    // Track current retry count
    const currentRetry = this.retryMap.get(emailKey) || 0;
    if (currentRetry >= maxRetries) {
      this.retryMap.delete(emailKey);
      return null;
    }

    this.loadingEmails.add(emailKey);
    this.retryMap.set(emailKey, currentRetry + 1);

    try {
      let updatedEmail: Email | null = null;

      if (email.accountType === 'imap' && email.accountId) {
        updatedEmail = await this.loadImapEmailContent(email);
      } else {
        updatedEmail = await this.loadGmailEmailContent(email);
      }

      if (updatedEmail) {
        // Update the email store
        const store = useEmailStore.getState();
        store.addEmail(updatedEmail);
        this.retryMap.delete(emailKey);
        return updatedEmail;
      }

      // If we reach here, loading failed but didn't throw
      if (currentRetry < maxRetries - 1) {
        // Schedule retry with exponential backoff
        setTimeout(() => {
          this.loadingEmails.delete(emailKey);
          this.loadEmailContent(email, options);
        }, retryDelay * Math.pow(2, currentRetry));
      } else {
        this.retryMap.delete(emailKey);
      }
      
      return null;
    } catch (error) {
      console.error(`Failed to load email content for ${emailKey}:`, error);
      
      if (currentRetry < maxRetries - 1) {
        // Schedule retry with exponential backoff
        setTimeout(() => {
          this.loadingEmails.delete(emailKey);
          this.loadEmailContent(email, options);
        }, retryDelay * Math.pow(2, currentRetry));
      } else {
        this.retryMap.delete(emailKey);
      }
      
      return null;
    } finally {
      this.loadingEmails.delete(emailKey);
    }
  }

  private async loadImapEmailContent(email: Email): Promise<Email | null> {
    if (!email.accountId) return null;
    
    const account = useEmailStore.getState().getImapAccount(email.accountId);
    if (!account) return null;

    const response = await fetch("/api/imap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "fetchEmailContent",
        account,
        data: {
          messageId: email.id,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch IMAP email content: ${response.statusText}`);
    }

    const data = await response.json();
    return data.email || null;
  }

  private async loadGmailEmailContent(email: Email): Promise<Email | null> {
    // Get access token from localStorage or wherever it's stored
    const accessToken = localStorage.getItem("gmailAccessToken");
    if (!accessToken) return null;

    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.id}?format=full`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Gmail email content: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Parse the Gmail message format into our Email type
    // This would need to match your existing Gmail parsing logic
    // Simplified example:
    const parsedEmail = {
      ...email,
      body: this.extractBodyFromGmailMessage(data),
      attachments: this.extractAttachmentsFromGmailMessage(data),
    };
    
    return parsedEmail;
  }

  private extractBodyFromGmailMessage(message: any): string {
    // Implementation depends on your Gmail message parsing logic
    // This is a placeholder
    return message.payload?.body?.data 
      ? atob(message.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'))
      : '';
  }

  private extractAttachmentsFromGmailMessage(message: any): any[] {
    // Implementation depends on your Gmail message parsing logic
    // This is a placeholder
    return message.payload?.parts?.filter((part: any) => part.filename && part.filename.length > 0) || [];
  }

  private getEmailKey(email: Email): string {
    // Use a consistent key format that doesn't depend on accountType/accountId
    // This ensures the same email is recognized regardless of how it was fetched
    return `${email.id}`;
  }

  public hasContent(email: Email): boolean {
    return Boolean(email.body && email.body.trim() !== '');
  }
}