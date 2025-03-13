"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { Sidebar } from "@/components/sidebar";
import { EmailList } from "@/components/channel-list";
import { ConversationView } from "@/components/conversation-view";
import { useEmailStore } from "@/lib/email-store";
import { fetchEmails } from "@/lib/gmail-api";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./ui/resizable";
import { ImapAccountCard } from "@/components/imap-account-card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ImapAccountDialog } from "@/components/imap-account-dialog";

export function EmailDashboard() {
  const { data: session } = useSession();
  const [selectedContact, setSelectedContact] = useState(null);
  const { emails, setEmails, contacts, imapAccounts, syncEmails } = useEmailStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isImapDialogOpen, setIsImapDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState("emails"); // "emails" or "accounts"

  useEffect(() => {
    // Try to load cached emails first, regardless of session
    const cachedEmails = localStorage.getItem("emails");
    if (cachedEmails) {
      setEmails(JSON.parse(cachedEmails));
      setIsLoading(false);
    }

    // Only clear cache if explicitly logged out
    if (session === null) {
      localStorage.removeItem("emails");
      localStorage.removeItem("emailsTimestamp");
      setEmails([]);
      return;
    }

    const loadEmails = async () => {
      if (session?.user?.accessToken) {
        setIsLoading(true);
        try {
          let shouldFetch = true;
          const cachedTimestamp = localStorage.getItem("emailsTimestamp");

          if (cachedTimestamp) {
            const timestamp = Number.parseInt(cachedTimestamp);
            // If cache is less than 5 minutes old, skip fetch
            if (Date.now() - timestamp < 5 * 60 * 1000) {
              shouldFetch = false;
            }
          }

          if (shouldFetch) {
            try {
              // Fetch emails from Gmail API
              const fetchedEmails = await fetchEmails(session.user.accessToken);
              setEmails(fetchedEmails);

              // Cache the emails
              localStorage.setItem("emails", JSON.stringify(fetchedEmails));
              localStorage.setItem("emailsTimestamp", Date.now().toString());
              
              // Also sync IMAP accounts
              syncEmails(session.user.accessToken);
            } catch (fetchError) {
              console.error("Failed to fetch new emails:", fetchError);
              // Keep using cached data, don't clear it
            }
          }
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadEmails();

    // Set up polling for new emails every 0.5 minutes
    const intervalId = setInterval(() => {
      if (session?.user?.accessToken) {
        loadEmails();
      }
    }, 0.5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [session, setEmails, syncEmails]);

  // Set the first contact as selected by default when contacts load
  useEffect(() => {
    if (contacts.length > 0 && !selectedContact) {
      setSelectedContact(contacts[0].email);
    }
  }, [contacts, selectedContact]);

  // Render the accounts management view
  const renderAccountsView = () => {
    return (
      <div className="container mx-auto p-4 h-full overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Email Accounts</h1>
          <Button onClick={() => setIsImapDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add IMAP Account
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {imapAccounts.map((account) => (
            <ImapAccountCard key={account.id} account={account} />
          ))}
        </div>
        <ImapAccountDialog
          open={isImapDialogOpen}
          onOpenChange={setIsImapDialogOpen}
        />
      </div>
    );
  };

  // Render the main email interface
  const renderEmailView = () => {
  return (
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
          <Sidebar onViewModeChange={setViewMode} currentViewMode={viewMode} />
        </ResizablePanel>

        <ResizableHandle />

        {/* Main Area Panel */}
        <ResizablePanel className="flex flex-col h-full overflow-hidden" defaultSize={85}>
          {viewMode === "emails" ? (
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
            <ResizablePanel className="flex flex-col h-full overflow-hidden" defaultSize={70}>
              <ConversationView
                contactEmail={selectedContact}
                isLoading={isLoading}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
          ) : (
            renderAccountsView()
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {renderEmailView()}
    </div>
  );
}