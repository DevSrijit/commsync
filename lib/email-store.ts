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
}

export const useEmailStore = create<EmailStore>((set, get) => ({
  syncEmails: async (gmailToken: string | null) => {
    const { imapAccounts } = get();
    await SyncService.getInstance().syncAllEmails(gmailToken, imapAccounts);
  },

  emails: [],
  contacts: [],
  activeFilter: "inbox",
  imapAccounts: [],

  setActiveFilter: (filter) => set({ activeFilter: filter }),

  setEmails: (emails) => {
    set({ emails });

    // Extract unique contacts from emails
    const contactsMap = new Map<string, Contact>();

    emails.forEach((email) => {
      // Add sender as contact (if not the current user)
      if (!email.from.email.includes("me")) {
        const existingContact = contactsMap.get(email.from.email);
        const emailDate = new Date(email.date);

        if (
          !existingContact ||
          new Date(existingContact.lastMessageDate) < emailDate
        ) {
          contactsMap.set(email.from.email, {
            name: email.from.name,
            email: email.from.email,
            lastMessageDate: email.date,
            lastMessageSubject: email.subject,
            labels: email.labels,
          });
        }
      }

      // Add recipients as contacts
      email.to.forEach((recipient) => {
        if (!recipient.email.includes("me")) {
          const existingContact = contactsMap.get(recipient.email);
          const emailDate = new Date(email.date);

          if (
            !existingContact ||
            new Date(existingContact.lastMessageDate) < emailDate
          ) {
            contactsMap.set(recipient.email, {
              name: recipient.name,
              email: recipient.email,
              lastMessageDate: email.date,
              lastMessageSubject: email.subject,
              labels: email.labels,
            });
          }
        }
      });
    });

    // Sort contacts by most recent message
    const contacts = Array.from(contactsMap.values()).sort(
      (a, b) =>
        new Date(b.lastMessageDate).getTime() -
        new Date(a.lastMessageDate).getTime()
    );

    set({ contacts });
  },

  addEmail: (email) => {
    const { emails } = get();
    set({ emails: [...emails, email] });

    // Update contacts
    const { contacts } = get();
    const updatedContacts = [...contacts];

    // Handle recipient contact update
    email.to.forEach((recipient) => {
      if (!recipient.email.includes("me")) {
        const existingContactIndex = contacts.findIndex(
          (c) => c.email === recipient.email
        );
        const emailDate = new Date(email.date);

        if (existingContactIndex === -1) {
          updatedContacts.push({
            name: recipient.name,
            email: recipient.email,
            lastMessageDate: email.date,
            lastMessageSubject: email.subject,
            labels: email.labels,
          });
        } else if (
          new Date(contacts[existingContactIndex].lastMessageDate) < emailDate
        ) {
          updatedContacts[existingContactIndex] = {
            ...contacts[existingContactIndex],
            lastMessageDate: email.date,
            lastMessageSubject: email.subject,
            labels: email.labels,
          };
        }
      }
    });

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
    set({ imapAccounts: [...imapAccounts, account] });

    // Save to localStorage for persistence
    localStorage.setItem(
      "imapAccounts",
      JSON.stringify([...imapAccounts, account])
    );
  },

  removeImapAccount: (id) => {
    const { imapAccounts } = get();
    const updated = imapAccounts.filter((account) => account.id !== id);
    set({ imapAccounts: updated });

    // Update localStorage
    localStorage.setItem("imapAccounts", JSON.stringify(updated));
  },

  getImapAccount: (id) => {
    return get().imapAccounts.find((account) => account.id === id);
  },
}));

// Initialize IMAP accounts from localStorage on load
if (typeof window !== "undefined") {
  const savedAccounts = localStorage.getItem("imapAccounts");
  if (savedAccounts) {
    try {
      const accounts = JSON.parse(savedAccounts);
      const store = useEmailStore.getState();
      store.imapAccounts = accounts; // Instead of using .set()
    } catch (e) {
      console.error("Failed to load saved IMAP accounts:", e);
    }
  }
}
