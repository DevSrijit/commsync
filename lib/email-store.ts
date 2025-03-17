"use client";

import { create } from "zustand";
import type { Email, Contact, Group } from "@/lib/types";
import { MessageCategory } from "@/components/sidebar";
import { ImapAccount } from "@/lib/imap-service";
import { SyncService } from "./sync-service";

interface EmailStore {
  emails: Email[];
  contacts: Contact[];
  activeFilter: MessageCategory;
  activeGroup: string | null;
  imapAccounts: ImapAccount[];
  twilioAccounts: any[];
  justcallAccounts: any[];
  groups: Group[];
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
}

// Helper function to load persisted data
const loadPersistedData = () => {
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
    const savedEmails = localStorage.getItem("emails");
    const savedAccounts = localStorage.getItem("imapAccounts");
    const savedTwilioAccounts = localStorage.getItem("twilioAccounts");
    const savedJustcallAccounts = localStorage.getItem("justcallAccounts");
    const savedGroups = localStorage.getItem("groups");

    return {
      emails: savedEmails ? JSON.parse(savedEmails) : [],
      imapAccounts: savedAccounts ? JSON.parse(savedAccounts) : [],
      twilioAccounts: savedTwilioAccounts ? JSON.parse(savedTwilioAccounts) : [],
      justcallAccounts: savedJustcallAccounts ? JSON.parse(savedJustcallAccounts) : [],
      groups: savedGroups ? JSON.parse(savedGroups) : [],
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

export const useEmailStore = create<EmailStore>((set, get) => ({
  syncEmails: async (gmailToken: string | null) => {
    const { imapAccounts } = get();
    await SyncService.getInstance().syncAllEmails(gmailToken, imapAccounts);
  },

  syncImapAccounts: async () => {
    try {
      const response = await fetch("/api/imap/accounts");
      if (response.ok) {
        const { accounts } = await response.json();
        if (accounts && accounts.length > 0) {
          set((state) => ({ ...state, imapAccounts: accounts }));

          // Sync emails for each account
          for (const account of accounts) {
            await fetch("/api/imap", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "syncEmails",
                account,
                data: { limit: 50 },
              }),
            });
          }
        }
      }
    } catch (error) {
      console.error("Error syncing IMAP accounts:", error);
    }
  },

  syncTwilioAccounts: async () => {
    try {
      console.log("Starting Twilio accounts sync");
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
            }),
          });
          
          if (syncResult.ok) {
            // After syncing, get all the messages to update the store
            const currentEmails = get().emails;
            console.log(`Current email count before Twilio sync: ${currentEmails.length}`);
            const messagesResponse = await fetch("/api/messages?platform=twilio");
            if (messagesResponse.ok) {
              const { messages } = await messagesResponse.json();
              console.log(`Retrieved ${messages?.length || 0} Twilio messages`);
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
                // Merge with existing emails
                const mergedEmails = [...currentEmails, ...twilioEmails];
                get().setEmails(mergedEmails);
                console.log(`Updated email store with Twilio messages. New count: ${mergedEmails.length}`);
                localStorage.setItem("emails", JSON.stringify(mergedEmails));
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
      // Fetch all JustCall accounts for the user
      const response = await fetch("/api/sync/accounts?platform=justcall");
      if (response.ok) {
        const { accounts } = await response.json();
        console.log(`Found ${accounts?.length || 0} JustCall accounts`);
        if (accounts && accounts.length > 0) {
          set((state) => ({ ...state, justcallAccounts: accounts }));
          
          // Sync messages for each account
          const syncResult = await fetch("/api/sync/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              platform: "justcall",
            }),
          });
          
          if (syncResult.ok) {
            // After syncing, get all the messages to update the store
            const currentEmails = get().emails;
            console.log(`Current email count before JustCall sync: ${currentEmails.length}`);
            const messagesResponse = await fetch("/api/messages?platform=justcall");
            if (messagesResponse.ok) {
              const { messages } = await messagesResponse.json();
              console.log(`Retrieved ${messages?.length || 0} JustCall messages`);
              if (messages && messages.length > 0) {
                // Convert JustCall messages to Email format
                const justcallEmails = messages.map((msg: any) => ({
                  id: msg.id,
                  from: {
                    name: msg.contact_name || msg.contact_number || 'Unknown',
                    email: msg.contact_number || '',
                  },
                  to: [{
                    name: 'You',
                    email: msg.number || '',
                  }],
                  subject: 'SMS Message',
                  // Access body from sms_info object for V2 API
                  body: msg.sms_info?.body || msg.body || '',
                  date: msg.created_at || new Date().toISOString(),
                  labels: ['SMS'],
                  accountType: 'justcall',
                  accountId: msg.accountId,
                  platform: 'justcall',
                }));
                
                console.log(`Converted ${justcallEmails.length} JustCall messages to Email format`);
                // Merge with existing emails
                const mergedEmails = [...currentEmails, ...justcallEmails];
                get().setEmails(mergedEmails);
                console.log(`Updated email store with JustCall messages. New count: ${mergedEmails.length}`);
                localStorage.setItem("emails", JSON.stringify(mergedEmails));
              }
            } else {
              console.error("Failed to fetch JustCall messages:", await messagesResponse.text());
            }
          } else {
            console.error("Failed to sync JustCall messages:", await syncResult.text());
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
    localStorage.setItem("twilioAccounts", JSON.stringify(accounts));
  },

  setJustcallAccounts: (accounts) => {
    set((state) => ({ ...state, justcallAccounts: accounts }));
    localStorage.setItem("justcallAccounts", JSON.stringify(accounts));
  },

  // Initialize with empty arrays first
  emails: [],
  contacts: [],
  imapAccounts: [],
  twilioAccounts: [],
  justcallAccounts: [],
  activeFilter: "inbox",
  activeGroup: null,
  groups: [],

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

    // Persist emails
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("emails", JSON.stringify(uniqueEmails));
      } catch (e) {
        console.error("Failed to persist emails to localStorage:", e);
      }
    }

    // Extract unique contacts from emails
    const contactsMap = new Map<string, Contact>();

    uniqueEmails.forEach((email) => {
      // Skip processing if email doesn't have proper structure
      if (!email.from || !email.from.email) {
        console.warn("Email missing from field:", email.id);
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
    const contacts = Array.from(contactsMap.values()).sort(
      (a, b) =>
        new Date(b.lastMessageDate).getTime() -
        new Date(a.lastMessageDate).getTime()
    );

    // Debug log
    console.log(`Contact store update: ${contacts.length} unique contacts`);

    set({ contacts });
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
    const key = generateEmailKey(email);

    // Check if email already exists
    const existingEmailIndex = emails.findIndex(
      (e) => generateEmailKey(e) === key
    );

    let updatedEmails;
    if (existingEmailIndex === -1) {
      updatedEmails = [...emails, email];
    } else {
      // Merge the emails, keeping content if available
      const existingEmail = emails[existingEmailIndex];
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

      updatedEmails = [...emails];
      updatedEmails[existingEmailIndex] = mergedEmail;
    }

    set({ emails: updatedEmails });

    // Persist updated emails
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("emails", JSON.stringify(updatedEmails));
      } catch (e) {
        console.error("Failed to persist emails to localStorage:", e);
      }
    }

    // Update contacts
    const { contacts } = get();
    const updatedContacts = [...contacts];

    // Handle sender contact update
    if (email.from && email.from.email && !email.from.email.includes("me")) {
      const contactKey = generateContactKey(
        email.accountType,
        email.accountId,
        email.from.email
      );
      const existingContactIndex = contacts.findIndex(
        (c) =>
          generateContactKey(c.accountType, c.accountId, c.email) === contactKey
      );
      const emailDate = new Date(email.date);

      if (existingContactIndex === -1) {
        updatedContacts.push({
          name: email.from.name,
          email: email.from.email,
          lastMessageDate: email.date,
          lastMessageSubject: email.subject,
          labels: email.labels,
          accountId: email.accountId,
          accountType: email.accountType,
        });
      } else if (
        new Date(contacts[existingContactIndex].lastMessageDate) < emailDate
      ) {
        updatedContacts[existingContactIndex] = {
          ...contacts[existingContactIndex],
          lastMessageDate: email.date,
          lastMessageSubject: email.subject,
          labels: email.labels,
          accountId: email.accountId,
          accountType: email.accountType,
        };
      }
    }

    // Handle recipient contact update
    if (Array.isArray(email.to)) {
      email.to.forEach((recipient) => {
        if (!recipient.email.includes("me")) {
          const contactKey = generateContactKey(
            email.accountType,
            email.accountId,
            recipient.email
          );
          const existingContactIndex = contacts.findIndex(
            (c) =>
              generateContactKey(c.accountType, c.accountId, c.email) ===
              contactKey
          );
          const emailDate = new Date(email.date);

          if (existingContactIndex === -1) {
            updatedContacts.push({
              name: recipient.name,
              email: recipient.email,
              lastMessageDate: email.date,
              lastMessageSubject: email.subject,
              labels: email.labels,
              accountId: email.accountId,
              accountType: email.accountType,
            });
          } else if (
            new Date(contacts[existingContactIndex].lastMessageDate) < emailDate
          ) {
            updatedContacts[existingContactIndex] = {
              ...contacts[existingContactIndex],
              lastMessageDate: email.date,
              lastMessageSubject: email.subject,
              labels: email.labels,
              accountId: email.accountId,
              accountType: email.accountType,
            };
          }
        }
      });
    }

    // Sort contacts by most recent message
    updatedContacts.sort(
      (a, b) =>
        new Date(b.lastMessageDate).getTime() -
        new Date(a.lastMessageDate).getTime()
    );
    set({ contacts: updatedContacts });
  },

  // IMAP account management
  addImapAccount: (account) => {
    const { imapAccounts } = get();
    const updatedAccounts = [...imapAccounts, account];
    set({ imapAccounts: updatedAccounts });

    // Persist IMAP accounts
    if (typeof window !== "undefined") {
      localStorage.setItem("imapAccounts", JSON.stringify(updatedAccounts));
    }
  },

  removeImapAccount: (id) => {
    const { imapAccounts } = get();
    const updated = imapAccounts.filter((account) => account.id !== id);
    set({ imapAccounts: updated });

    // Persist updated IMAP accounts
    if (typeof window !== "undefined") {
      localStorage.setItem("imapAccounts", JSON.stringify(updated));
    }
  },

  getImapAccount: (id) => {
    return get().imapAccounts.find((account) => account.id === id);
  },

  setImapAccounts: (accounts) => {
    set({ imapAccounts: accounts });

    // Persist IMAP accounts
    if (typeof window !== "undefined") {
      localStorage.setItem("imapAccounts", JSON.stringify(accounts));
    }
  },

  syncGroups: async () => {
    try {
      const response = await fetch("/api/groups");
      if (response.ok) {
        const { groups } = await response.json();
        if (groups && Array.isArray(groups)) {
          set((state) => ({ ...state, groups }));
          
          // Update local storage
          if (typeof window !== "undefined") {
            localStorage.setItem("groups", JSON.stringify(groups));
            localStorage.setItem("groupsTimestamp", Date.now().toString());
          }
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
    
    // Update local storage
    if (typeof window !== "undefined") {
      localStorage.setItem("groups", JSON.stringify(groups));
      localStorage.setItem("groupsTimestamp", Date.now().toString());
    }
  },

  addGroup: async (group) => {
    try {
      // First update local state for immediate UI feedback
      set((state) => ({
        ...state,
        groups: [...state.groups, group],
      }));

      // Then persist to Prisma
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", group }),
      });

      if (response.ok) {
        const { group: savedGroup } = await response.json();
        
        // Update with the server-generated ID and timestamps
        set((state) => ({
          ...state,
          groups: state.groups.map(g => 
            g.id === group.id ? savedGroup : g
          ),
        }));
        
        // Update local storage
        if (typeof window !== "undefined") {
          const savedGroups = localStorage.getItem("groups");
          const groups = savedGroups ? JSON.parse(savedGroups) : [];
          const updatedGroups = groups.map((g:Group) => g.id === group.id ? savedGroup : g);
          localStorage.setItem("groups", JSON.stringify(updatedGroups));
          localStorage.setItem("groupsTimestamp", Date.now().toString());
        }
      } else {
        console.error("Failed to save group to server:", await response.text());
        // Revert the local change if server save failed
        await get().syncGroups();
      }
    } catch (error) {
      console.error("Error saving group:", error);
      // Revert the local change if there was an error
      await get().syncGroups();
    }
  },

  updateGroup: async (group) => {
    try {
      // First update local state for immediate UI feedback
      set((state) => ({
        ...state,
        groups: state.groups.map((g) => (g.id === group.id ? group : g)),
      }));

      // Then persist to Prisma
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", group }),
      });

      if (!response.ok) {
        console.error("Failed to update group on server:", await response.text());
        // Revert the local change if server update failed
        await get().syncGroups();
      } else {
        // Update local storage
        if (typeof window !== "undefined") {
          const savedGroups = localStorage.getItem("groups");
          const groups = savedGroups ? JSON.parse(savedGroups) : [];
          const updatedGroups = groups.map((g:Group) => g.id === group.id ? group : g);
          localStorage.setItem("groups", JSON.stringify(updatedGroups));
          localStorage.setItem("groupsTimestamp", Date.now().toString());
        }
      }
    } catch (error) {
      console.error("Error updating group:", error);
      // Revert the local change if there was an error
      await get().syncGroups();
    }
  },

  deleteGroup: async (groupId) => {
    try {
      // Find the group to delete
      const groupToDelete = get().groups.find(g => g.id === groupId);
      if (!groupToDelete) return;
      
      // First update local state for immediate UI feedback
      set((state) => ({
        ...state,
        groups: state.groups.filter((g) => g.id !== groupId),
      }));

      // Then delete from Prisma
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "delete", 
          group: { id: groupId } 
        }),
      });

      if (!response.ok) {
        console.error("Failed to delete group from server:", await response.text());
        // Revert the local change if server delete failed
        await get().syncGroups();
      } else {
        // Update local storage
        if (typeof window !== "undefined") {
          const savedGroups = localStorage.getItem("groups");
          const groups = savedGroups ? JSON.parse(savedGroups) : [];
          const filteredGroups = groups.filter((g:Group) => g.id !== groupId);
          localStorage.setItem("groups", JSON.stringify(filteredGroups));
          localStorage.setItem("groupsTimestamp", Date.now().toString());
        }
      }
    } catch (error) {
      console.error("Error deleting group:", error);
      // Revert the local change if there was an error
      await get().syncGroups();
    }
  },
}));

// Load persisted data on the client side only
if (typeof window !== "undefined") {
  // Initial load from localStorage
  const persistedData = loadPersistedData();
  useEmailStore.setState(persistedData);
  
  // Then sync with server data
  setTimeout(async () => {
    const store = useEmailStore.getState();
    await store.syncGroups();
    await store.syncImapAccounts();
    await store.syncTwilioAccounts();
    await store.syncJustcallAccounts();
  }, 100);
  
  // Set up periodic sync
  setInterval(async () => {
    const store = useEmailStore.getState();
    await store.syncGroups();
    await store.syncTwilioAccounts();
    await store.syncJustcallAccounts();
  }, 5 * 60 * 1000); // Sync every 5 minutes
}
