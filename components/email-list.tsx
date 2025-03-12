"use client"

import { useState } from "react"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { useEmailStore } from "@/lib/email-store"
import { ContactItem } from "@/components/contact-item"
import { Skeleton } from "@/components/ui/skeleton"

interface EmailListProps {
  isLoading: boolean
  selectedContact: string | null
  onSelectContact: (email: string) => void
}

export function EmailList({ isLoading, selectedContact, onSelectContact }: EmailListProps) {
  const { contacts } = useEmailStore()
  const [searchQuery, setSearchQuery] = useState("")

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="min-w-[320px] max-w-[320px] border-r border-border flex flex-col overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search"
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-4 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-4 w-[160px]" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredContacts.map((contact) => (
              <ContactItem
                key={contact.email}
                contact={contact}
                isSelected={contact.email === selectedContact}
                onClick={() => onSelectContact(contact.email)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

