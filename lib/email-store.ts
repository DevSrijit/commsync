"use client";

import { create } from "zustand";
import type { Email, Contact, Group } from "@/lib/types";
import { MessageCategory } from "@/components/sidebar";
import { ImapAccount } from "@/lib/imap-service";
import { SyncService } from "./sync-service";
import {
  getCacheValue,
  getMultipleCacheValues,
  setCacheValue,
  removeCacheValue,
} from "./client-cache-browser";
import { formatJustCallTimestamp } from "./justcall-service";

interface EmailStore {
  emails: Email[];
  contacts: Contact[];
  activeFilter: MessageCategory;
  activeGroup: string | null;
  imapAccounts: ImapAccount[];
  twilioAccounts: any[];
  justcallAccounts: any[];
  bulkvsAccounts: any[];
  whatsappAccounts: any[];
  groups: Group[];
  currentImapPage: number;
  currentTwilioPage: number;
  lastJustcallMessageIds: Record<string, string>;
  lastBulkvsMessageIds: Record<string, string>;
  loadPageSize: number;
  setEmails: (emails: Email[]) => void;
  setActiveFilter: (filter: MessageCategory) => void;
  addEmail: (email: Email) => void;
  addImapAccount: (account: ImapAccount) => void;
  removeImapAccount: (id: string) => void;
  getImapAccount: (id: string) => ImapAccount | undefined;
  syncEmails: (
    gmailToken: string | null,
    options?: { isLoadingMore?: boolean; oldestEmailDate?: string }
  ) => Promise<number>;
  syncImapAccounts: () => Promise<number>;
  syncTwilioAccounts: () => Promise<number>;
  syncJustcallAccounts: (
    isLoadingMore?: boolean
  ) => Promise<
    number | { count: number; rateLimited: boolean; retryAfter: number }
  >;
  syncBulkvsAccounts: (
    isLoadingMore?: boolean
  ) => Promise<
    number | { count: number; rateLimited: boolean; retryAfter: number }
  >;
  syncAllPlatforms: (gmailToken?: string | null) => Promise<void>;
  setImapAccounts: (accounts: ImapAccount[]) => void;
  setTwilioAccounts: (accounts: any[]) => void;
  setJustcallAccounts: (accounts: any[]) => void;
  setBulkvsAccounts: (accounts: any[]) => void;
  setWhatsappAccounts: (accounts: any[]) => void;
  syncWhatsappAccounts: (
    isLoadingMore?: boolean
  ) => Promise<
    number | { count: number; rateLimited: boolean; retryAfter: number }
  >;
  setLoadPageSize: (size: number) => void;
  addGroup: (group: Group) => void;
  updateGroup: (group: Group) => void;
  deleteGroup: (groupId: string) => void;
  syncGroups: () => Promise<void>;
  setGroups: (groups: Group[]) => void;
  updateContacts: (emails: Email[]) => void;
  deleteConversation: (contactEmail: string) => void;
}

// Helper function to load persisted data
const loadPersistedData = async () => {
  // Always return empty arrays during server-side rendering
  if (typeof window === "undefined") {
    return {
      emails: [],
      imapAccounts: [],
      twilioAccounts: [],
      justcallAccounts: [],
      whatsappAccounts: [],
      groups: [],
      lastJustcallMessageIds: {},
      lastBulkvsMessageIds: {},
    };
  }

  try {
    // Use the browser cache client to get multiple values at once
    const cacheData = await getMultipleCacheValues([
      "emails",
      "imapAccounts",
      "twilioAccounts",
      "justcallAccounts",
      "whatsappAccounts",
      "groups",
      "lastJustcallMessageIds",
      "lastBulkvsMessageIds",
    ]);

    // For backwards compatibility, if we have the old format, convert it
    let lastMessageIds = cacheData.lastJustcallMessageIds;
    if (!lastMessageIds && cacheData.lastJustcallMessageId) {
      // If we have just a single ID from the old format, migrate it
      const justcallAccounts = cacheData.justcallAccounts || [];
      lastMessageIds = {};

      // If we have accounts, assign the old cursor to all accounts
      if (justcallAccounts.length > 0 && cacheData.lastJustcallMessageId) {
        justcallAccounts.forEach((account: any) => {
          if (account.id) {
            lastMessageIds[account.id] = cacheData.lastJustcallMessageId;
          }
        });
      }
    }

    return {
      emails: cacheData.emails || [],
      imapAccounts: cacheData.imapAccounts || [],
      twilioAccounts: cacheData.twilioAccounts || [],
      justcallAccounts: cacheData.justcallAccounts || [],
      whatsappAccounts: cacheData.whatsappAccounts || [],
      groups: cacheData.groups || [],
      lastJustcallMessageIds: lastMessageIds || {},
      lastBulkvsMessageIds: cacheData.lastBulkvsMessageIds || {},
    };
  } catch (e) {
    console.error("Failed to load persisted data:", e);
    return {
      emails: [],
      imapAccounts: [],
      twilioAccounts: [],
      justcallAccounts: [],
      whatsappAccounts: [],
      groups: [],
      lastJustcallMessageIds: {},
      lastBulkvsMessageIds: {},
    };
  }
};

// Improved email key generation function
const generateEmailKey = (email: Email): string => {
  // For JustCall messages, we need to use the threadId specifically
  if (email.accountType === "justcall" && email.threadId) {
    // Generate a key that includes the direction to prevent mixing outbound to different contacts
    const direction = email.from.email === "You" ? "outbound" : "inbound";
    return `justcall:${email.threadId}:${direction}:${email.id}`;
  }

  // Create a more robust key that includes thread info when available
  // This ensures emails are properly grouped even from different sources
  if (email.threadId) {
    return `${email.threadId}:${email.id}`;
  }

  // Fallback to ID with account info to avoid collisions across platforms
  if (email.accountType) {
    return `${email.accountType}:${email.id}`;
  }

  // Last resort - just use ID
  return `${email.id}`;
};

// Filter function to identify valid emails
const isValidEmail = (email: Email): boolean => {
  // Check if email has ID
  if (!email.id) {
    return false;
  }

  // SMS messages might have different validation requirements
  const isSMS =
    email.accountType === "twilio" ||
    email.accountType === "justcall" ||
    (email.labels && email.labels.includes("SMS"));

  if (isSMS) {
    // For SMS, we just need the basic fields
    if (!email.from || !email.from.email) {
      return false;
    }

    // SMS may sometimes have empty bodies, but that's okay
    return true;
  } else {
    // For regular emails, require more fields
    if (!email.from || !email.from.email || !email.subject) {
      return false;
    }

    // Skip emails with empty body and error source - these are likely error placeholders
    if (
      (!email.body || email.body.trim() === "") &&
      email.source !== "gmail-api-error"
    ) {
      return false;
    }
  }

  // Ensure required fields are present
  if (!email.labels) {
    email.labels = [];
  }

  return true;
};

