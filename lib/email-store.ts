"use client";

import { create } from "zustand";
import type { Email, Contact } from "@/lib/types";
import { MessageCategory } from "@/components/sidebar";
import { ImapAccount } from "@/lib/imap-service";
import { SyncService } from "./sync-service";

interface EmailStore {
  emails: Email[];
  contacts: Contact[];
  activeFilter: MessageCategory;
  imapAccounts: ImapAccount[];
  setEmails: (emails: Email[]) => void;
  setActiveFilter: (filter: MessageCategory) => void;
  addEmail: (email: Email) => void;
  addImapAccount: (account: ImapAccount) => void;
  removeImapAccount: (id: string) => void;
  getImapAccount: (id: string) => ImapAccount | undefined;
  syncEmails: (gmailToken: string | null) => Promise<void>;
  syncImapAccounts: () => Promise<void>;
  setImapAccounts: (accounts: ImapAccount[]) => void;
}

// Helper function to load persisted data
const loadPersistedData = () => {
  // Always return empty arrays during server-side rendering
  if (typeof window === "undefined") {
    return { emails: [], imapAccounts: [] };
  }

  try {
    const savedEmails = localStorage.getItem("emails");
    const savedAccounts = localStorage.getItem("imapAccounts");

    return {
      emails: savedEmails ? JSON.parse(savedEmails) : [],
      imapAccounts: savedAccounts ? JSON.parse(savedAccounts) : [],
    };
  } catch (e) {
    console.error("Failed to load persisted data:", e);
    return { emails: [], imapAccounts: [] };
  }
};

// Improved email key generation function
const generateEmailKey = (email: Email) => {
  // For IMAP emails, use a combination of accountId and id
  if (email.accountId) {
    return `imap-${email.accountId}-${email.id}`;
  }
  
  // For Gmail emails, use the id (which is already unique)
  return `gmail-${email.id}`;
};

// Filter function to identify valid emails
const isValidEmail = (email: Email): boolean => {
  // Check if email has basic required properties
  if (!email.id || !email.from || !email.from.email || !email.subject) {
    return false;
  }
  
  // Skip emails with empty body
  if (!email.body || email.body.trim() === '') {
    return false;
  }
  
  // Ensure required fields are present
  if (!email.labels) {
    email.labels = [];
  }
  
  return true;
};

export const useEmailStore = create<EmailStore>((set, get) => ({
  syncEmails: async (gmailToken: string | null) => {
    const { imapAccounts } = get();
    await SyncService.getInstance().syncAllEmails(gmailToken, imapAccounts);
  },

  syncImapAccounts: async () => {
    try {
      const response = await fetch('/api/imap?action=getAccounts');
      if (response.ok) {
        const { accounts } = await response.json();
        if (accounts && accounts.length > 0) {
          set(state => ({ ...state, imapAccounts: accounts }));
          
          // Sync emails for each account
          for (const account of accounts) {
            await fetch("/api/imap", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "syncEmails",
                account,
                data: { limit: 50 }
              }),
            });
          }
        }
      }
    } catch (error) {
      console.error("Error syncing IMAP accounts:", error);
    }
  },

  // Initialize with empty arrays first
  emails: [],
  contacts: [],
  imapAccounts: [],
  activeFilter: "inbox",

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
      // Ensure accountType is set for proper handling
      if (email.accountId && !email.accountType) {
        email.accountType = 'imap';
      } else if (!email.accountType) {
        email.accountType = 'gmail';
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
          date: new Date(email.date) > new Date(existingEmail.date) ? email.date : existingEmail.date,
        };
        uniqueEmailsMap.set(key, mergedEmail);
      }
    });

    const uniqueEmails = Array.from(uniqueEmailsMap.values());
    
    // Debug log
    console.log(`Email store update: ${uniqueEmails.length} unique emails (${emails.length} new emails)`);
    
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

      // Add sender as contact (if not the current user)
      if (!email.from.email.includes("me")) {
        const contactKey = `${email.accountId || 'gmail'}-${email.from.email}`;
        const existingContact = contactsMap.get(contactKey);
        const emailDate = new Date(email.date);

        if (
          !existingContact ||
          new Date(existingContact.lastMessageDate) < emailDate
        ) {
          contactsMap.set(contactKey, {
            name: email.from.name,
            email: email.from.email,
            lastMessageDate: email.date,
            lastMessageSubject: email.subject,
            labels: email.labels,
            accountId: email.accountId, // Add accountId to track which account this contact is from
          });
        }
      }

      // Add recipients as contacts
      if (Array.isArray(email.to)) {
        email.to.forEach((recipient) => {
          if (!recipient.email.includes("me")) {
            const contactKey = `${email.accountId || 'gmail'}-${recipient.email}`;
            const existingContact = contactsMap.get(contactKey);
            const emailDate = new Date(email.date);

            if (
              !existingContact ||
              new Date(existingContact.lastMessageDate) < emailDate
            ) {
              contactsMap.set(contactKey, {
                name: recipient.name,
                email: recipient.email,
                lastMessageDate: email.date,
                lastMessageSubject: email.subject,
                labels: email.labels,
                accountId: email.accountId, // Add accountId to track which account this contact is from
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
    // Ensure accountType is set
    if (email.accountId && !email.accountType) {
      email.accountType = 'imap';
    } else if (!email.accountType) {
      email.accountType = 'gmail';
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
        date: new Date(email.date) > new Date(existingEmail.date) ? email.date : existingEmail.date,
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
      const contactKey = `${email.accountId || 'gmail'}-${email.from.email}`;
      const existingContactIndex = contacts.findIndex(
        (c) => `${c.accountId || 'gmail'}-${c.email}` === contactKey
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
        };
      }
    }

    // Handle recipient contact update
    if (Array.isArray(email.to)) {
      email.to.forEach((recipient) => {
        if (!recipient.email.includes("me")) {
          const contactKey = `${email.accountId || 'gmail'}-${recipient.email}`;
          const existingContactIndex = contacts.findIndex(
            (c) => `${c.accountId || 'gmail'}-${c.email}` === contactKey
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
}));

// Load persisted data on the client side only
if (typeof window !== "undefined") {
  const persistedData = loadPersistedData();
  useEmailStore.setState(persistedData);
}