"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"

import { Sidebar } from "@/components/sidebar"
import { EmailList } from "@/components/email-list"
import { ConversationView } from "@/components/conversation-view"
import { useEmailStore } from "@/lib/email-store"
import { fetchEmails } from "@/lib/gmail-api"

export function EmailDashboard() {
  const { data: session } = useSession()
  const [selectedContact, setSelectedContact] = useState<string | null>(null)
  const { emails, setEmails, contacts } = useEmailStore()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Clear email cache when session changes
    if (!session?.user?.accessToken) {
      localStorage.removeItem("emails")
      localStorage.removeItem("emailsTimestamp")
      setEmails([])
      return
    }

    const loadEmails = async () => {
      if (session?.user?.accessToken) {
        setIsLoading(true)
        try {
          // First try to load from local storage
          const cachedEmails = localStorage.getItem("emails")
          const cachedTimestamp = localStorage.getItem("emailsTimestamp")

          let shouldFetch = true
          if (cachedEmails && cachedTimestamp) {
            const timestamp = Number.parseInt(cachedTimestamp)
            // If cache is less than 5 minutes old, use it
            if (Date.now() - timestamp < 5 * 60 * 1000) {
              setEmails(JSON.parse(cachedEmails))
              shouldFetch = false
            }
          }

          if (shouldFetch) {
            const fetchedEmails = await fetchEmails(session.user.accessToken)
            setEmails(fetchedEmails)

            // Cache the emails
            localStorage.setItem("emails", JSON.stringify(fetchedEmails))
            localStorage.setItem("emailsTimestamp", Date.now().toString())
          }
        } catch (error) {
          console.error("Failed to load emails:", error)
        } finally {
          setIsLoading(false)
        }
      }
    }

    loadEmails()

    // Set up polling for new emails every 2 minutes
    const intervalId = setInterval(
      () => {
        if (session?.user?.accessToken) {
          loadEmails()
        }
      },
      2 * 60 * 1000,
    )

    return () => clearInterval(intervalId)
  }, [session, setEmails])

  // Set the first contact as selected by default when contacts load
  useEffect(() => {
    if (contacts.length > 0 && !selectedContact) {
      setSelectedContact(contacts[0].email)
    }
  }, [contacts, selectedContact])

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 overflow-hidden">
          <EmailList isLoading={isLoading} selectedContact={selectedContact} onSelectContact={setSelectedContact} />
          <ConversationView contactEmail={selectedContact} isLoading={isLoading} />
        </div>
      </div>
    </div>
  )
}

