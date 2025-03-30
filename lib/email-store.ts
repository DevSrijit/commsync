"use client";

import { create } from "zustand";
import type { Email, Contact, Group } from "@/lib/types";
import { MessageCategory } from "@/components/sidebar";
import { ImapAccount } from "@/lib/imap-service";
import { SyncService } from "./sync-service";
import { getCacheValue, getMultipleCacheValues, setCacheValue, removeCacheValue } from './client-cache-browser';
import { formatJustCallTimestamp, RateLimitInfo } from "./justcall-service";

// Define sync status interface
interface SyncStatus {
  isActive: boolean;
  message: string;
  progress: number;
  total: number;
}

interface EmailStore {
  emails: Email[];
  contacts: Contact[];
  activeFilter: MessageCategory;
  activeGroup: string | null;
  imapAccounts: ImapAccount[];
  twilioAccounts: any[];
  justcallAccounts: any[];
  groups: Group[];
  currentImapPage: number;
  currentTwilioPage: number;
  lastJustcallMessageId: string | null;
  loadPageSize: number;
  syncStatus: SyncStatus;
  justcallRateLimitInfo: RateLimitInfo;
  setEmails: (emails: Email[]) => void;
  setActiveFilter: (filter: MessageCategory) => void;
  addEmail: (email: Email) => void;
  addImapAccount: (account: ImapAccount) => void;
  removeImapAccount: (id: string) => void;
  getImapAccount: (id: string) => ImapAccount | undefined;
  syncEmails: (gmailToken: string | null) => Promise<void>;
  syncImapAccounts: () => Promise<number>;
  syncTwilioAccounts: () => Promise<number>;
  syncJustcallAccounts: (isLoadingMore?: boolean) => Promise<number>;
  syncAllPlatforms: (gmailToken?: string | null) => Promise<void>;
  setImapAccounts: (accounts: ImapAccount[]) => void;
  setTwilioAccounts: (accounts: any[]) => void;
  setJustcallAccounts: (accounts: any[]) => void;
  setLoadPageSize: (size: number) => void;
  addGroup: (group: Group) => void;
  updateGroup: (group: Group) => void;
  deleteGroup: (groupId: string) => void;
  syncGroups: () => Promise<void>;
  setGroups: (groups: Group[]) => void;
  updateContacts: (emails: Email[]) => void;
  deleteConversation: (contactEmail: string) => void;
  updateSyncStatus: (status: Partial<SyncStatus>) => void;
  updateJustcallRateLimitInfo: (info: Partial<RateLimitInfo>) => void;
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
      groups: [],
      lastJustcallMessageId: null
    };
  }

  try {
    // Use the browser cache client to get multiple values at once
    const cacheData = await getMultipleCacheValues([
      "emails", 
      "imapAccounts", 
      "twilioAccounts", 
      "justcallAccounts", 
      "groups",
      "lastJustcallMessageId"
    ]);

    return {
      emails: cacheData.emails || [],
      imapAccounts: cacheData.imapAccounts || [],
      twilioAccounts: cacheData.twilioAccounts || [],
      justcallAccounts: cacheData.justcallAccounts || [],
      groups: cacheData.groups || [],
      lastJustcallMessageId: cacheData.lastJustcallMessageId || null,
    };
  } catch (e) {
    console.error("Failed to load persisted data:", e);
    return { emails: [], imapAccounts: [], twilioAccounts: [], justcallAccounts: [], groups: [], lastJustcallMessageId: null };
  }
};