// Helper function to generate contacts from emails
const generateContactsFromEmails = (emails: Email[]): Contact[] => {
  const contactsMap = new Map<string, Contact>();

  emails.forEach((email) => {
    // Skip processing if email doesn't have proper structure
    if (!email.from || !email.from.email) {
      return;
    }

    // Check if this is an SMS message
    const isSMS =
      email.accountType === "twilio" ||
      email.accountType === "justcall" ||
      (email.labels && email.labels.includes("SMS"));

    // Safely parse the email date to a Date object
    const emailDate = email.date ? new Date(email.date) : new Date();

    // Add sender as contact (if not the current user)
    if (!email.from.email.includes("me")) {
      // For JustCall outbound messages, use recipient's email (contact_number) as the key
      if (
        email.accountType === "justcall" &&
        (email.from.email === "You" || email.from.name === "You") &&
        email.to &&
        email.to.length > 0
      ) {
        // Use the first recipient's email as the contact key
        const contactKey = email.to[0].email.toLowerCase();
        const existingContact = contactsMap.get(contactKey);

        if (
          !existingContact ||
          new Date(existingContact.lastMessageDate) < emailDate
        ) {
          contactsMap.set(contactKey, {
            name:
              email.to[0].name ||
              (isSMS ? `Phone: ${email.to[0].email}` : email.to[0].email),
            email: email.to[0].email, // Important: Use recipient's number as the contact email
            lastMessageDate: email.date,
            lastMessageSubject: isSMS ? "SMS Message" : email.subject,
            labels: isSMS ? ["SMS", ...(email.labels || [])] : email.labels,
            accountId: email.accountId,
            accountType: email.accountType,
          });
        }
      } else {
        // For all other messages, use sender's email as the contact key
        const contactKey = email.from.email.toLowerCase();
        const existingContact = contactsMap.get(contactKey);

        if (
          !existingContact ||
          new Date(existingContact.lastMessageDate) < emailDate
        ) {
          contactsMap.set(contactKey, {
            name:
              email.from.name ||
              (isSMS ? `Phone: ${email.from.email}` : email.from.email),
            email: email.from.email,
            lastMessageDate: email.date,
            lastMessageSubject: isSMS ? "SMS Message" : email.subject,
            labels: isSMS ? ["SMS", ...(email.labels || [])] : email.labels,
            accountId: email.accountId,
            accountType: email.accountType,
          });
        }
      }
    }

    // Add recipients as contacts
    if (Array.isArray(email.to)) {
      email.to.forEach((recipient) => {
        // Skip 'You' recipients for JustCall messages
        if (
          email.accountType === "justcall" &&
          (recipient.email.includes("me") || recipient.name === "You")
        ) {
          return;
        }

        // For non-justcall messages, skip 'me'
        if (
          email.accountType !== "justcall" &&
          recipient.email.includes("me")
        ) {
          return;
        }

        // Use email address only as the contact key
        const contactKey = recipient.email.toLowerCase();
        const existingContact = contactsMap.get(contactKey);

        if (
          !existingContact ||
          new Date(existingContact.lastMessageDate) < emailDate
        ) {
          contactsMap.set(contactKey, {
            name:
              recipient.name ||
              (isSMS ? `Phone: ${recipient.email}` : recipient.email),
            email: recipient.email,
            lastMessageDate: email.date,
            lastMessageSubject: isSMS ? "SMS Message" : email.subject,
            labels: isSMS ? ["SMS", ...(email.labels || [])] : email.labels,
            accountId: email.accountId,
            accountType: email.accountType,
          });
        }
      });
    }
  });

  // Sort contacts by most recent message
  return Array.from(contactsMap.values()).sort((a, b) => {
    const dateA = a.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0;
    const dateB = b.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0;
    return dateB - dateA; // Newest first
  });
};

