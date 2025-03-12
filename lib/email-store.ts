"use client"

import { create } from "zustand"
import type { Email, Contact } from "@/lib/types"
import { MessageCategory } from '@/components/sidebar'

interface EmailStore {
  emails: Email[]
  contacts: Contact[]
  activeFilter: MessageCategory
  setEmails: (emails: Email[]) => void
  setActiveFilter: (filter: MessageCategory) => void
  addEmail: (email: Email) => void
}

export const useEmailStore = create<EmailStore>((set, get) => ({
  emails: [],
  contacts: [],
  activeFilter: "inbox",
  setActiveFilter: (filter) => set({ activeFilter: filter }),
  setEmails: (emails) => {
    set({ emails })

    // Extract unique contacts from emails
    const contactsMap = new Map<string, Contact>()

    emails.forEach((email) => {
      // Add sender as contact (if not the current user)
      if (!email.from.email.includes("me")) {
        const existingContact = contactsMap.get(email.from.email)
        const emailDate = new Date(email.date)

        if (!existingContact || new Date(existingContact.lastMessageDate) < emailDate) {
          contactsMap.set(email.from.email, {
            name: email.from.name,
            email: email.from.email,
            lastMessageDate: email.date,
            lastMessageSubject: email.subject,
            labels: email.labels,
          })
        }
      }

      // Add recipients as contacts
      email.to.forEach((recipient) => {
        if (!recipient.email.includes("me")) {
          const existingContact = contactsMap.get(recipient.email)
          const emailDate = new Date(email.date)

          if (!existingContact || new Date(existingContact.lastMessageDate) < emailDate) {
            contactsMap.set(recipient.email, {
              name: recipient.name,
              email: recipient.email,
              lastMessageDate: email.date,
              lastMessageSubject: email.subject,
              labels: email.labels,
            })
          }
        }
      })
    })

    // Sort contacts by most recent message
    const contacts = Array.from(contactsMap.values()).sort(
      (a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime(),
    )

    set({ contacts })
  },
  addEmail: (email) => {
    const { emails } = get()
    set({ emails: [...emails, email] })

    // Update contacts
    const { contacts } = get()
    const updatedContacts = [...contacts]

    // Handle recipient contact update
    email.to.forEach((recipient) => {
      if (!recipient.email.includes("me")) {
        const existingContactIndex = contacts.findIndex((c) => c.email === recipient.email)
        const emailDate = new Date(email.date)

        if (existingContactIndex === -1) {
          updatedContacts.push({
            name: recipient.name,
            email: recipient.email,
            lastMessageDate: email.date,
            lastMessageSubject: email.subject,
            labels: email.labels,
          })
        } else if (new Date(contacts[existingContactIndex].lastMessageDate) < emailDate) {
          updatedContacts[existingContactIndex] = {
            ...contacts[existingContactIndex],
            lastMessageDate: email.date,
            lastMessageSubject: email.subject,
            labels: email.labels,
          }
        }
      }
    })

    // Sort contacts by most recent message
    updatedContacts.sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime())

    set({ contacts: updatedContacts })
  }
}))