// Improved email key generation function
const generateEmailKey = (email: Email): string => {
  // For JustCall messages, we need to use the threadId specifically
  if (email.accountType === 'justcall' && email.threadId) {
    // Generate a key that includes the direction to prevent mixing outbound to different contacts
    const direction = email.from.email === 'You' ? 'outbound' : 'inbound';
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
  const isSMS = email.accountType === 'twilio' || 
                email.accountType === 'justcall' || 
                (email.labels && email.labels.includes('SMS'));
  
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
    if ((!email.body || email.body.trim() === "") && email.source !== "gmail-api-error") {
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
    const isSMS = email.accountType === 'twilio' || 
                  email.accountType === 'justcall' || 
                  (email.labels && email.labels.includes('SMS'));
    
    // Safely parse the email date to a Date object
    const emailDate = email.date ? new Date(email.date) : new Date();
    
    // Add sender as contact (if not the current user)
    if (!email.from.email.includes("me")) {
      // For JustCall outbound messages, use recipient's email (contact_number) as the key
      if (email.accountType === 'justcall' && 
          (email.from.email === 'You' || email.from.name === 'You') && 
          email.to && email.to.length > 0) {
        // Use the first recipient's email as the contact key
        const contactKey = email.to[0].email.toLowerCase();
        const existingContact = contactsMap.get(contactKey);

        if (
          !existingContact ||
          new Date(existingContact.lastMessageDate) < emailDate
        ) {
          contactsMap.set(contactKey, {
            name: email.to[0].name || (isSMS ? `Phone: ${email.to[0].email}` : email.to[0].email),
            email: email.to[0].email, // Important: Use recipient's number as the contact email
            lastMessageDate: email.date,
            lastMessageSubject: isSMS ? 'SMS Message' : email.subject,
            labels: isSMS ? ['SMS', ...(email.labels || [])] : email.labels,
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
            name: email.from.name || (isSMS ? `Phone: ${email.from.email}` : email.from.email),
            email: email.from.email,
            lastMessageDate: email.date,
            lastMessageSubject: isSMS ? 'SMS Message' : email.subject,
            labels: isSMS ? ['SMS', ...(email.labels || [])] : email.labels,
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
        if (email.accountType === 'justcall' && 
            (recipient.email.includes("me") || recipient.name === 'You')) {
          return;
        }
        
        // For non-justcall messages, skip 'me'
        if (email.accountType !== 'justcall' && recipient.email.includes("me")) {
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
            name: recipient.name || (isSMS ? `Phone: ${recipient.email}` : recipient.email),
            email: recipient.email,
            lastMessageDate: email.date,
            lastMessageSubject: isSMS ? 'SMS Message' : email.subject,
            labels: isSMS ? ['SMS', ...(email.labels || [])] : email.labels,
            accountId: email.accountId,
            accountType: email.accountType,
          });
        }
      });
    }
  });

  // Sort contacts by most recent message
  return Array.from(contactsMap.values()).sort(
    (a, b) => {
      const dateA = a.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0;
      const dateB = b.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0;
      return dateB - dateA; // Newest first
    }
  );
};

// Default values for rate limit info
const defaultRateLimitInfo: RateLimitInfo = {
  isRateLimited: false,
  remaining: 1000,
  limit: 1000,
  resetTimestamp: 0,
  retryAfterSeconds: 0
};

