import { Email } from "@/lib/types";
import { SyncAccountModel } from "@/lib/types";
import { db } from "@/lib/db";

// Nylas grant model for storing authenticated connections
export interface NylasAccount {
  id?: string;
  label: string;
  grantId: string;
  provider: "outlook" | "exchange" | "office365";
  email: string;
  accessToken?: string;
  lastSync?: Date;
}

// Interface for Nylas webhooks
interface NylasWebhook {
  id: string;
  description: string;
  status: string;
  triggerTypes: string[];
  callbackUrl: string;
}

export class NylasService {
  private readonly baseUrl = "https://api.nylas.com/v3";
  private readonly apiKey: string;
  private readonly grantId: string;
  private readonly accountId: string;
  private readonly email: string;

  constructor(syncAccount: SyncAccountModel) {
    try {
      if (!process.env.NYLAS_API_KEY) {
        throw new Error("NYLAS_API_KEY environment variable is not set");
      }

      this.apiKey = process.env.NYLAS_API_KEY;

      if (!syncAccount.credentials) {
        throw new Error("No grant ID found for Nylas account");
      }

      // Parse the credentials (which should contain the grantId)
      const credentials =
        typeof syncAccount.credentials === "string"
          ? JSON.parse(syncAccount.credentials)
          : syncAccount.credentials;

      this.grantId = credentials.grantId;
      this.email = credentials.email || "";
      this.accountId = syncAccount.id;

      if (!this.grantId) {
        throw new Error("Invalid Nylas credentials: missing grantId");
      }
    } catch (error) {
      console.error("Error initializing Nylas service:", error);
      throw new Error("Failed to initialize Nylas service");
    }
  }

  // Helper method to get auth headers
  private getAuthHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  /**
   * Fetch emails from Nylas
   * @param options - Fetch options for pagination, filtering, etc.
   */
  async getMessages(
    options: {
      limit?: number;
      page?: number;
      fromDate?: Date;
      cursor?: string;
      searchQuery?: string;
    } = {}
  ) {
    try {
      const { limit = 100, page = 1, fromDate, cursor, searchQuery } = options;

      // Build query parameters
      const queryParams = new URLSearchParams();
      queryParams.append("limit", limit.toString());

      if (cursor) {
        queryParams.append("cursor", cursor);
      }

      if (searchQuery) {
        queryParams.append("search_query_native", searchQuery);
      }

      if (fromDate) {
        // Convert date to Unix timestamp
        const timestamp = Math.floor(fromDate.getTime() / 1000);
        queryParams.append("created_after", timestamp.toString());
      }

      // Endpoint URL
      const url = `${this.baseUrl}/messages?${queryParams.toString()}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          ...this.getAuthHeaders(),
          "X-Nylas-Grant-Id": this.grantId,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Nylas API error: ${errorData.message || response.statusText}`
        );
      }

