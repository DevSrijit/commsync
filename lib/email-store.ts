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
  groups: Group[];
  setEmails: (emails: Email[]) => void;
  setActiveFilter: (filter: MessageCategory) => void;
  addEmail: (email: Email) => void;
  addImapAccount: (account: ImapAccount) => void;
  removeImapAccount: (id: string) => void;
  getImapAccount: (id: string) => ImapAccount | undefined;
  syncEmails: (gmailToken: string | null) => Promise<void>;
  syncImapAccounts: () => Promise<void>;
  setImapAccounts: (accounts: ImapAccount[]) => void;
  addGroup: (group: Group) => void;
  updateGroup: (group: Group) => void;
  deleteGroup: (groupId: string) => void;
}

// Helper function to load persisted data
const loadPersistedData = () => {
  // Always return empty arrays during server-side rendering
  if (typeof window === "undefined") {
    return { emails: [], imapAccounts: [], groups: [] };
  }

  try {
    const savedEmails = localStorage.getItem("emails");
    const savedAccounts = localStorage.getItem("imapAccounts");
    const savedGroups = localStorage.getItem("groups");

    return {
      emails: savedEmails ? JSON.parse(savedEmails) : [],
      imapAccounts: savedAccounts ? JSON.parse(savedAccounts) : [],
      groups: savedGroups ? JSON.parse(savedGroups) : [],
    };
  } catch (e) {
    console.error("Failed to load persisted data:", e);
    return { emails: [], imapAccounts: [], groups: [] };
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
  // Check if email has basic required properties
  if (!email.id || !email.from || !email.from.email || !email.subject) {
    return false;
  }

  // Skip emails with empty body
  if (!email.body || email.body.trim() === "") {
    return false;
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
      const response = await fetch("/api/imap?action=getAccounts");
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

  // Initialize with empty arrays first
  emails: [],
  contacts: [],
  imapAccounts: [],
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
            name: email.from.name,
            email: email.from.email,
            lastMessageDate: email.date,
            lastMessageSubject: email.subject,
            labels: email.labels,
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
                name: recipient.name,
                email: recipient.email,
                lastMessageDate: email.date,
                lastMessageSubject: email.subject,
                labels: email.labels,
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

  addGroup: (group) => {
    set((state) => ({
      ...state,
      groups: [...state.groups, group],
    }));

    // Persist groups
    if (typeof window !== "undefined") {
      try {
        const savedGroups = localStorage.getItem("groups");
        const groups = savedGroups ? JSON.parse(savedGroups) : [];
        localStorage.setItem("groups", JSON.stringify([...groups, group]));
      } catch (e) {
        console.error("Failed to persist groups to localStorage:", e);
      }
    }
  },

  updateGroup: (group) => {
    set((state) => ({
      ...state,
      groups: state.groups.map((g) => (g.id === group.id ? group : g)),
    }));

    // Persist updated groups
    if (typeof window !== "undefined") {
      try {
        const savedGroups = localStorage.getItem("groups");
        const groups = savedGroups ? JSON.parse(savedGroups) : [];
        const updatedGroups = groups.map((g: Group) =>
          g.id === group.id ? group : g
        );
        localStorage.setItem("groups", JSON.stringify(updatedGroups));
      } catch (e) {
        console.error("Failed to persist groups to localStorage:", e);
      }
    }
  },

  deleteGroup: (groupId) => {
    set((state) => ({
      ...state,
      groups: state.groups.filter((g) => g.id !== groupId),
    }));

    // Update localStorage
    if (typeof window !== "undefined") {
      try {
        const savedGroups = localStorage.getItem("groups");
        const groups = savedGroups ? JSON.parse(savedGroups) : [];
        const filteredGroups = groups.filter((g: Group) => g.id !== groupId);
        localStorage.setItem("groups", JSON.stringify(filteredGroups));
      } catch (e) {
        console.error("Failed to persist groups to localStorage:", e);
      }
    }
  },
}));

// Load persisted data on the client side only
if (typeof window !== "undefined") {
  const persistedData = loadPersistedData();
  useEmailStore.setState(persistedData);
}
