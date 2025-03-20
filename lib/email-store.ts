"use client";

import { create } from "zustand";
import type { Email, Contact, Group } from "@/lib/types";
import { MessageCategory } from "@/components/sidebar";
import { ImapAccount } from "@/lib/imap-service";
import { SyncService } from "./sync-service";
import { getCacheValue, getMultipleCacheValues, setCacheValue, removeCacheValue } from './client-cache-browser';

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
  currentJustcallPage: number;
  setEmails: (emails: Email[]) => void;
  setActiveFilter: (filter: MessageCategory) => void;
  addEmail: (email: Email) => void;
  addImapAccount: (account: ImapAccount) => void;
  removeImapAccount: (id: string) => void;
  getImapAccount: (id: string) => ImapAccount | undefined;
  syncEmails: (gmailToken: string | null) => Promise<void>;
  syncImapAccounts: () => Promise<void>;
  syncTwilioAccounts: () => Promise<void>;
  syncJustcallAccounts: () => Promise<void>;
  setImapAccounts: (accounts: ImapAccount[]) => void;
  setTwilioAccounts: (accounts: any[]) => void;
  setJustcallAccounts: (accounts: any[]) => void;
  addGroup: (group: Group) => void;
  updateGroup: (group: Group) => void;
  deleteGroup: (groupId: string) => void;
  syncGroups: () => Promise<void>;
  setGroups: (groups: Group[]) => void;
  updateContacts: (emails: Email[]) => void;
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
      groups: [] 
    };
  }

  try {
    // Use the browser cache client to get multiple values at once
    const cacheData = await getMultipleCacheValues([
      "emails", 
      "imapAccounts", 
      "twilioAccounts", 
      "justcallAccounts", 
      "groups"
    ]);

    return {
      emails: cacheData.emails || [],
      imapAccounts: cacheData.imapAccounts || [],
      twilioAccounts: cacheData.twilioAccounts || [],
      justcallAccounts: cacheData.justcallAccounts || [],
      groups: cacheData.groups || [],
    };
  } catch (e) {
    console.error("Failed to load persisted data:", e);
    return { emails: [], imapAccounts: [], twilioAccounts: [], justcallAccounts: [], groups: [] };
  }
};

// Improved email key generation function
const generateEmailKey = (email: Email): string => {
  // Use a consistent key format that doesn't depend on accountType/accountId
  // This ensures the same email is recognized regardless of how it was fetched
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

    // Skip emails with empty body
    if (!email.body || email.body.trim() === "") {
      return false;
    }
  }

  // Ensure required fields are present
  if (!email.labels) {
    email.labels = [];
  }

  return true;
};

const generateContactKey = (
  accountType: string | undefined,
  accountId: string | undefined,
  email: string
): string => {
  // Use email address as the primary key, regardless of account
  return email.toLowerCase();
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
    
    // Add sender as contact (if not the current user)
    if (!email.from.email.includes("me")) {
      // Use email address only as the contact key
      const contactKey = email.from.email.toLowerCase();
      const existingContact = contactsMap.get(contactKey);
      const emailDate = new Date(email.date);

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

    // Add recipients as contacts
    if (Array.isArray(email.to)) {
      email.to.forEach((recipient) => {
        if (!recipient.email.includes("me")) {
          // Use email address only as the contact key
          const contactKey = recipient.email.toLowerCase();
          const existingContact = contactsMap.get(contactKey);
          const emailDate = new Date(email.date);

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
        }
      });
    }
  });

  // Sort contacts by most recent message
  return Array.from(contactsMap.values()).sort(
    (a, b) =>
      new Date(b.lastMessageDate).getTime() -
      new Date(a.lastMessageDate).getTime()
  );
};