export const useEmailStore = create<EmailStore>((set, get) => {
  // Initialize with empty data, we'll load asynchronously
  const initialData = { 
    emails: [], 
    imapAccounts: [], 
    twilioAccounts: [], 
    justcallAccounts: [], 
    groups: [],
    lastJustcallMessageId: null
  };

  // Load saved page size from localStorage if available
  const savedPageSize = typeof window !== "undefined" 
    ? parseInt(localStorage.getItem('loadPageSize') || '100') 
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
          groups: persistedData.groups,
          lastJustcallMessageId: persistedData.lastJustcallMessageId
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
    groups: initialData.groups,
    currentImapPage: 1,
    currentTwilioPage: 1,
    lastJustcallMessageId: initialData.lastJustcallMessageId,
    loadPageSize: savedPageSize,
    // New default state values for syncStatus and rateLimitInfo
    syncStatus: {
      isActive: false,
      message: "",
      progress: 0,
      total: 0
    },
    justcallRateLimitInfo: defaultRateLimitInfo,

    syncEmails: async (gmailToken: string | null) => {
      const { imapAccounts, loadPageSize } = get();
      try {
        if (!gmailToken) {
          console.log("No Gmail token provided, skipping Gmail sync");
        } else {
          try {
            // Use the configured page size
            console.log(`Using configured page size: ${loadPageSize}`);
            await SyncService.getInstance().syncAllEmails(gmailToken, imapAccounts, 1, loadPageSize);
          } catch (apiError: any) {
            // Handle auth errors
            console.error("Error syncing emails:", apiError);
            if (apiError?.response?.status === 401 || 
                (apiError?.error?.code === 401) ||
                (apiError?.message && apiError.message.includes('Invalid Credentials'))) {
              
              // Try to refresh the token
              try {
                console.log("Attempting to refresh Google token...");
                const response = await fetch(`/api/auth/refresh?provider=google`, {
                  method: 'POST',
                  credentials: 'same-origin',
                });
                
                if (response.ok) {
                  // Token refresh successful, get the new token
                  const refreshData = await response.json();
                  if (refreshData.accessToken) {
                    console.log("Token refreshed successfully, retrying API call");
                    // Retry the API call with the new token and configured page size
                    await SyncService.getInstance().syncAllEmails(refreshData.accessToken, imapAccounts, 1, loadPageSize);
                    return; // Success, exit function
                  }
                } else {
                  console.error('Failed to refresh Google token:', await response.text());
                  // Only redirect if we're in browser context
                  if (typeof window !== 'undefined') {
                    window.location.href = `/login?error=token_expired&provider=google`;
                  }
                }
              } catch (refreshError) {
                console.error('Error refreshing Google token:', refreshError);
                // Only redirect if we're in browser context
                if (typeof window !== 'undefined') {
                  window.location.href = `/login?error=token_expired&provider=google`;
                }
              }
            }
          }
        }
      } catch (error: any) {
        console.error("Unhandled error in syncEmails:", error);
      }
    },

    syncImapAccounts: async () => {
      try {
        console.log("Starting IMAP accounts sync");
        // Get current page and page size
        const currentPage = get().currentImapPage;
        const loadPageSize = get().loadPageSize;
        console.log(`Fetching IMAP accounts, page ${currentPage}, pageSize ${loadPageSize}`);
        
        // For loading older messages, we need to track the oldest message date
        // Get all current emails to find the oldest date
        const currentEmails = get().emails;
        const imapEmails = currentEmails.filter(email => email.accountType === 'imap');
        
        // Find the oldest IMAP message date if we have any
        let oldestDate: Date | undefined = undefined;
        if (imapEmails.length > 0) {
          const dates = imapEmails.map((email: Email) => new Date(email.date));
          oldestDate = new Date(Math.min(...dates.map(d => d.getTime())));
          console.log(`Oldest IMAP message date: ${oldestDate.toISOString()}`);
        }
        
        // Fetch all IMAP accounts for the user
        const response = await fetch("/api/sync/accounts?platform=imap");
        if (!response.ok) {
          console.error("Failed to fetch IMAP accounts:", await response.text());
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
                filter: filter
              },
            }),
          });
          
          if (fetchResult.ok) {
            const { emails: messages, total } = await fetchResult.json();
            console.log(`Retrieved ${messages?.length || 0} older IMAP messages for account ${account.id} on page ${currentPage}`);
            
            if (messages && messages.length > 0) {
              console.log(`Processing ${messages.length} IMAP messages`);
              
              // When loading older messages, we shouldn't have duplicates by ID
              // But check anyway for safety
              const existingIds = new Set(currentEmails.map(email => email.id));
              const newEmails = messages.filter((email: Email) => !existingIds.has(email.id));
              
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
                console.log(`Updated email store with ${newEmails.length} older IMAP messages. New count: ${mergedEmails.length}`);
                setCacheValue("emails", mergedEmails);
              } else {
                console.log(`No new IMAP messages for account ${account.id} on page ${currentPage}`);
              }
            } else {
              console.log(`No IMAP messages for account ${account.id} on page ${currentPage}`);
            }
          } else {
            console.error(`Failed to fetch IMAP messages for account ${account.id}:`, await fetchResult.text());
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
            console.error(`Error updating last sync time for IMAP account ${account.id}:`, error);
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
        console.log(`Fetching Twilio accounts, page ${currentPage}, pageSize ${loadPageSize}`);
        
        // For loading older messages, we need to track the oldest message date
        // Get all current emails to find the oldest date
        const currentEmails = get().emails;
        const twilioEmails = currentEmails.filter(email => email.accountType === 'twilio');
        
        // Find the oldest twilio message date if we have any
        let oldestDate: Date | undefined = undefined;
        if (twilioEmails.length > 0) {
          const dates = twilioEmails.map((email: Email) => new Date(email.date));
          oldestDate = new Date(Math.min(...dates.map(d => d.getTime())));
          console.log(`Oldest Twilio message date: ${oldestDate.toISOString()}`);
        }
        
        // Fetch all Twilio accounts for the user
        const response = await fetch("/api/sync/accounts?platform=twilio");
        if (!response.ok) {
          console.error("Failed to fetch Twilio accounts:", await response.text());
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
            sortDirection: 'asc' // Important: Load older messages, not newer
          }),
        });
        
        if (syncResult.ok) {
          // After syncing, get all the messages to update the store
          console.log(`Current email count before Twilio sync: ${currentEmails.length}`);
          const messagesResponse = await fetch(`/api/messages?platform=twilio&page=${currentPage}&pageSize=${loadPageSize}&sortDirection=asc&oldestDate=${oldestDate ? encodeURIComponent(oldestDate.toISOString()) : ''}`);
          if (messagesResponse.ok) {
            const { messages } = await messagesResponse.json();
            console.log(`Retrieved ${messages?.length || 0} older Twilio messages for page ${currentPage}`);
            if (messages && messages.length > 0) {
              // Convert Twilio messages to Email format
              const twilioEmails = messages.map((msg: any) => ({
                id: msg.id || msg.sid,
                from: {
                  name: msg.from || 'Unknown',
                  email: msg.from || msg.contact_number || '',
                },
                to: [{
                  name: msg.to || 'You',
                  email: msg.to || msg.number || '',
                }],
                subject: 'SMS Message',
                body: msg.body || '',
                date: msg.created_at || msg.date_created || new Date().toISOString(),
                labels: ['TWILIO'],
                accountType: 'twilio',
                accountId: msg.accountId,
                platform: 'twilio',
              }));
              
              console.log(`Converted ${twilioEmails.length} Twilio messages to Email format`);
              
              // When loading older messages, we shouldn't have duplicates by ID
              // But check anyway for safety
              const existingIds = new Set(currentEmails.map(email => email.id));
              const newEmails = twilioEmails.filter((email: Email) => !existingIds.has(email.id));
              
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
                console.log(`Updated email store with ${newEmails.length} older Twilio messages. New count: ${mergedEmails.length}`);
                setCacheValue("emails", mergedEmails);
              } else {
                console.log(`No new Twilio messages on page ${currentPage}, not incrementing page counter`);
              }
            } else {
              console.log(`No Twilio messages for page ${currentPage}`);
            }
          } else {
            console.error("Failed to fetch Twilio messages:", await messagesResponse.text());
          }
        } else {
          console.error("Failed to sync Twilio messages:", await syncResult.text());
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
        // Start sync and update UI
        set(state => ({ 
          ...state, 
          syncStatus: {
            isActive: true,
            message: `${isLoadingMore ? 'Loading more' : 'Syncing'} JustCall messages...`,
            progress: 0,
            total: 0
          }
        }));

        console.log("Starting JustCall accounts sync");
        
        // Get the current lastJustcallMessageId for pagination and page size
        const lastMessageId = get().lastJustcallMessageId;
        const loadPageSize = get().loadPageSize;
        
        // Only use lastMessageId for pagination if this is a "Load More" operation
        const paginationCursor = isLoadingMore ? lastMessageId : null;
        
        console.log(`Fetching JustCall messages: ${isLoadingMore ? 'LOAD MORE operation' : 'SYNC operation'}`);
        if (isLoadingMore) {
          console.log(`Using pagination cursor: ${paginationCursor || 'none'}, pageSize: ${loadPageSize}`);
        } else {
          console.log('Getting most recent messages (no cursor - sync operation)');
        }

        // Get all current emails for merging
        const currentEmails = get().emails;
        
        // Fetch all JustCall accounts for the user
        const response = await fetch("/api/sync/accounts?platform=justcall");
        if (!response.ok) {
          console.error("Failed to fetch JustCall accounts:", await response.text());
          set(state => ({ 
            ...state, 
            syncStatus: {
              ...state.syncStatus,
              isActive: false,
              message: "Failed to fetch JustCall accounts"
            }
          }));
          return 0; // Return 0 new messages on error
        }
        
        const { accounts } = await response.json();
        console.log(`Found ${accounts?.length || 0} JustCall accounts`);
        
        if (!accounts || accounts.length === 0) {
          set(state => ({ 
            ...state, 
            syncStatus: {
              ...state.syncStatus,
              isActive: false,
              message: "No JustCall accounts found"
            }
          }));
          return 0; // Return 0 if no accounts
        }
        
        set((state) => ({ ...state, justcallAccounts: accounts }));
        
        let totalNewMessages = 0;
        let lastProcessedMessageId = lastMessageId;
        let allEmails: Email[] = [];
        
        // Check if we're currently rate limited
        const { justcallRateLimitInfo } = get();
        if (justcallRateLimitInfo.isRateLimited) {
          const now = Date.now();
          if (now < justcallRateLimitInfo.resetTimestamp) {
            const waitTimeSeconds = Math.ceil((justcallRateLimitInfo.resetTimestamp - now) / 1000);
            console.log(`JustCall API rate limited. Waiting for ${waitTimeSeconds}s before retrying`);
            
            set(state => ({ 
              ...state, 
              syncStatus: {
                ...state.syncStatus,
                isActive: false,
                message: `Rate limit reached. Try again in ${waitTimeSeconds}s`
              }
            }));

            // If we're still rate limited, return early
            return 0;
          } else {
            // Reset rate limit info since the waiting period has passed
            set(state => ({ 
              ...state, 
              justcallRateLimitInfo: defaultRateLimitInfo 
            }));
          }
        }
        
        // Update sync UI with account count
        set(state => ({ 
          ...state, 
          syncStatus: {
            ...state.syncStatus,
            total: accounts.length
          }
        }));
        
        // Process each account separately to ensure phone number filtering
        for (let accountIndex = 0; accountIndex < accounts.length; accountIndex++) {
          const account = accounts[accountIndex];
          
          // Update progress in sync status
          set(state => ({ 
            ...state, 
            syncStatus: {
              ...state.syncStatus,
              progress: accountIndex,
              message: `Syncing JustCall account ${accountIndex + 1}/${accounts.length}`
            }
          }));
          
          // Make sure we have the accountIdentifier (phone number)
          if (!account.accountIdentifier) {
            console.warn(`JustCall account ${account.id} has no accountIdentifier (phone number), skipping`);
            continue;
          }
          
          console.log(`Syncing JustCall account ${account.id} for phone number: ${account.accountIdentifier}`);
          
          // For JustCall, we need to handle batching since the API has a 100 message limit
          // Calculate how many batches we need
          const batchSize = 100; // JustCall API limit
          const totalDesiredMessages = isLoadingMore ? loadPageSize : 100;
          const batchCount = Math.ceil(totalDesiredMessages / batchSize);
          
          console.log(`Will fetch JustCall messages in ${batchCount} batches of ${batchSize} each to get ${totalDesiredMessages} messages`);
          
          let allMessages: any[] = [];
          let currentBatchCursor = paginationCursor;
          let lastBatchProcessedMessage = null;
          let isRateLimited = false;
          
          // Fetch each batch sequentially
          for (let batch = 0; batch < batchCount; batch++) {
            // Check if we're still rate limited
            const { justcallRateLimitInfo } = get();
            if (justcallRateLimitInfo.isRateLimited) {
              console.log(`Stopping JustCall sync due to rate limit. Will retry after ${justcallRateLimitInfo.retryAfterSeconds}s`);
              isRateLimited = true;
              break;
            }
            
            console.log(`Fetching JustCall batch ${batch + 1}/${batchCount} with cursor: ${currentBatchCursor || 'none'}`);
            
            // Update sync status for batch progress
            set(state => ({ 
              ...state, 
              syncStatus: {
                ...state.syncStatus,
                message: `Syncing JustCall account ${accountIndex + 1}/${accounts.length} (batch ${batch + 1}/${batchCount})`
              }
            }));
            
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
                sortDirection: 'desc', // Always use desc for newest messages first
                isLoadingMore: isLoadingMore // Indicate whether this is a "Load More" operation
              }),
            });
            
            if (!syncResult.ok) {
              const errorText = await syncResult.text();
              console.error(`Failed to sync JustCall batch ${batch + 1}:`, errorText);
              
              // Check for rate limit error
              if (syncResult.status === 429) {
                console.warn("JustCall API rate limit reached");
                
                // Try to extract rate limit headers from the response if possible
                const retryAfter = syncResult.headers.get('Retry-After');
                const resetTime = syncResult.headers.get('X-Rate-Limit-Reset');
                const waitTimeSeconds = parseInt(retryAfter || '60', 10);
                
                // Set rate limit info in store
                set(state => ({ 
                  ...state, 
                  justcallRateLimitInfo: {
                    isRateLimited: true,
                    remaining: 0,
                    limit: 1000,
                    resetTimestamp: resetTime ? new Date(resetTime).getTime() : Date.now() + (waitTimeSeconds * 1000),
                    retryAfterSeconds: waitTimeSeconds
                  }
                }));
                
                isRateLimited = true;
                break; // Stop batching on rate limit
              }
              
              // Other errors, skip this batch but continue with others
              continue;
            }
            
            // Get the actual messages using the plain messages endpoint
            const messagesResponse = await fetch(`/api/messages?platform=justcall&pageSize=${batchSize}&phoneNumber=${encodeURIComponent(account.accountIdentifier)}&accountId=${account.id}&lastSmsIdFetched=${currentBatchCursor || ''}&sortDirection=desc`);
            
            // Check if we got rate limited on the messages endpoint
            if (messagesResponse.status === 429) {
              console.warn("JustCall API rate limit reached");
              
              // Extract rate limit info from headers
              const retryAfter = messagesResponse.headers.get('Retry-After');
              const resetTime = messagesResponse.headers.get('X-Rate-Limit-Reset');
              const waitTimeSeconds = parseInt(retryAfter || '60', 10);
              
              // Set rate limit info in store
              set(state => ({ 
                ...state, 
                justcallRateLimitInfo: {
                  isRateLimited: true,
                  remaining: 0,
                  limit: 1000,
                  resetTimestamp: resetTime ? new Date(resetTime).getTime() : Date.now() + (waitTimeSeconds * 1000),
                  retryAfterSeconds: waitTimeSeconds
                }
              }));
              
              isRateLimited = true;
              break; // Stop batching on rate limit
            }
            
            if (messagesResponse.ok) {
              const { messages, rateLimitInfo } = await messagesResponse.json();
              
              // Update rate limit info if provided
              if (rateLimitInfo) {
                set(state => ({ ...state, justcallRateLimitInfo: rateLimitInfo }));
                
                // If we're now rate limited, stop fetching
                if (rateLimitInfo.isRateLimited) {
                  console.warn(`JustCall API rate limited. Retry after ${rateLimitInfo.retryAfterSeconds}s`);
                  isRateLimited = true;
                  break;
                }
              }
              
              if (messages && messages.length > 0) {
                console.log(`Got ${messages.length} messages in batch ${batch + 1}`);
                
                // Keep track of the last message ID for pagination
                const lastMessage = messages[messages.length - 1];
                if (lastMessage && lastMessage.id) {
                  lastBatchProcessedMessage = lastMessage.id;
                  currentBatchCursor = lastMessage.id;
                }
                
                // Add these messages to our running collection
                allMessages = [...allMessages, ...messages];
                
                // If we have enough messages across all batches or if this batch was less than batchSize
                // (meaning there are no more messages), break the loop
                if (allMessages.length >= totalDesiredMessages || messages.length < batchSize) {
                  console.log(`Received enough messages (${allMessages.length}) or last batch was smaller than limit`);
                  break;
                }
              } else {
                // No messages in this batch, stop fetching
                console.log(`No JustCall messages in batch ${batch + 1}, stopping`);
                break;
              }
            } else {
              console.error(`Failed to fetch JustCall messages in batch ${batch + 1}:`, await messagesResponse.text());
              // Don't break completely - continue with next account
              break;
            }
          }
          
          // If we hit a rate limit, process what we have so far but stop fetching more
          if (isRateLimited) {
            console.log(`Rate limit reached. Processing ${allMessages.length} messages collected so far.`);
            // We'll process the messages we got and return early
          }
          
          console.log(`Fetched a total of ${allMessages.length} JustCall messages across all batches`);
          
          // Even if no messages in this batch, continue with other accounts
          if (allMessages.length > 0) {
            // Update the lastJustcallMessageId for pagination if this is a load more operation
            if (isLoadingMore && lastBatchProcessedMessage) {
              lastProcessedMessageId = lastBatchProcessedMessage;
            }
            
            // Map JustCall messages to Email format
            const justcallEmails: Email[] = allMessages.map((message: any) => {
              const isInbound = message.direction === "inbound";
              const threadId = message.threadId || [message.contact_number, message.justcall_number || message.number].sort().join('-');
              
              // Format the date using our utility function
              const timestamp = message.created_at || formatJustCallTimestamp(
                message.sms_user_date || message.sms_date,
                message.sms_user_time || message.sms_time
              );
              
              // Collect all time-related fields to preserve them
              const justcallTimes = {
                created_at: message.created_at,
                updated_at: message.updated_at,
                sms_user_time: message.sms_user_time,
                sms_time: message.sms_time,
                sms_user_date: message.sms_user_date,
                sms_date: message.sms_date
              };
              
              return {
                id: `justcall-${message.id}`,
                threadId,
                from: {
                  name: isInbound ? message.contact_name || message.contact_number : "You",
                  email: isInbound ? message.contact_number : account.accountIdentifier,
                },
                to: [{
                  name: isInbound ? "You" : message.contact_name || message.contact_number,
                  email: isInbound ? account.accountIdentifier : message.contact_number,
                }],
                cc: [],
                bcc: [],
                subject: "SMS Message",
                body: message.body || "",
                html: `<p>${message.body || ""}</p>`,
                attachments: message.media ? message.media.map((url: any) => {
                  // Ensure url is a string before calling split
                  const urlStr = typeof url === 'string' ? url : 
                                (url && typeof url.url === 'string') ? url.url : '';
                  
                  return {
                    filename: urlStr ? urlStr.split('/').pop() || 'attachment' : 'attachment',
                    url: urlStr,
                    contentType: urlStr.endsWith('.jpg') || urlStr.endsWith('.jpeg') ? 'image/jpeg' : 
                              urlStr.endsWith('.png') ? 'image/png' : 
                              urlStr.endsWith('.gif') ? 'image/gif' : 
                              'application/octet-stream'
                  };
                }) : [],
                date: timestamp,
                labels: ["SMS"],
                read: true,
                flagged: false,
                accountType: "justcall",
                accountId: account.id,
                justcallTimes, // Save all time information for debugging
                // Add original message properties that might be useful
                originalId: message.id,
                direction: message.direction,
                status: message.status,
                contact_number: message.contact_number,
                justcall_number: message.justcall_number || message.number
              };
            });
            
            totalNewMessages += justcallEmails.length;
            
            // Add these emails to our collection
            allEmails = [...allEmails, ...justcallEmails];
          }
          
          // If we're rate limited, update UI and break out of account loop
          if (isRateLimited) {
            const { justcallRateLimitInfo } = get();
            const waitTimeSeconds = justcallRateLimitInfo.retryAfterSeconds;
            
            set(state => ({ 
              ...state, 
              syncStatus: {
                isActive: false,
                message: `Rate limit reached. Try again in ${waitTimeSeconds}s`,
                progress: accountIndex + 1,
                total: accounts.length
              }
            }));
            
            // Process the messages we did get so far
            break;
          }
        }
        
        // Update lastJustcallMessageId in store if it changed
        if (isLoadingMore && lastProcessedMessageId && lastProcessedMessageId !== lastMessageId) {
          set((state) => ({
            ...state,
            lastJustcallMessageId: lastProcessedMessageId,
          }));
          
          // Persist to cache
          await setCacheValue("lastJustcallMessageId", lastProcessedMessageId);
          console.log(`Updated lastJustcallMessageId to: ${lastProcessedMessageId}`);
        }
        
        // If we have new emails, merge them with existing ones
        if (allEmails.length > 0) {
          // Create a map for faster lookups when merging
          const emailMap = new Map<string, Email>();
          
          // Add current emails to map
          currentEmails.forEach((email) => {
            const key = generateEmailKey(email);
            emailMap.set(key, email);
          });
          
          // Add or update with new emails
          allEmails.forEach((email) => {
            const key = generateEmailKey(email);
            
            // If email doesn't exist, or new one is more recent, use it
            const existingEmail = emailMap.get(key);
            if (!existingEmail || new Date(email.date) >= new Date(existingEmail.date)) {
              emailMap.set(key, email);
            }
          });
          
          // Convert map back to array
          const mergedEmails = Array.from(emailMap.values());
          
          // Update store with merged emails
          set((state) => ({
            ...state,
            emails: mergedEmails,
          }));
          
          // Update contacts
          const contacts = generateContactsFromEmails(mergedEmails);
          set({ contacts });
          
          // Cache the updated emails
          await setCacheValue("emails", mergedEmails);
          
          console.log(`Added ${totalNewMessages} new JustCall messages to store`);
        } else {
          console.log("No new JustCall messages found");
        }
        
        // Update sync status to complete
        set(state => ({ 
          ...state, 
          syncStatus: {
            isActive: false,
            message: totalNewMessages > 0 ? `Added ${totalNewMessages} new messages` : "No new messages",
            progress: accounts.length,
            total: accounts.length
          }
        }));
        
        return totalNewMessages;
      } catch (error) {
        console.error("Error syncing JustCall accounts:", error);
        
        // Update sync status to error
        set(state => ({ 
          ...state, 
          syncStatus: {
            isActive: false,
            message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            progress: 0,
            total: 0
          }
        }));
        
        return 0;
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
        if (isErrorEmail && existingEmail && existingEmail.source !== "gmail-api-error") {
          console.log(`Not replacing valid email with error email: ${email.id}`);
          return;
        }
        
        // If we don't have this email yet, or if the new one is better quality, use it
        if (!existingEmail || 
            (isErrorEmail && existingEmail.source === "gmail-api-error") || 
            (!isErrorEmail && new Date(email.date) >= new Date(existingEmail.date))) {
          
          // When updating, merge to keep the best parts of both
          if (existingEmail) {
            // Merge emails, keeping the better parts
            const mergedEmail = {
              ...existingEmail,
              ...email,
              // Keep existing body content if new email doesn't have it or has error
              body: (email.body && email.source !== "gmail-api-error") 
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
      updatedEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
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
          phoneNumbers: group.phoneNumbers || []
        };
        
        const response = await fetch("/api/groups", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "create",
            group: groupWithPhoneNumbers
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
          phoneNumbers: updatedGroup.phoneNumbers || []
        };
        
        const response = await fetch("/api/groups", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "update",
            group: groupWithPhoneNumbers
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
            group: { id: groupId }
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

    syncAllPlatforms: async (gmailToken: string | null = null) => {
      console.log("Syncing all messaging platforms...");
      try {
        // Run sync operations in parallel
        const [gmailResult, imapResult, twilioResult, justcallResult] = await Promise.allSettled([
          get().syncEmails(gmailToken),
          get().syncImapAccounts(),
          get().syncTwilioAccounts(),
          get().syncJustcallAccounts(false) // false = not "load more", but fresh sync
        ]);
        
        // Log results for debugging
        console.log("Sync results:", {
          gmail: gmailResult.status,
          imap: imapResult.status === 'fulfilled' ? `Found ${imapResult.value} messages` : 'failed',
          twilio: twilioResult.status === 'fulfilled' ? `Found ${twilioResult.value} messages` : 'failed',
          justcall: justcallResult.status === 'fulfilled' ? `Found ${justcallResult.value} messages` : 'failed'
        });
      } catch (error) {
        console.error("Error in syncAllPlatforms:", error);
      }
    },

    deleteConversation: (contactEmail: string) => {
      const { emails } = get();
      
      // Filter out all emails where this contact is either a sender or recipient
      const filteredEmails = emails.filter(email => {
        // Check if the contact is the sender
        const isFromContact = email.from.email === contactEmail;
        
        // Check if the contact is one of the recipients
        const isToContact = email.to.some(to => to.email === contactEmail);
        
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
      
      console.log(`Deleted conversation with ${contactEmail}. Remaining emails: ${filteredEmails.length}`);
      
      return filteredEmails.length;
    },

    setLoadPageSize: (size: number) => {
      set((state) => ({ ...state, loadPageSize: size }));
      if (typeof window !== "undefined") {
        localStorage.setItem('loadPageSize', size.toString());
      }
    },

    // Add new methods for sync status and rate limit info
    updateSyncStatus: (status: Partial<SyncStatus>) => {
      set(state => ({
        ...state,
        syncStatus: {
          ...state.syncStatus,
          ...status
        }
      }));
    },

    updateJustcallRateLimitInfo: (info: Partial<RateLimitInfo>) => {
      set(state => ({
        ...state,
        justcallRateLimitInfo: {
          ...state.justcallRateLimitInfo,
          ...info
        }
      }));
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
    }, 1000);
    
    // Set up periodic sync
    setInterval(async () => {
      const store = useEmailStore.getState();
      await store.syncGroups();
      await store.syncImapAccounts();
      await store.syncTwilioAccounts();
      await store.syncJustcallAccounts();
    }, 5 * 60 * 1000); // Sync every 5 minutes
  })().catch(error => {
    console.error("Error loading initial data:", error);
  });
}
