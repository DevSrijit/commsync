"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { Sidebar } from "@/components/sidebar";
import { EmailList } from "@/components/email-list";
import { ConversationView } from "@/components/conversation-view";
import { useEmailStore } from "@/lib/email-store";
import { fetchEmails } from "@/lib/gmail-api";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";

export function EmailDashboard() {
  const { data: session } = useSession();
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const { emails, setEmails, contacts } = useEmailStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Clear email cache when session changes
    if (!session?.user?.accessToken) {
      localStorage.removeItem("emails");
      localStorage.removeItem("emailsTimestamp");
      setEmails([]);
      return;
    }

    const loadEmails = async () => {
      if (session?.user?.accessToken) {
        setIsLoading(true);
        try {
          // First try to load from local storage
          const cachedEmails = localStorage.getItem("emails");
          const cachedTimestamp = localStorage.getItem("emailsTimestamp");

          // Load cached emails if available
          if (cachedEmails) {
            setEmails(JSON.parse(cachedEmails));
          }

          let shouldFetch = true;
          if (cachedTimestamp) {
            const timestamp = Number.parseInt(cachedTimestamp);
            // If cache is less than 5 minutes old, skip fetch
            if (Date.now() - timestamp < 5 * 60 * 1000) {
              shouldFetch = false;
            }
          }

          if (shouldFetch) {
            try {
              const fetchedEmails = await fetchEmails(session.user.accessToken);
              setEmails(fetchedEmails);

              // Cache the emails
              localStorage.setItem("emails", JSON.stringify(fetchedEmails));
              localStorage.setItem("emailsTimestamp", Date.now().toString());
            } catch (fetchError) {
              console.error("Failed to fetch new emails:", fetchError);
              // Keep using cached data, don't clear it
            }
          }
        } catch (error) {
          console.error("Failed to load emails:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadEmails();

    // Set up polling for new emails every 2 minutes
    const intervalId = setInterval(() => {
      if (session?.user?.accessToken) {
        loadEmails();
      }
    }, 2 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [session, setEmails]);

  // Set the first contact as selected by default when contacts load
  useEffect(() => {
    if (contacts.length > 0 && !selectedContact) {
      setSelectedContact(contacts[0].email);
    }
  }, [contacts, selectedContact]);

  return (
    /**
     * Full-screen container with overflow hidden so only the panels themselves scroll.
     */
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 h-full overflow-hidden"
      >
        {/* Sidebar Panel */}
        <ResizablePanel
          defaultSize={15}
          minSize={15}
          maxSize={20}
          className="h-full overflow-hidden"
        >
          <Sidebar />
        </ResizablePanel>

        <ResizableHandle />

        {/* Main Area Panel */}
        <ResizablePanel className="flex flex-col h-full overflow-hidden">
          <ResizablePanelGroup
            direction="horizontal"
            className="flex-1 h-full overflow-hidden"
          >
            {/* Contact List Panel */}
            <ResizablePanel
              defaultSize={30}
              minSize={25}
              maxSize={40}
              className="h-full"
            >
              <div className="w-full h-full z-0">
                <EmailList
                  isLoading={isLoading}
                  selectedContact={selectedContact}
                  onSelectContact={setSelectedContact}
                  className="w-full"
                />
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Conversation View Panel */}
            <ResizablePanel className="flex flex-col h-full overflow-hidden">
              <ConversationView
                contactEmail={selectedContact}
                isLoading={isLoading}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