export const useEmailStore = create<EmailStore>((set, get) => {
  // Initialize with empty data, we'll load asynchronously
  const initialData = { emails: [], imapAccounts: [], twilioAccounts: [], justcallAccounts: [], groups: [] };

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
          groups: persistedData.groups
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
    currentJustcallPage: 1,

    syncEmails: async (gmailToken: string | null) => {
      const { imapAccounts } = get();
      // Set very large page size to fetch all emails
      await SyncService.getInstance().syncAllEmails(gmailToken, imapAccounts, 1, 100000);
    },

    syncImapAccounts: async () => {
      try {
        console.log("Starting IMAP accounts sync - fetching ALL emails");
        // Set fetchAll flag to true
        const response = await fetch("/api/sync/accounts?platform=imap&fetchAll=true");
        if (response.ok) {
          const { accounts } = await response.json();
          console.log(`Found ${accounts?.length || 0} IMAP accounts`);
          if (accounts && accounts.length > 0) {
            set((state) => ({ ...state, imapAccounts: accounts }));
            
            // Sync ALL emails for each account
            const syncResult = await fetch("/api/imap/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fetchAll: true,
                pageSize: 100000
              }),
            });
            
            if (syncResult.ok) {
              // After syncing, get all the messages to update the store
              console.log(`Current email count before IMAP sync: ${get().emails.length}`);
              const messagesResponse = await fetch(`/api/messages?platform=imap&fetchAll=true`);
              if (messagesResponse.ok) {
                const { messages } = await messagesResponse.json();
                console.log(`Retrieved ${messages?.length || 0} IMAP messages`);
                if (messages && messages.length > 0) {
                  // Convert IMAP messages to Email format
                  const imapEmails = messages.map((msg: any) => ({
                    id: msg.id,
                    from: {
                      name: msg.from.name || 'Unknown',
                      email: msg.from.email || '',
                    },
                    to: [{
                      name: msg.to.name || 'You',
                      email: msg.to.email || '',
                    }],
                    subject: msg.subject || '',
                    body: msg.body || '',
                    date: msg.date || new Date().toISOString(),
                    labels: msg.labels || [],
                    accountType: 'imap',
                    accountId: msg.accountId,
                    platform: 'imap',
                  }));
                  
                  console.log(`Converted ${imapEmails.length} IMAP messages to Email format`);
                  
                  // When loading older messages, we shouldn't have duplicates by ID
                  // But check anyway for safety
                  const existingIds = new Set(get().emails.map(email => email.id));
                  const newEmails = imapEmails.filter((email: Email) => !existingIds.has(email.id));
                  
                  if (newEmails.length > 0) {
                    // Merge with existing emails
                    const mergedEmails = [...get().emails, ...newEmails];
                    
                    // Sort by date descending (newest first) after merging
                    mergedEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    
                    get().setEmails(mergedEmails);
                    console.log(`Updated email store with ${newEmails.length} IMAP messages. New count: ${mergedEmails.length}`);
                    setCacheValue("emails", mergedEmails);
                    
                    // Increment the page counter only if we found new emails
                    set((state) => ({ ...state, currentImapPage: 1 }));
                    console.log(`Reset IMAP page to 1`);
                  } else {
                    console.log(`No new IMAP messages found`);
                  }
                } else {
                  console.log(`No IMAP messages found`);
                }
              } else {
                console.error("Failed to fetch IMAP messages:", await messagesResponse.text());
              }
            } else {
              console.error("Failed to sync IMAP messages:", await syncResult.text());
            }
          }
        } else {
          console.error("Failed to fetch IMAP accounts:", await response.text());
        }
      } catch (error) {
        console.error("Error syncing IMAP accounts:", error);
      }
    },

    syncTwilioAccounts: async () => {
      try {
        console.log("Starting Twilio accounts sync");
        // Get current page
        const currentPage = get().currentTwilioPage;
        console.log(`Fetching Twilio accounts, page ${currentPage}`);
        
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
        if (response.ok) {
          const { accounts } = await response.json();
          console.log(`Found ${accounts?.length || 0} Twilio accounts`);
          if (accounts && accounts.length > 0) {
            set((state) => ({ ...state, twilioAccounts: accounts }));
            
            // Sync messages for each account
            const syncResult = await fetch("/api/sync/messages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                platform: "twilio",
                page: currentPage,
                pageSize: 100,
                oldestDate: oldestDate ? oldestDate.toISOString() : undefined,
                sortDirection: 'asc' // Important: Load older messages, not newer
              }),
            });
            
            if (syncResult.ok) {
              // After syncing, get all the messages to update the store
              console.log(`Current email count before Twilio sync: ${currentEmails.length}`);
              const messagesResponse = await fetch(`/api/messages?platform=twilio&page=${currentPage}&pageSize=100&sortDirection=asc&oldestDate=${oldestDate ? encodeURIComponent(oldestDate.toISOString()) : ''}`);
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
                    labels: ['SMS'],
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
                    // Merge with existing emails
                    const mergedEmails = [...currentEmails, ...newEmails];
                    
                    // Sort by date descending (newest first) after merging
                    mergedEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    
                    get().setEmails(mergedEmails);
                    console.log(`Updated email store with ${newEmails.length} older Twilio messages. New count: ${mergedEmails.length}`);
                    setCacheValue("emails", mergedEmails);
                    
                    // Increment the page counter only if we found new emails
                    set((state) => ({ ...state, currentTwilioPage: currentPage + 1 }));
                    console.log(`Incremented Twilio page to ${currentPage + 1}`);
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
          }
        } else {
          console.error("Failed to fetch Twilio accounts:", await response.text());
        }
      } catch (error) {
        console.error("Error syncing Twilio accounts:", error);
      }
    },

    syncJustcallAccounts: async () => {
      try {
        console.log("Starting JustCall accounts sync");
        // Get current page
        const currentPage = get().currentJustcallPage;
        console.log(`Fetching JustCall accounts, page ${currentPage}`);

        // For loading older messages, we need to track the oldest message date
        // Get all current emails to find the oldest date
        const currentEmails = get().emails;
        const justcallEmails = currentEmails.filter(email => email.accountType === 'justcall');
        
        // Find the oldest justcall message date if we have any
        let oldestDate: Date | undefined = undefined;
        if (justcallEmails.length > 0) {
          const dates = justcallEmails.map((email: Email) => new Date(email.date));
          oldestDate = new Date(Math.min(...dates.map(d => d.getTime())));
          console.log(`Oldest JustCall message date: ${oldestDate.toISOString()}`);
        }
        
        // Fetch all JustCall accounts for the user
        const response = await fetch("/api/sync/accounts?platform=justcall");
        if (response.ok) {
          const { accounts } = await response.json();
          console.log(`Found ${accounts?.length || 0} JustCall accounts`);
          if (accounts && accounts.length > 0) {
            set((state) => ({ ...state, justcallAccounts: accounts }));
            
            // Process each account separately to ensure phone number filtering
            for (const account of accounts) {
              // Make sure we have the accountIdentifier (phone number)
              if (!account.accountIdentifier) {
                console.warn(`JustCall account ${account.id} has no accountIdentifier (phone number), skipping`);
                continue;
              }
              
              console.log(`Syncing JustCall account ${account.id} for phone number: ${account.accountIdentifier}`);
              
              // Sync messages for this specific account/phone number
              const syncResult = await fetch("/api/sync/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  platform: "justcall",
                  page: currentPage,
                  pageSize: 100,
                  phoneNumber: account.accountIdentifier,
                  accountId: account.id,
                  oldestDate: oldestDate ? oldestDate.toISOString() : undefined,
                  sortDirection: 'asc' // Important: Load older messages, not newer
                }),
              });
              
              if (syncResult.ok) {
                // After syncing, get messages for this specific phone number
                console.log(`Current email count before JustCall sync: ${currentEmails.length}`);
                const messagesResponse = await fetch(`/api/messages?platform=justcall&page=${currentPage}&pageSize=100&phoneNumber=${encodeURIComponent(account.accountIdentifier)}&accountId=${account.id}&oldestDate=${oldestDate ? encodeURIComponent(oldestDate.toISOString()) : ''}&sortDirection=asc`);
                
                if (messagesResponse.ok) {
                  const { messages } = await messagesResponse.json();
                  console.log(`Retrieved ${messages?.length || 0} older JustCall messages for phone ${account.accountIdentifier} on page ${currentPage}`);
                  
                  if (messages && messages.length > 0) {
                    // Convert JustCall messages to Email format
                    const justcallEmails = messages.map((msg: any) => ({
                      id: msg.id,
                      threadId: msg.threadId, // Use the threadId for grouping
                      from: {
                        name: msg.direction === 'inbound' ? 
                          (msg.contact_name || msg.contact_number || 'Unknown') : 
                          'You',
                        email: msg.direction === 'inbound' ? 
                          msg.contact_number : 
                          msg.number,
                      },
                      to: [{
                        name: msg.direction === 'inbound' ? 'You' : 
                          (msg.contact_name || msg.contact_number || 'Unknown'),
                        email: msg.direction === 'inbound' ? 
                          msg.number : 
                          msg.contact_number,
                      }],
                      subject: 'SMS Message',
                      // Access body from sms_info object for V2 API
                      body: msg.sms_info?.body || msg.body || '',
                      date: msg.created_at || new Date().toISOString(),
                      labels: ['SMS'],
                      accountType: 'justcall',
                      accountId: account.id,
                      platform: 'justcall',
                      phoneNumber: account.accountIdentifier // Store the phone number for reference
                    }));
                    
                    console.log(`Converted ${justcallEmails.length} JustCall messages to Email format`);
                    
                    // When loading older messages, we shouldn't have duplicates by ID
                    // But check anyway for safety
                    const existingIds = new Set(currentEmails.map(email => email.id));
                    const newEmails = justcallEmails.filter((email: Email) => !existingIds.has(email.id));
                    
                    if (newEmails.length > 0) {
                      // Merge with existing emails
                      const mergedEmails = [...currentEmails, ...newEmails];
                      
                      // Sort by date descending (newest first) after merging
                      mergedEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                      
                      get().setEmails(mergedEmails);
                      console.log(`Updated email store with ${newEmails.length} older JustCall messages for phone ${account.accountIdentifier}. New count: ${mergedEmails.length}`);
                      setCacheValue("emails", mergedEmails);
                      
                      // Increment the page counter only if we found new emails (per account)
                      if (account === accounts[accounts.length - 1]) { // Only increment after processing the last account
                        set((state) => ({ ...state, currentJustcallPage: currentPage + 1 }));
                        console.log(`Incremented JustCall page to ${currentPage + 1}`);
                      }
                    } else {
                      console.log(`No new JustCall messages for phone ${account.accountIdentifier} on page ${currentPage}`);
                    }
                  } else {
                    console.log(`No JustCall messages for phone ${account.accountIdentifier} on page ${currentPage}`);
                  }
                } else {
                  console.error(`Failed to fetch JustCall messages for phone ${account.accountIdentifier}:`, await messagesResponse.text());
                }
              } else {
                console.error(`Failed to sync JustCall messages for phone ${account.accountIdentifier}:`, await syncResult.text());
              }
            }
          }
        } else {
          console.error("Failed to fetch JustCall accounts:", await response.text());
        }
      } catch (error) {
        console.error("Error syncing JustCall accounts:", error);
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

        // Always use the newer version when available
        const existingEmail = uniqueEmailsMap.get(key);
        if (!existingEmail) {
          uniqueEmailsMap.set(key, email);
        } else {
          // Merge the emails, preferring the newer one but keeping content if available
          const mergedEmail = {
            ...existingEmail,
            ...email,
            // Keep existing body content if new email doesn't have it
            body: email.body || existingEmail.body,
            // Keep existing attachments if new email doesn't have them
            attachments: email.attachments || existingEmail.attachments,
            // Use the newer date
            date:
              new Date(email.date) > new Date(existingEmail.date)
                ? email.date
                : existingEmail.date,
          };
          uniqueEmailsMap.set(key, mergedEmail);
        }
      });

      const uniqueEmails = Array.from(uniqueEmailsMap.values());

      // Debug log
      console.log(
        `Email store update: ${uniqueEmails.length} unique emails (${emails.length} new emails)`
      );

      set({ emails: uniqueEmails });

      // Persist emails to the database
      setCacheValue("emails", uniqueEmails);
      
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