export const useEmailStore = create<EmailStore>((set, get) => {
  // Initialize with empty data, we'll load asynchronously
  const initialData = {
    emails: [],
    imapAccounts: [],
    twilioAccounts: [],
    justcallAccounts: [],
    whatsappAccounts: [],
    groups: [],
    lastJustcallMessageIds: {},
    lastBulkvsMessageIds: {},
  };

  // Load saved page size from localStorage if available
  const savedPageSize =
    typeof window !== "undefined"
      ? parseInt(localStorage.getItem("loadPageSize") || "100")
      : 100;

  // Load data asynchronously after initialization
  if (typeof window !== "undefined") {
    // Need to use void to tell TypeScript this is intentionally not being awaited
    void (async () => {
      try {
        const persistedData = await loadPersistedData();
        set({
          emails: persistedData.emails,
          contacts: generateContactsFromEmails(persistedData.emails),
          imapAccounts: persistedData.imapAccounts,
          twilioAccounts: persistedData.twilioAccounts,
          justcallAccounts: persistedData.justcallAccounts,
          whatsappAccounts: persistedData.whatsappAccounts,
          groups: persistedData.groups,
          lastJustcallMessageIds: persistedData.lastJustcallMessageIds,
          lastBulkvsMessageIds: persistedData.lastBulkvsMessageIds,
        });
      } catch (error) {
        console.error("Error loading persisted data:", error);
      }
    })();
  }

  return {
    emails: initialData.emails,
    contacts: [],
    activeFilter: "inbox" as MessageCategory,
    activeGroup: null,
    imapAccounts: initialData.imapAccounts,
    twilioAccounts: initialData.twilioAccounts,
    justcallAccounts: initialData.justcallAccounts,
    whatsappAccounts: initialData.whatsappAccounts,
    bulkvsAccounts: [],
    groups: initialData.groups,
    currentImapPage: 1,
    currentTwilioPage: 1,
    lastJustcallMessageIds: initialData.lastJustcallMessageIds,
    lastBulkvsMessageIds: initialData.lastBulkvsMessageIds,
    loadPageSize: savedPageSize,

    syncEmails: async (
      gmailToken: string | null,
      options?: { isLoadingMore?: boolean; oldestEmailDate?: string }
    ) => {
      const { imapAccounts, loadPageSize } = get();
      try {
        if (!gmailToken) {
          console.log("No Gmail token provided, skipping Gmail sync");
          return 0;
        } else {
          try {
            // Use the configured page size
            console.log(`Using configured page size: ${loadPageSize}`);

            const isLoadingMore = options?.isLoadingMore || false;
            const oldestEmailDate = options?.oldestEmailDate;

            if (isLoadingMore && oldestEmailDate) {
              console.log(
                `Loading more Gmail emails older than ${oldestEmailDate}`
              );

              // We need to fetch emails with a date filter
              try {
                // Import and use fetchEmails directly for more control
                const { fetchEmails } = await import("@/lib/gmail-api");

                // Construct a query to find emails older than our oldest email
                // Gmail search syntax: before:YYYY/MM/DD
                const oldestDate = new Date(oldestEmailDate);
                const formattedDate = `${oldestDate.getFullYear()}/${(
                  oldestDate.getMonth() + 1
                )
                  .toString()
                  .padStart(2, "0")}/${oldestDate
                  .getDate()
                  .toString()
                  .padStart(2, "0")}`;
                const query = `before:${formattedDate}`;

                console.log(`Gmail API query for older emails: ${query}`);

                // Fetch older emails
                const olderEmails = await fetchEmails(
                  gmailToken,
                  1, // page
                  loadPageSize, // pageSize
                  query // date-based filter
                );

                console.log(`Fetched ${olderEmails.length} older Gmail emails`);

                if (olderEmails.length > 0) {
                  // Merge with existing emails
                  const currentEmails = get().emails;

                  // Deduplicate using email IDs
                  const existingIds = new Set(
                    currentEmails.map((email) => email.id)
                  );
                  const newEmails = olderEmails.filter(
                    (email) => !existingIds.has(email.id)
                  );

                  if (newEmails.length > 0) {
                    console.log(
                      `Adding ${newEmails.length} new older Gmail emails`
                    );

                    // Combine existing and new emails
                    const combinedEmails = [...currentEmails, ...newEmails];

                    // Sort by date, newest first
                    combinedEmails.sort(
                      (a, b) =>
                        new Date(b.date).getTime() - new Date(a.date).getTime()
                    );

                    // Update the store
                    get().setEmails(combinedEmails);
                    setCacheValue("emails", combinedEmails);

                    return newEmails.length; // Return count of new emails
                  } else {
                    console.log("No new Gmail emails found");
                    return 0;
                  }
                } else {
                  console.log("No older Gmail emails found");
                  return 0;
                }
              } catch (error) {
                console.error("Error fetching older Gmail emails:", error);
                return 0;
              }
            } else {
              // Normal sync without backwards loading
              await SyncService.getInstance().syncAllEmails(
                gmailToken,
                imapAccounts,
                1,
                loadPageSize,
                "" // Empty query for regular sync
              );
              return 1; // Return a positive number to indicate success
            }
          } catch (apiError: any) {
            // Handle auth errors
            console.error("Error syncing emails:", apiError);
            if (
              apiError?.response?.status === 401 ||
              apiError?.error?.code === 401 ||
              (apiError?.message &&
                apiError.message.includes("Invalid Credentials"))
            ) {
              // Try to refresh the token
              try {
                console.log("Attempting to refresh Google token...");
                const response = await fetch(
                  `/api/auth/refresh?provider=google`,
                  {
                    method: "POST",
                    credentials: "same-origin",
                  }
                );

                if (response.ok) {
                  // Token refresh successful, get the new token
                  const refreshData = await response.json();
                  if (refreshData.accessToken) {
                    console.log(
                      "Token refreshed successfully, retrying API call"
                    );
                    // Retry the API call with the new token and configured page size
                    await SyncService.getInstance().syncAllEmails(
                      refreshData.accessToken,
                      imapAccounts,
                      1,
                      loadPageSize
                    );
                    return 1; // Success, exit function
                  }
                } else {
                  console.error(
                    "Failed to refresh Google token:",
                    await response.text()
                  );
                  // Only redirect if we're in browser context
                  if (typeof window !== "undefined") {
                    window.location.href = `/login?error=token_expired&provider=google`;
                  }
                  return 0;
                }
              } catch (refreshError) {
                console.error("Error refreshing Google token:", refreshError);
                // Only redirect if we're in browser context
                if (typeof window !== "undefined") {
                  window.location.href = `/login?error=token_expired&provider=google`;
                }
                return 0;
              }
            }
            return 0;
          }
        }
      } catch (error: any) {
        console.error("Unhandled error in syncEmails:", error);
        return 0;
      }
    },

    syncImapAccounts: async () => {
      try {
        console.log("Starting IMAP accounts sync");
        // Get current page and page size
        const currentPage = get().currentImapPage;
        const loadPageSize = get().loadPageSize;
        console.log(
          `Fetching IMAP accounts, page ${currentPage}, pageSize ${loadPageSize}`
        );

        // For loading older messages, we need to track the oldest message date
        // Get all current emails to find the oldest date
        const currentEmails = get().emails;
        const imapEmails = currentEmails.filter(
          (email) => email.accountType === "imap"
        );

        // Find the oldest IMAP message date if we have any
        let oldestDate: Date | undefined = undefined;
        if (imapEmails.length > 0) {
          const dates = imapEmails.map((email: Email) => new Date(email.date));
          oldestDate = new Date(Math.min(...dates.map((d) => d.getTime())));
          console.log(`Oldest IMAP message date: ${oldestDate.toISOString()}`);
        }

        // Fetch all IMAP accounts for the user
        const response = await fetch("/api/sync/accounts?platform=imap");
        if (!response.ok) {
          console.error(
            "Failed to fetch IMAP accounts:",
            await response.text()
          );
          return 0; // Return 0 new messages on error
        }

        const { accounts } = await response.json();
        console.log(`Found ${accounts?.length || 0} IMAP accounts`);

        if (!accounts || accounts.length === 0) {
          return 0; // Return 0 if no accounts
        }

        set((state) => ({ ...state, imapAccounts: accounts }));

        let totalNewMessages = 0;
        let newMessagesFoundForAnyAccount = false;

        // Process each account separately to get messages
        for (const account of accounts) {
          console.log(`Syncing IMAP account ${account.id}`);

          // Set up filter for messages older than the oldest date we have
          const filter: any = {};
          if (oldestDate) {
            // Set the 'before' filter to get messages older than our oldest message
            filter.before = oldestDate;
          }

          // Fetch messages with pagination and date filtering
          const fetchResult = await fetch("/api/imap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "fetchEmails",
              account,
              data: {
                page: currentPage,
                pageSize: loadPageSize, // Use configured page size
                filter: filter,
              },
            }),
          });

          if (fetchResult.ok) {
            const { emails: messages, total } = await fetchResult.json();
            console.log(
              `Retrieved ${
                messages?.length || 0
              } older IMAP messages for account ${
                account.id
              } on page ${currentPage}`
            );

            if (messages && messages.length > 0) {
              console.log(`Processing ${messages.length} IMAP messages`);

              // When loading older messages, we shouldn't have duplicates by ID
              // But check anyway for safety
              const existingIds = new Set(
                currentEmails.map((email) => email.id)
              );
              const newEmails = messages.filter(
                (email: Email) => !existingIds.has(email.id)
              );

              if (newEmails.length > 0) {
                totalNewMessages += newEmails.length;
                newMessagesFoundForAnyAccount = true;

                // Merge with existing emails
                const mergedEmails = [...currentEmails, ...newEmails];

                // Sort by date descending (newest first) after merging
                mergedEmails.sort((a, b) => {
                  // Safely parse dates and convert to timestamp
                  const dateA = a.date ? new Date(a.date).getTime() : 0;
                  const dateB = b.date ? new Date(b.date).getTime() : 0;
                  return dateB - dateA; // Newest first
                });

                get().setEmails(mergedEmails);
                console.log(
                  `Updated email store with ${newEmails.length} older IMAP messages. New count: ${mergedEmails.length}`
                );
                setCacheValue("emails", mergedEmails);
              } else {
                console.log(
                  `No new IMAP messages for account ${account.id} on page ${currentPage}`
                );
              }
            } else {
              console.log(
                `No IMAP messages for account ${account.id} on page ${currentPage}`
              );
            }
          } else {
            console.error(
              `Failed to fetch IMAP messages for account ${account.id}:`,
              await fetchResult.text()
            );
          }

          // Update last sync time for the account
          try {
            await fetch("/api/imap", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "updateLastSync",
                data: { accountId: account.id },
              }),
            });
          } catch (error) {
            console.error(
              `Error updating last sync time for IMAP account ${account.id}:`,
              error
            );
          }
        }

        // Only increment the page counter if we found new messages for any account
        if (newMessagesFoundForAnyAccount) {
          set((state) => ({ ...state, currentImapPage: currentPage + 1 }));
          console.log(`Incremented IMAP page to ${currentPage + 1}`);
        }

        // Return the number of new messages we found
        return totalNewMessages;
      } catch (error) {
        console.error("Error syncing IMAP accounts:", error);
        return 0; // Return 0 new messages on error
      }
    },

    syncTwilioAccounts: async () => {
      try {
        console.log("Starting Twilio accounts sync");
        // Get current page and page size
        const currentPage = get().currentTwilioPage;
        const loadPageSize = get().loadPageSize;
        console.log(
          `Fetching Twilio accounts, page ${currentPage}, pageSize ${loadPageSize}`
        );

        // For loading older messages, we need to track the oldest message date
        // Get all current emails to find the oldest date
        const currentEmails = get().emails;
        const twilioEmails = currentEmails.filter(
          (email) => email.accountType === "twilio"
        );

        // Find the oldest twilio message date if we have any
        let oldestDate: Date | undefined = undefined;
        if (twilioEmails.length > 0) {
          const dates = twilioEmails.map(
            (email: Email) => new Date(email.date)
          );
          oldestDate = new Date(Math.min(...dates.map((d) => d.getTime())));
          console.log(
            `Oldest Twilio message date: ${oldestDate.toISOString()}`
          );
        }

        // Fetch all Twilio accounts for the user
        const response = await fetch("/api/sync/accounts?platform=twilio");
        if (!response.ok) {
          console.error(
            "Failed to fetch Twilio accounts:",
            await response.text()
          );
          return 0; // Return 0 new messages on error
        }

        const { accounts } = await response.json();
        console.log(`Found ${accounts?.length || 0} Twilio accounts`);

        if (!accounts || accounts.length === 0) {
          return 0; // Return 0 if no accounts
        }

        set((state) => ({ ...state, twilioAccounts: accounts }));

        let totalNewMessages = 0;
        let newMessagesFoundForAnyAccount = false;

        // Sync messages for each account
        const syncResult = await fetch("/api/sync/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform: "twilio",
            page: currentPage,
            pageSize: loadPageSize, // Use configured page size
            oldestDate: oldestDate ? oldestDate.toISOString() : undefined,
            sortDirection: "asc", // Important: Load older messages, not newer
          }),
        });

        if (syncResult.ok) {
          // After syncing, get all the messages to update the store
          console.log(
            `Current email count before Twilio sync: ${currentEmails.length}`
          );
          const messagesResponse = await fetch(
            `/api/messages?platform=twilio&page=${currentPage}&pageSize=${loadPageSize}&sortDirection=asc&oldestDate=${
              oldestDate ? encodeURIComponent(oldestDate.toISOString()) : ""
            }`
          );
          if (messagesResponse.ok) {
            const { messages } = await messagesResponse.json();
            console.log(
              `Retrieved ${
                messages?.length || 0
              } older Twilio messages for page ${currentPage}`
            );
            if (messages && messages.length > 0) {
              // Convert Twilio messages to Email format
              const twilioEmails = messages.map((msg: any) => ({
                id: msg.id || msg.sid,
                from: {
                  name: msg.from || "Unknown",
                  email: msg.from || msg.contact_number || "",
                },
                to: [
                  {
                    name: msg.to || "You",
                    email: msg.to || msg.number || "",
                  },
                ],
                subject: "SMS Message",
                body: msg.body || "",
                date:
                  msg.created_at ||
                  msg.date_created ||
                  new Date().toISOString(),
                labels: ["TWILIO"],
                accountType: "twilio",
                accountId: msg.accountId,
                platform: "twilio",
              }));

              console.log(
                `Converted ${twilioEmails.length} Twilio messages to Email format`
              );

              // When loading older messages, we shouldn't have duplicates by ID
              // But check anyway for safety
              const existingIds = new Set(
                currentEmails.map((email) => email.id)
              );
              const newEmails = twilioEmails.filter(
                (email: Email) => !existingIds.has(email.id)
              );

              if (newEmails.length > 0) {
                totalNewMessages += newEmails.length;
                newMessagesFoundForAnyAccount = true;

                // Merge with existing emails
                const mergedEmails = [...currentEmails, ...newEmails];

                // Sort by date descending (newest first) after merging
                mergedEmails.sort((a, b) => {
                  // Safely parse dates and convert to timestamp
                  const dateA = a.date ? new Date(a.date).getTime() : 0;
                  const dateB = b.date ? new Date(b.date).getTime() : 0;
                  return dateB - dateA; // Newest first
                });

                get().setEmails(mergedEmails);
                console.log(
                  `Updated email store with ${newEmails.length} older Twilio messages. New count: ${mergedEmails.length}`
                );
                setCacheValue("emails", mergedEmails);
              } else {
                console.log(
                  `No new Twilio messages on page ${currentPage}, not incrementing page counter`
                );
              }
            } else {
              console.log(`No Twilio messages for page ${currentPage}`);
            }
          } else {
            console.error(
              "Failed to fetch Twilio messages:",
              await messagesResponse.text()
            );
          }
        } else {
          console.error(
            "Failed to sync Twilio messages:",
            await syncResult.text()
          );
        }

        // Only increment the page counter if we found new messages
        if (newMessagesFoundForAnyAccount) {
          set((state) => ({ ...state, currentTwilioPage: currentPage + 1 }));
          console.log(`Incremented Twilio page to ${currentPage + 1}`);
        }

        // Return the count of new messages found
        return totalNewMessages;
      } catch (error) {
        console.error("Error syncing Twilio accounts:", error);
        return 0; // Return 0 new messages on error
      }
    },

    syncJustcallAccounts: async (isLoadingMore: boolean = false) => {
      try {
        console.log("Starting JustCall accounts sync");

        // Get the current lastJustcallMessageIds for pagination and page size
        const messageIdMap = get().lastJustcallMessageIds;
        const loadPageSize = get().loadPageSize;

        console.log(
          `Fetching JustCall messages: ${
            isLoadingMore ? "LOAD MORE operation" : "SYNC operation"
          }`
        );
        if (isLoadingMore) {
          console.log(
            `Using pagination cursor map with ${
              Object.keys(messageIdMap).length
            } accounts`
          );
        } else {
          console.log(
            "Getting most recent messages (no cursor - sync operation)"
          );
        }

        // Get all current emails for merging
        const currentEmails = get().emails;

        // Fetch all JustCall accounts for the user
        const response = await fetch("/api/sync/accounts?platform=justcall");
        if (!response.ok) {
          console.error(
            "Failed to fetch JustCall accounts:",
            await response.text()
          );
          return 0; // Return 0 new messages on error
        }

        const { accounts } = await response.json();
        console.log(`Found ${accounts?.length || 0} JustCall accounts`);

        if (!accounts || accounts.length === 0) {
          return 0; // Return 0 if no accounts
        }

        set((state) => ({ ...state, justcallAccounts: accounts }));

        let totalNewMessages = 0;
        let updatedMessageIdMap = { ...messageIdMap }; // Create a copy to track updates
        let rateLimitHit = false;
        let rateLimitWait = 0;

        // Process each account separately to ensure phone number filtering
        for (const account of accounts) {
          // Make sure we have the accountIdentifier (phone number)
          if (!account.accountIdentifier) {
            console.warn(
              `JustCall account ${account.id} has no accountIdentifier (phone number), skipping`
            );
            continue;
          }

          // Only use lastMessageId for pagination if this is a "Load More" operation
          // Get account-specific cursor for this account
          const accountCursor = isLoadingMore ? messageIdMap[account.id] : null;

          console.log(
            `Syncing JustCall account ${account.id} for phone number: ${account.accountIdentifier}`
          );
          console.log(`Account cursor: ${accountCursor || "none"}`);

          // For JustCall, we need to handle batching since the API has a 100 message limit
          // Calculate how many batches we need
          const batchSize = 100; // JustCall API limit
          const totalDesiredMessages = isLoadingMore ? loadPageSize : 100;
          const batchCount = Math.ceil(totalDesiredMessages / batchSize);

          console.log(
            `Will fetch JustCall messages in ${batchCount} batches of ${batchSize} each to get ${totalDesiredMessages} messages`
          );

          let allMessages: any[] = [];
          let currentBatchCursor = accountCursor;
          let lastBatchProcessedMessage = null;

          // Fetch each batch sequentially
          for (let batch = 0; batch < batchCount; batch++) {
            console.log(
              `Fetching JustCall batch ${
                batch + 1
              }/${batchCount} with cursor: ${currentBatchCursor || "none"}`
            );

            // If we hit a rate limit on the previous batch, enforce a delay
            if (rateLimitHit && rateLimitWait > 0) {
              console.log(
                `🕒 Rate limit hit. Waiting ${rateLimitWait} seconds before next batch...`
              );
              await new Promise((resolve) =>
                setTimeout(resolve, rateLimitWait * 1000)
              );
              rateLimitHit = false;
              console.log(`✅ Resuming after rate limit delay`);
            } else if (batch > 0) {
              // Add a small delay between batches to avoid rate limiting
              console.log(`Adding a small delay between batches (0.5s)...`);
              await new Promise((resolve) => setTimeout(resolve, 500));
            }

            try {
              // Sync messages for this specific account/phone number (one batch)
              const syncResult = await fetch("/api/sync/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  platform: "justcall",
                  pageSize: batchSize, // Always use batchSize (100) for JustCall API
                  phoneNumber: account.accountIdentifier,
                  accountId: account.id,
                  lastSmsIdFetched: currentBatchCursor, // Use the cursor for this batch
                  sortDirection: "desc", // Always use desc for newest messages first
                  isLoadingMore: isLoadingMore, // Indicate whether this is a "Load More" operation
                }),
              });

              // Check for rate limit headers
              const rateLimitWarning = syncResult.headers.get(
                "X-RateLimit-Warning"
              );
              const rateLimitReset = parseInt(
                syncResult.headers.get("X-RateLimit-Reset") || "0"
              );

              if (rateLimitWarning === "true") {
                console.warn(`⚠️ JustCall API rate limit warning received!`);
                if (rateLimitReset > 0) {
                  console.warn(
                    `Recommended to wait ${rateLimitReset} seconds before next request`
                  );
                  rateLimitHit = true;
                  rateLimitWait = rateLimitReset;
                }
              }

              // Even if we get a non-OK response, we continue with the messages we've already gathered
              if (!syncResult.ok) {
                console.error(
                  `Failed to sync JustCall batch ${batch + 1}:`,
                  await syncResult.text()
                );

                // If we have some messages already, we'll process those instead of breaking
                if (allMessages.length > 0) {
                  console.log(
                    `Will continue with ${allMessages.length} messages already fetched`
                  );
                  break; // Stop batching but don't fail the entire operation
                } else {
                  // If this is the first batch and it failed, try to at least get existing messages
                  console.log(
                    `First batch failed, trying to get existing messages...`
                  );
                }
              }

              // After syncing, get messages for this specific phone number
              const messagesResponse = await fetch(
                `/api/messages?platform=justcall&pageSize=${batchSize}&phoneNumber=${encodeURIComponent(
                  account.accountIdentifier
                )}&accountId=${account.id}&lastSmsIdFetched=${
                  currentBatchCursor || ""
                }&sortDirection=desc`
              );

              // Check for rate limit headers again
              const msgRateLimitWarning = messagesResponse.headers.get(
                "X-RateLimit-Warning"
              );
              const msgRateLimitReset = parseInt(
                messagesResponse.headers.get("X-RateLimit-Reset") || "0"
              );

              if (msgRateLimitWarning === "true") {
                console.warn(
                  `⚠️ JustCall API rate limit warning received from messages endpoint!`
                );
                if (msgRateLimitReset > 0) {
                  console.warn(
                    `Recommended to wait ${msgRateLimitReset} seconds before next request`
                  );
                  rateLimitHit = true;
                  rateLimitWait = Math.max(rateLimitWait, msgRateLimitReset);
                }
              }

              // If we get messages, even with a non-OK response, we'll use them
              let batchMessages: any[] = [];

              if (messagesResponse.ok) {
                const { messages } = await messagesResponse.json();
                batchMessages = messages || [];
              } else {
                console.error(
                  `Failed to fetch JustCall messages in batch ${batch + 1}:`,
                  await messagesResponse.text()
                );
                // Continue with next batch, we'll process what we have so far
              }

              const batchMessageCount = batchMessages.length;
              console.log(
                `Retrieved ${batchMessageCount} JustCall messages in batch ${
                  batch + 1
                }`
              );

              if (batchMessageCount > 0) {
                // Save the ID of the last message for pagination
                const lastMessage = batchMessages[batchMessages.length - 1]; // Last is oldest in desc order
                if (lastMessage && lastMessage.id) {
                  // Update the cursor for the next batch
                  lastBatchProcessedMessage = lastMessage.id;
                  currentBatchCursor = lastMessage.id;

                  if (batch === batchCount - 1 && isLoadingMore) {
                    // If this is the last batch and we're loading more, update the final cursor for this account
                    updatedMessageIdMap[account.id] = lastMessage.id;
                    console.log(
                      `Updated cursor for account ${account.id} to: ${lastMessage.id} (final batch)`
                    );
                  }
                }

                // Add messages to our collection
                allMessages = [...allMessages, ...batchMessages];

                // If we have enough messages across all batches or if this batch was less than batchSize
                // (meaning there are no more messages), break the loop
                if (
                  allMessages.length >= totalDesiredMessages ||
                  batchMessageCount < batchSize
                ) {
                  console.log(
                    `Received enough messages (${allMessages.length}) or last batch was smaller than limit`
                  );
                  break;
                }
              } else {
                // No messages in this batch, stop fetching
                console.log(
                  `No JustCall messages in batch ${batch + 1}, stopping`
                );
                break;
              }
            } catch (batchError) {
              console.error(
                `Error in JustCall batch ${batch + 1}:`,
                batchError
              );

              // If we've already fetched some messages, stop batching but continue processing
              if (allMessages.length > 0) {
                console.log(
                  `Will continue with ${allMessages.length} messages already fetched`
                );
                break;
              }

              // If this is the first batch and it completely failed, move to the next account
              if (batch === 0) {
                console.warn(
                  `First batch failed completely, moving to next account`
                );
                continue;
              }
            }
          }

          console.log(
            `Fetched a total of ${allMessages.length} JustCall messages across all batches`
          );

          // Now process all messages from all batches
          if (allMessages.length > 0) {
            // Convert JustCall messages to Email format
            const justcallEmails = allMessages.map((msg: any) => {
              // Format timestamp using the utility function with priority:
              // 1. User date/time (timezone-adjusted)
              // 2. Server date/time
              // 3. Current time as fallback
              let timestamp;

              // First check if we have the user's timezone values (preferred)
              if (msg.sms_user_date && msg.sms_user_time) {
                timestamp = formatJustCallTimestamp(
                  msg.sms_user_date,
                  msg.sms_user_time
                );
              }
              // Then try the server timezone values
              else if (msg.sms_date && msg.sms_time) {
                timestamp = formatJustCallTimestamp(msg.sms_date, msg.sms_time);
              }
              // Use the created_at field if available
              else if (msg.created_at) {
                timestamp = msg.created_at;
              }
              // Fallback to current time
              else {
                timestamp = new Date().toISOString();
              }

              return {
                id: msg.id,
                threadId: msg.threadId, // Use the threadId for grouping
                from: {
                  name:
                    msg.direction === "inbound"
                      ? msg.contact_name || msg.contact_number || "Unknown"
                      : "You",
                  email:
                    msg.direction === "inbound"
                      ? msg.contact_number
                      : msg.number,
                },
                to: [
                  {
                    name:
                      msg.direction === "inbound"
                        ? "You"
                        : msg.contact_name || msg.contact_number || "Unknown",
                    email:
                      msg.direction === "inbound"
                        ? msg.number
                        : msg.contact_number,
                  },
                ],
                subject: "SMS Message",
                // Access body from sms_info object for V2 API
                body: msg.sms_info?.body || msg.body || "",
                // Use the properly formatted timestamp
                date: timestamp,
                labels: ["JUSTCALL"],
                accountType: "justcall" as const,
                accountId: account.id,
                platform: "justcall",
                phoneNumber: account.accountIdentifier, // Store the phone number for reference
                // Add all justcall time fields for debugging
                justcallTimes: {
                  sms_user_time: msg.sms_user_time,
                  sms_time: msg.sms_time,
                  sms_user_date: msg.sms_user_date,
                  sms_date: msg.sms_date,
                  formatted: timestamp,
                },
              };
            });

            console.log(
              `Converted ${justcallEmails.length} JustCall messages to Email format`
            );

            // Check for duplicates by ID
            const existingIds = new Set(currentEmails.map((email) => email.id));
            const newEmails = justcallEmails.filter(
              (email: Email) => !existingIds.has(email.id)
            );

            if (newEmails.length > 0) {
              totalNewMessages += newEmails.length;

              // Merge with existing emails
              const mergedEmails = [...currentEmails, ...newEmails];

              // Sort by date descending (newest first) after merging
              mergedEmails.sort((a, b) => {
                // Safely parse dates and convert to timestamp
                const dateA = a.date ? new Date(a.date).getTime() : 0;
                const dateB = b.date ? new Date(b.date).getTime() : 0;
                return dateB - dateA; // Newest first
              });

              get().setEmails(mergedEmails);
              console.log(
                `Updated email store with ${newEmails.length} JustCall messages for phone ${account.accountIdentifier}. New count: ${mergedEmails.length}`
              );
              setCacheValue("emails", mergedEmails);
            } else {
              console.log(
                `No new JustCall messages for phone ${account.accountIdentifier}`
              );
            }
          }
        }

        // Update the lastJustcallMessageIds map for next pagination only if this was a "Load More" operation
        if (isLoadingMore && Object.keys(updatedMessageIdMap).length > 0) {
          set((state) => ({
            ...state,
            lastJustcallMessageIds: updatedMessageIdMap,
          }));
          setCacheValue("lastJustcallMessageIds", updatedMessageIdMap);
          console.log(
            `Updated JustCall message ID map (Load More operation)`,
            updatedMessageIdMap
          );
        } else if (!isLoadingMore) {
          console.log(`Skipping cursor update during sync operation`);
        }

        // Return the count of new messages found along with rate limit information
        const hasRateLimit = rateLimitHit || rateLimitWait > 0;
        return hasRateLimit
          ? {
              count: totalNewMessages,
              rateLimited: true,
              retryAfter: rateLimitWait,
            }
          : totalNewMessages;
      } catch (error) {
        console.error("Error syncing JustCall accounts:", error);
        return 0; // Return 0 new messages on error
      }
    },

    setTwilioAccounts: (accounts) => {
      set((state) => ({ ...state, twilioAccounts: accounts }));
      setCacheValue("twilioAccounts", accounts);
    },

    setJustcallAccounts: (accounts) => {
      set((state) => ({ ...state, justcallAccounts: accounts }));
      setCacheValue("justcallAccounts", accounts);
    },

    setActiveFilter: (filter) => set({ activeFilter: filter }),

    setEmails: (emails) => {
      // Ensure emails is an array
      if (!Array.isArray(emails)) {
        console.error("setEmails received non-array value:", emails);
        return; // Exit early if not an array
      }

      // Create a map to track unique emails
      const uniqueEmailsMap = new Map<string, Email>();

      // First add existing emails to the map
      const existingEmails = get().emails;
      existingEmails.forEach((email) => {
        const key = generateEmailKey(email);
        uniqueEmailsMap.set(key, email);
      });

      // Then add or update with new emails
      emails.forEach((email) => {
        // Skip invalid emails
        if (!isValidEmail(email)) {
          console.warn("Skipping invalid email:", email.id);
          return;
        }

        // Ensure accountType is set for proper handling
        if (email.accountId && !email.accountType) {
          email.accountType = "imap";
        } else if (!email.accountType) {
          email.accountType = "gmail";
        }

        const key = generateEmailKey(email);

        // Check for and handle API error emails carefully
        const isErrorEmail = email.source === "gmail-api-error";
        const existingEmail = uniqueEmailsMap.get(key);

        // Never let an error email replace a good email
        if (
          isErrorEmail &&
          existingEmail &&
          existingEmail.source !== "gmail-api-error"
        ) {
          console.log(
            `Not replacing valid email with error email: ${email.id}`
          );
          return;
        }

        // If we don't have this email yet, or if the new one is better quality, use it
        if (
          !existingEmail ||
          (isErrorEmail && existingEmail.source === "gmail-api-error") ||
          (!isErrorEmail &&
            new Date(email.date) >= new Date(existingEmail.date))
        ) {
          // When updating, merge to keep the best parts of both
          if (existingEmail) {
            // Merge emails, keeping the better parts
            const mergedEmail = {
              ...existingEmail,
              ...email,
              // Keep existing body content if new email doesn't have it or has error
              body:
                email.body && email.source !== "gmail-api-error"
                  ? email.body
                  : existingEmail.body,
              // Keep existing attachments if new email doesn't have them
              attachments: email.attachments || existingEmail.attachments,
              // Use the newer date unless it's an error
              date: isErrorEmail ? existingEmail.date : email.date,
              // Preserve thread ID for better conversations
              threadId: email.threadId || existingEmail.threadId,
            };
            uniqueEmailsMap.set(key, mergedEmail);
          } else {
            uniqueEmailsMap.set(key, email);
          }
        }
      });

      const uniqueEmails = Array.from(uniqueEmailsMap.values());

      // Debug log
      console.log(
        `Email store update: ${uniqueEmails.length} unique emails (${emails.length} new emails)`
      );

      set({ emails: uniqueEmails });

      // Persist emails to the database if we have valid data
      if (uniqueEmails && uniqueEmails.length > 0) {
        setCacheValue("emails", uniqueEmails);
        setCacheValue("emailsTimestamp", Date.now().toString());
      } else {
        console.warn("Not persisting emails to cache: empty or invalid data");
      }

      // Update contacts from the emails
      const generatedContacts = generateContactsFromEmails(uniqueEmails);
      set({ contacts: generatedContacts });
    },

    addEmail: (email) => {
      // Skip invalid emails
      if (!isValidEmail(email)) {
        console.warn("Skipping invalid email in addEmail:", email.id);
        return;
      }

      // Ensure accountType is set
      if (email.accountId && !email.accountType) {
        email.accountType = "imap";
      } else if (!email.accountType) {
        email.accountType = "gmail";
      }

      const { emails } = get();
      const updatedEmails = [...emails, email];

      // Sort emails by date descending after adding
      updatedEmails.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      set({ emails: updatedEmails });

      // Persist to the database
      setCacheValue("emails", updatedEmails);

      // Update contacts
      const contacts = generateContactsFromEmails(updatedEmails);
      set({ contacts });
    },

    // IMAP account management
    addImapAccount: (account) => {
      const { imapAccounts } = get();
      const updatedAccounts = [...imapAccounts, account];
      set({ imapAccounts: updatedAccounts });

      // Persist IMAP accounts to the database
      setCacheValue("imapAccounts", updatedAccounts);
    },

    removeImapAccount: (id) => {
      const { imapAccounts } = get();
      const updated = imapAccounts.filter((account) => account.id !== id);
      set({ imapAccounts: updated });

      // Persist updated IMAP accounts to the database
      setCacheValue("imapAccounts", updated);
    },

    getImapAccount: (id) => {
      return get().imapAccounts.find((account) => account.id === id);
    },

    setImapAccounts: (accounts) => {
      set({ imapAccounts: accounts });

      // Persist IMAP accounts to the database
      setCacheValue("imapAccounts", accounts);
    },

    syncGroups: async () => {
      try {
        const response = await fetch("/api/groups");
        if (response.ok) {
          const { groups } = await response.json();
          if (groups && Array.isArray(groups)) {
            set((state) => ({ ...state, groups }));

            // Update in the database
            setCacheValue("groups", groups);
            setCacheValue("groupsTimestamp", Date.now().toString());
          }
        } else {
          console.error("Failed to sync groups:", await response.text());
        }
      } catch (error) {
        console.error("Error syncing groups:", error);
      }
    },

    setGroups: (groups) => {
      set((state) => ({ ...state, groups }));

      // Update in the database
      setCacheValue("groups", groups);
      setCacheValue("groupsTimestamp", Date.now().toString());
    },

    addGroup: async (group) => {
      try {
        // Ensure phoneNumbers is defined
        const groupWithPhoneNumbers = {
          ...group,
          phoneNumbers: group.phoneNumbers || [],
        };

        const response = await fetch("/api/groups", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "create",
            group: groupWithPhoneNumbers,
          }),
        });

        if (response.ok) {
          const { groups } = await response.json();
          set((state) => ({ ...state, groups }));

          // Update in the database
          setCacheValue("groups", groups);
          setCacheValue("groupsTimestamp", Date.now().toString());
        } else {
          console.error("Failed to add group:", await response.text());
        }
      } catch (error) {
        console.error("Error adding group:", error);
      }
    },

    updateGroup: async (updatedGroup) => {
      try {
        // Ensure phoneNumbers is defined
        const groupWithPhoneNumbers = {
          ...updatedGroup,
          phoneNumbers: updatedGroup.phoneNumbers || [],
        };

        const response = await fetch("/api/groups", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "update",
            group: groupWithPhoneNumbers,
          }),
        });

        if (response.ok) {
          const { groups } = await response.json();
          set((state) => ({ ...state, groups }));

          // Update in the database
          setCacheValue("groups", groups);
          setCacheValue("groupsTimestamp", Date.now().toString());
        } else {
          console.error("Failed to update group:", await response.text());
        }
      } catch (error) {
        console.error("Error updating group:", error);
      }
    },

    deleteGroup: async (groupId) => {
      try {
        const response = await fetch("/api/groups", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "delete",
            group: { id: groupId },
          }),
        });

        if (response.ok) {
          const { groups } = await response.json();
          set((state) => ({ ...state, groups }));

          // Update in the database
          setCacheValue("groups", groups);
          setCacheValue("groupsTimestamp", Date.now().toString());
        } else {
          console.error("Failed to delete group:", await response.text());
        }
      } catch (error) {
        console.error("Error deleting group:", error);
      }
    },

    // Helper method to update contacts when emails change
    updateContacts: (emails) => {
      const contacts = generateContactsFromEmails(emails);
      set({ contacts });
    },

    syncAllPlatforms: async (gmailToken = null) => {
      console.log("Syncing all messaging platforms...");
      try {
        const store = get();

        // Sync all account types in parallel, including WhatsApp
        const [
          imapCount,
          twilioCount,
          justcallResult,
          bulkvsResult,
          whatsappResult,
        ] = await Promise.all([
          store.syncImapAccounts().catch((err) => {
            console.error("Error syncing IMAP accounts:", err);
            return 0;
          }),
          store.syncTwilioAccounts().catch((err) => {
            console.error("Error syncing Twilio accounts:", err);
            return 0;
          }),
          store.syncJustcallAccounts().catch((err) => {
            console.error("Error syncing JustCall accounts:", err);
            return 0;
          }),
          store.syncBulkvsAccounts().catch((err) => {
            console.error("Error syncing BulkVS accounts:", err);
            return 0;
          }),
          store.syncWhatsappAccounts().catch((err) => {
            console.error("Error syncing WhatsApp accounts:", err);
            return 0;
          }),
        ]);

        console.log(
          `Synced: ${imapCount} IMAP, ${twilioCount} Twilio, ${
            typeof justcallResult === "number"
              ? justcallResult
              : justcallResult?.count || 0
          } JustCall, ${
            typeof bulkvsResult === "number"
              ? bulkvsResult
              : bulkvsResult?.count || 0
          } BulkVS, ${
            typeof whatsappResult === "number"
              ? whatsappResult
              : whatsappResult?.count || 0
          } WhatsApp messages`
        );

        // Sync Gmail emails if token is provided
        if (gmailToken) {
          await store.syncEmails(gmailToken);
        }

        // Sync groups
        await store.syncGroups();
      } catch (error) {
        console.error("Error syncing all platforms:", error);
      }
    },

    deleteConversation: (contactEmail: string) => {
      const { emails } = get();

      // Filter out all emails where this contact is either a sender or recipient
      const filteredEmails = emails.filter((email) => {
        // Check if the contact is the sender
        const isFromContact = email.from.email === contactEmail;

        // Check if the contact is one of the recipients
        const isToContact = email.to.some((to) => to.email === contactEmail);

        // Keep emails that are NOT from or to this contact
        return !isFromContact && !isToContact;
      });

      // Update the store with filtered emails
      set({ emails: filteredEmails });

      // Update the contact list based on remaining emails
      const updatedContacts = generateContactsFromEmails(filteredEmails);
      set({ contacts: updatedContacts });

      // Persist to the cache
      setCacheValue("emails", filteredEmails);
      setCacheValue("emailsTimestamp", Date.now().toString());

      console.log(
        `Deleted conversation with ${contactEmail}. Remaining emails: ${filteredEmails.length}`
      );

      return filteredEmails.length;
    },

    setLoadPageSize: (size: number) => {
      set((state) => ({ ...state, loadPageSize: size }));
      if (typeof window !== "undefined") {
        localStorage.setItem("loadPageSize", size.toString());
      }
    },

    setBulkvsAccounts: (accounts: any[]) => {
      set({ bulkvsAccounts: accounts });
    },

    setWhatsappAccounts: (accounts: any[]) => {
      set((state) => ({ ...state, whatsappAccounts: accounts }));
    },

    syncWhatsappAccounts: async (isLoadingMore = false) => {
      console.log(
        `Starting WhatsApp accounts sync (isLoadingMore: ${isLoadingMore})`
      );
      const store = get();

      try {
        // Ensure we have WhatsApp accounts in store, otherwise fetch from server
        let accounts = store.whatsappAccounts;
        if (!accounts || accounts.length === 0) {
          try {
            const res = await fetch("/api/whatsapp/account");
            if (res.ok) {
              const fetchedAccounts = await res.json();
              if (
                Array.isArray(fetchedAccounts) &&
                fetchedAccounts.length > 0
              ) {
                store.setWhatsappAccounts(fetchedAccounts);
                accounts = fetchedAccounts;
                console.log(`Fetched ${accounts.length} WhatsApp accounts`);
              } else {
                console.log("No WhatsApp accounts found");
                return 0;
              }
            } else {
              console.error(
                "Failed to fetch WhatsApp accounts:",
                await res.text()
              );
              return 0;
            }
          } catch (error) {
            console.error("Error fetching WhatsApp accounts:", error);
            return 0;
          }
        }

        if (!accounts || accounts.length === 0) {
          console.log("No WhatsApp accounts to sync");
          return 0;
        }

        console.log(`Syncing ${accounts.length} WhatsApp accounts`);
        let totalMessages = 0;
        let rateLimited = false;
        let retryAfter = 0;

        // Track last message IDs per chat for pagination
        // Start with empty map or retrieve from local storage
        let lastMessageIdMap: Record<string, Record<string, string>> = {};
        try {
          const storedMap = await getCacheValue("whatsappLastMessageIds");
          if (storedMap) {
            lastMessageIdMap = storedMap;
          }
        } catch (error) {
          console.error("Error loading WhatsApp pagination state:", error);
          // Continue with empty map if can't load
        }

        // Process each account
        for (const account of accounts) {
          try {
            const accountId = account.id;
            console.log(`Processing WhatsApp account ${accountId}`);

            // Ensure this account has an entry in our mapping
            if (!lastMessageIdMap[accountId]) {
              lastMessageIdMap[accountId] = {};
            }

            // Fetch chats for this account
            const chatsRes = await fetch(
              `/api/whatsapp/chats?accountId=${accountId}`
            );
            if (!chatsRes.ok) {
              console.error(
                `Failed to fetch chats for WhatsApp account ${accountId}:`,
                await chatsRes.text()
              );
              continue;
            }

            console.log(chatsRes);

            const { chats } = await chatsRes.json();
            if (!chats || !Array.isArray(chats) || chats.length === 0) {
              console.log(`No chats found for WhatsApp account ${accountId}`);
              continue;
            }

            console.log(
              `Found ${chats.length} chats for WhatsApp account ${accountId}`
            );

            // Process each chat
            for (const chat of chats) {
              const chatId = chat.id;
              if (!chatId) {
                console.warn(
                  `Skipping chat with no ID in account ${accountId}`
                );
                continue;
              }

              // Configure pagination based on isLoadingMore mode
              const paginationParams: Record<string, string> = {};

              if (isLoadingMore) {
                // When loading more, use stored last message ID as the cursor
                const lastMessageId = lastMessageIdMap[accountId][chatId];
                if (lastMessageId) {
                  paginationParams.beforeId = lastMessageId;
                }
              }

              // Set page size
              paginationParams.limit = store.loadPageSize.toString();

              // Set sort direction (newer messages first)
              paginationParams.sortDirection = "desc";

              // Build query string
              const queryString = new URLSearchParams({
                accountId,
                ...paginationParams,
              }).toString();

              // Fetch messages with pagination
              console.log(
                `Fetching messages for chat ${chatId} with params:`,
                paginationParams
              );
              const msgsRes = await fetch(
                `/api/whatsapp/chats/${chatId}/messages?${queryString}`
              );

              if (!msgsRes.ok) {
                console.error(
                  `Failed to fetch messages for chat ${chatId}:`,
                  await msgsRes.text()
                );
                continue;
              }

              const { messages } = await msgsRes.json();

              if (
                !messages ||
                !Array.isArray(messages) ||
                messages.length === 0
              ) {
                console.log(`No messages found for chat ${chatId}`);
                continue;
              }

              console.log(
                `Retrieved ${messages.length} messages for chat ${chatId}`
              );

              // Store the last (oldest) message ID for pagination in this chat
              if (messages.length > 0 && isLoadingMore) {
                // In desc order, last element is the oldest message
                const oldestMessage = messages[messages.length - 1];
                if (oldestMessage && oldestMessage.id) {
                  lastMessageIdMap[accountId][chatId] = oldestMessage.id;
                  console.log(
                    `Updated last message ID for chat ${chatId} to ${oldestMessage.id}`
                  );
                }
              }

              // Format messages as Email objects
              if (messages && messages.length > 0) {
                const formatted = messages.map((msg: any) => ({
                  id: msg.id,
                  threadId: msg.chat_id || chatId,
                  from: {
                    name: msg.from || msg.sender || chat.title || chatId,
                    email: msg.from || msg.sender || chatId,
                  },
                  to: [
                    {
                      name: msg.to || msg.recipient || chat.title || chatId,
                      email: msg.to || msg.recipient || chatId,
                    },
                  ],
                  subject: chat.title || `WhatsApp chat ${chatId}`,
                  body: msg.text || msg.body || "",
                  date: msg.timestamp
                    ? new Date(msg.timestamp).toISOString()
                    : new Date().toISOString(),
                  labels: ["whatsapp", "sms"],
                  read: true,
                  accountId,
                  accountType: "whatsapp" as const,
                  platform: "whatsapp",
                }));

                // Check for duplicates by ID
                const currentEmails = get().emails;
                const existingIds = new Set(
                  currentEmails.map((email) => email.id)
                );
                const newEmails = formatted.filter(
                  (email: any) => !existingIds.has(email.id)
                );

                if (newEmails.length > 0) {
                  // Add new emails to store
                  const mergedEmails = [...currentEmails, ...newEmails];

                  // Sort by date descending (newest first) after merging
                  mergedEmails.sort((a, b) => {
                    // Safely parse dates and convert to timestamp
                    const dateA = a.date ? new Date(a.date).getTime() : 0;
                    const dateB = b.date ? new Date(b.date).getTime() : 0;
                    return dateB - dateA; // Newest first
                  });

                  get().setEmails(mergedEmails);
                  console.log(
                    `Updated email store with ${newEmails.length} new WhatsApp messages`
                  );
                  setCacheValue("emails", mergedEmails);

                  totalMessages += newEmails.length;
                } else {
                  console.log(`No new messages found for chat ${chatId}`);
                }
              }
            }

            // Update last sync time if not in load more mode
            if (!isLoadingMore) {
              try {
                // Update sync account in database
                await fetch(`/api/sync/update-last-sync`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    accountId,
                    platform: "whatsapp",
                  }),
                });
              } catch (syncError) {
                console.error(
                  `Error updating last sync time for account ${accountId}:`,
                  syncError
                );
              }
            }
          } catch (error) {
            console.error(
              `Error syncing WhatsApp account ${account.id}:`,
              error
            );
          }
        }

        // Save the last message ID map for future pagination
        setCacheValue("whatsappLastMessageIds", lastMessageIdMap);

        // Return the count of new messages found along with rate limit information if applicable
        return rateLimited
          ? { count: totalMessages, rateLimited, retryAfter }
          : totalMessages;
      } catch (error) {
        console.error("Error in syncWhatsappAccounts:", error);
        return 0;
      }
    },

    syncBulkvsAccounts: async (isLoadingMore = false) => {
      try {
        const store = get();
        const accounts = store.bulkvsAccounts;

        if (!accounts || accounts.length === 0) {
          console.log("No BulkVS accounts to sync");
          return 0;
        }

        console.log(`Starting BulkVS sync for ${accounts.length} accounts`);
        let totalMessages = 0;
        let rateLimited = false;
        let retryAfter = 0;

        for (const account of accounts) {
          try {
            // Prepare pagination parameters if loading more
            const accountId = account.id;
            const lastMessageId = isLoadingMore
              ? store.lastBulkvsMessageIds[accountId]
              : undefined;

            console.log(
              `Syncing BulkVS account ${accountId}${
                lastMessageId ? ` with pagination from ${lastMessageId}` : ""
              }`
            );

            const response = await fetch("/api/bulkvs/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                accountId,
                pageSize: store.loadPageSize,
                lastSmsIdFetched: lastMessageId,
                sortDirection: "desc",
              }),
            });

            if (!response.ok) {
              const error = await response.text();
              console.error(
                `Failed to sync BulkVS account ${accountId}:`,
                error
              );
              continue;
            }

            const result = await response.json();

            // Update rate limit status
            if (result.rateLimited) {
              rateLimited = true;
              retryAfter = Math.max(retryAfter, result.retryAfter || 60);
            }

            // If messages were fetched, store the oldest message ID for pagination
            if (result.messages && result.messages.length > 0) {
              const messages = result.messages;
              totalMessages += messages.length;

              // Store the ID of the oldest message for pagination
              const oldestMessage = messages[messages.length - 1];
              if (oldestMessage?.id) {
                set((state) => ({
                  lastBulkvsMessageIds: {
                    ...state.lastBulkvsMessageIds,
                    [accountId]: oldestMessage.id,
                  },
                }));
              }

              // Format messages for the email store
              const formattedEmails = messages.map((message: any) => {
                // Determine the thread identifier
                const contactNumber = message.contact_number || "";

                return {
                  id: message.id,
                  threadId: message.threadId || `bulkvs-${contactNumber}`,
                  from: {
                    name: contactNumber,
                    email: contactNumber,
                  },
                  to: [
                    {
                      name:
                        message.number || account.accountIdentifier || "BulkVS",
                      email:
                        message.number ||
                        account.accountIdentifier ||
                        "bulkvs@example.com",
                    },
                  ],
                  subject: `SMS from ${contactNumber}`,
                  body: message.body || message.message || "",
                  date: message.created_at,
                  labels: ["sms"],
                  read: true,
                  accountId: account.id,
                  accountType: "bulkvs",
                  phoneNumber: contactNumber,
                };
              });

              // Add formatted emails to the store
              if (formattedEmails.length > 0) {
                for (const email of formattedEmails) {
                  get().addEmail(email);
                }
              }
            }
          } catch (error) {
            console.error(`Error syncing BulkVS account:`, error);
          }
        }

        // Return rate limit info if rate limited, otherwise just the count
        if (rateLimited) {
          return {
            count: totalMessages,
            rateLimited,
            retryAfter,
          };
        }

        return totalMessages;
      } catch (error) {
        console.error("Error in syncBulkvsAccounts:", error);
        return 0;
      }
    },
  };
});

// Load persisted data on the client side only
if (typeof window !== "undefined") {
  // Initial load from database cache
  (async () => {
    const persistedData = await loadPersistedData();
    useEmailStore.setState(persistedData);

    // Then sync with server data
    setTimeout(async () => {
      const store = useEmailStore.getState();
      await store.syncGroups();
      await store.syncImapAccounts();
      await store.syncTwilioAccounts();
      await store.syncJustcallAccounts();
      await store.syncBulkvsAccounts();
      await store.syncWhatsappAccounts();
    }, 1000);

    // Set up periodic sync
    setInterval(async () => {
      const store = useEmailStore.getState();
      await store.syncGroups();
      await store.syncImapAccounts();
      await store.syncTwilioAccounts();
      await store.syncJustcallAccounts();
      await store.syncBulkvsAccounts();
      await store.syncWhatsappAccounts();
    }, 5 * 60 * 1000); // Sync every 5 minutes
  })().catch((error) => {
    console.error("Error loading initial data:", error);
  });
}