      const data = await response.json();
      return this.mapNylasMessagesToEmails(data.data || []);
    } catch (error) {
      console.error("Failed to fetch Nylas messages:", error);
      throw error;
    }
  }

  /**
   * Map Nylas messages to CommsSync Email format
   */
  private mapNylasMessagesToEmails(messages: any[]): Email[] {
    return messages.map((message) => {
      // Extract sender (from) information
      const from = {
        name: message.from?.[0]?.name || "",
        email: message.from?.[0]?.email || "",
      };

      // Extract recipient (to) information
      const to =
        message.to?.map((recipient: any) => ({
          name: recipient.name || "",
          email: recipient.email || "",
        })) || [];

      // Process attachments if any
      const attachments =
        message.attachments?.map((attachment: any) => ({
          id: attachment.id,
          filename: attachment.filename,
          contentType: attachment.contentType,
          size: attachment.size,
          url: `${this.baseUrl}/grants/${this.grantId}/messages/${message.id}/files/${attachment.id}/download`,
        })) || [];

      // Map to CommsSync Email format
      return {
        id: message.id,
        accountId: this.accountId,
        threadId: message.threadId || message.id,
        from,
        to,
        subject: message.subject || "(No Subject)",
        snippet: message.snippet || "",
        body: message.body || "",
        bodyType: "html",
        date: new Date(message.date * 1000).toISOString(),
        unread: !message.seen,
        labels: [], // Nylas uses folders, will map accordingly
        starred: message.starred || false,
        attachments,
        accountType: "imap",
        providerType: "outlook",
      };
    });
  }

  /**
   * Send a message using Nylas
   */
  async sendMessage({
    to,
    cc,
    bcc,
    subject,
    body,
    attachments = [],
  }: {
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    body: string;
    attachments?: File[];
  }): Promise<any> {
    try {
      // Prepare recipients in the format Nylas expects
      const formatRecipients = (addresses: string | string[]) => {
        if (!addresses) return [];
        const addressList = Array.isArray(addresses) ? addresses : [addresses];
        return addressList.map((address) => {
          // Handle simple email or "Name <email>" format
          const match = address.match(/(.*?)\s*<(.+@.+)>/) || [
            null,
            "",
            address,
          ];
          return {
            name: match[1]?.trim() || "",
            email: match[2]?.trim() || address.trim(),
          };
        });
      };

      // Prepare message payload
      const messageData: any = {
        to: formatRecipients(to),
        subject,
        body,
      };

      // Add optional fields if provided
      if (cc) messageData.cc = formatRecipients(cc);
      if (bcc) messageData.bcc = formatRecipients(bcc);

      // Handle attachments if any
      if (attachments && attachments.length > 0) {
        // First upload each attachment and get the attachment IDs
        const attachmentIds = await Promise.all(
          attachments.map(async (file) => {
            const formData = new FormData();
            formData.append("file", file);

            const uploadResponse = await fetch(
              `${this.baseUrl}/grants/${this.grantId}/files`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${this.apiKey}`,
                },
                body: formData,
              }
            );

            if (!uploadResponse.ok) {
              throw new Error(`Failed to upload attachment: ${file.name}`);
            }

            const fileData = await uploadResponse.json();
            return fileData.id;
          })
        );

        // Add attachment IDs to the message data
        messageData.file_ids = attachmentIds;
      }

      // Send the message
      const response = await fetch(
        `${this.baseUrl}/grants/${this.grantId}/messages/send`,
        {
          method: "POST",
          headers: this.getAuthHeaders(),
          body: JSON.stringify(messageData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Failed to send message: ${errorData.message || response.statusText}`
        );
      }

      const result = await response.json();

      // Map the sent message back to our Email format
      return this.mapNylasMessagesToEmails([result])[0];
    } catch (error) {
      console.error("Failed to send message via Nylas:", error);
      throw error;
    }
  }

  /**
   * Configure a Nylas webhook for real-time updates
   */
  async setupWebhook(callbackUrl: string): Promise<NylasWebhook> {
    try {
      const webhookData = {
        description: "CommsSync webhook for real-time email updates",
        webhook_url: callbackUrl,
        trigger_types: [
          "message.created",
          "message.updated",
          "message.deleted",
        ],
        notification_email: this.email,
      };

      const response = await fetch(`${this.baseUrl}/webhooks`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(webhookData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Failed to setup webhook: ${errorData.message || response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to setup Nylas webhook:", error);
      throw error;
    }
  }

  /**
   * Process a new message from Nylas webhook
   */
  async processIncomingMessage(message: any): Promise<void> {
    try {
      // Get the syncAccount
      const syncAccount = await db.syncAccount.findFirst({
        where: { id: this.accountId },
      });

      if (!syncAccount) {
        throw new Error(`Sync account not found: ${this.accountId}`);
      }

      // Find or create contact based on the email
      const email = message.from?.[0]?.email;
      const contactName = message.from?.[0]?.name || email;

      if (!email) {
        console.error("Missing sender email in message:", message);
        return;
      }

      // Find sender by email and platform
      const existingSender = await db.sender.findFirst({
        where: {
          platform: "nylas",
          identifier: email,
        },
        include: {
          contact: true,
        },
      });

      let contactId: string;

      if (existingSender) {
        // Use existing contact
        contactId = existingSender.contactId;
      } else {
        // Create new contact and sender
        const newContact = await db.contact.create({
          data: {
            userId: syncAccount.userId,
            name: contactName,
            email: email,
            senders: {
              create: {
                platform: "nylas",
                identifier: email,
              },
            },
          },
        });
        contactId = newContact.id;
      }

      // Find or create conversation
      let conversation = await db.conversation.findFirst({
        where: {
          contactId,
        },
      });

      if (!conversation) {
        conversation = await db.conversation.create({
          data: {
            contactId,
            title: `Conversation with ${contactName}`,
          },
        });
      }

      // Process attachments if any
      const attachments =
        message.attachments && message.attachments.length > 0
          ? JSON.stringify(message.attachments)
          : null;

      // Create the message in our database
      await db.message.create({
        data: {
          conversationId: conversation.id,
          syncAccountId: syncAccount.id,
          platform: "nylas",
          externalId: message.id,
          direction: "inbound",
          content: message.body || message.snippet || "",
          contentType: "html",
          metadata: JSON.stringify(message),
          attachments,
          sentAt: new Date(message.date * 1000),
          isRead: false,
        },
      });

      // Update conversation last activity
      await db.conversation.update({
        where: { id: conversation.id },
        data: { lastActivity: new Date() },
      });
    } catch (error) {
      console.error("Failed to process incoming Nylas message:", error);
      throw error;
    }
  }
}

/**
 * Create a new Nylas auth URL for connecting an Outlook account
 */
export async function createNylasAuthUrl(redirectUri: string): Promise<string> {
  if (!process.env.NYLAS_API_KEY || !process.env.NYLAS_CLIENT_ID) {
    throw new Error(
      "Missing Nylas API key or client ID in environment variables"
    );
  }

  // Build the auth URL with appropriate scopes
  const scopes = [
    "email.read_only",
    "email.send",
    "email.modify",
    "calendar.read_only",
    "calendar.modify",
  ];

  // URL params for the auth redirect
  const params = new URLSearchParams({
    client_id: process.env.NYLAS_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scopes: scopes.join(" "),
  });

  return `https://api.nylas.com/v3/connect/authorize?${params.toString()}`;
}

/**
 * Exchange an authorization code for a Nylas grant ID
 */
export async function exchangeCodeForGrant(
  code: string,
  redirectUri: string
): Promise<{
  grantId: string;
  email: string;
  provider: string;
}> {
  if (
    !process.env.NYLAS_API_KEY ||
    !process.env.NYLAS_CLIENT_ID ||
    !process.env.NYLAS_CLIENT_SECRET
  ) {
    throw new Error("Missing Nylas API credentials in environment variables");
  }

  try {
    const response = await fetch("https://api.nylas.com/v3/connect/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.NYLAS_API_KEY}`,
      },
      body: JSON.stringify({
        client_id: process.env.NYLAS_CLIENT_ID,
        client_secret: process.env.NYLAS_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Failed to exchange code: ${errorData.message || response.statusText}`
      );
    }

    const data = await response.json();

    return {
      grantId: data.grant_id,
      email: data.email_address,
      provider: data.provider,
    };
  } catch (error) {
    console.error("Failed to exchange code for Nylas grant:", error);
    throw error;
  }
}
