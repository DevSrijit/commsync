"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";

import { Sidebar } from "@/components/sidebar";
import { EmailList } from "@/components/channel-list";
import { ConversationView } from "@/components/conversation-view";
import { useEmailStore } from "@/lib/email-store";
import { fetchEmails } from "@/lib/gmail-api";
import { EmailContentLoader } from "@/lib/email-content-loader";
import { Email } from "@/lib/types";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./ui/resizable";

export function EmailDashboard() {
  const { data: session } = useSession();
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isGroupSelected, setIsGroupSelected] = useState(false);
  const { setEmails, contacts } = useEmailStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isBackgroundSync, setIsBackgroundSync] = useState(false);
  const initialLoadComplete = useRef(false);

  // Enhanced contact selection handler
  const handleContactSelect = (
    email: string,
    isGroup: boolean = false,
    groupId: string | undefined = undefined
  ) => {
    setSelectedContact(email);
    setIsGroupSelected(isGroup);
    setSelectedGroupId(groupId || null);
  };

  useEffect(() => {
    // Try to load cached emails first for immediate display
    const cachedEmails = localStorage.getItem("emails");
    if (cachedEmails) {
      setEmails(JSON.parse(cachedEmails));
      setIsLoading(false);
      initialLoadComplete.current = true;
    }

    // Only clear cache if explicitly logged out
    if (session === null) {
      localStorage.removeItem("emails");
      localStorage.removeItem("emailsTimestamp");
      setEmails([]);
      return;
    }

    const loadEmails = async () => {
      // Only show loading UI for initial load, not background syncs
      if (!initialLoadComplete.current) {
        setIsLoading(true);
      } else {
        setIsBackgroundSync(true);
      }
      
      try {
        // Get current emails from store to merge with new ones
        const currentEmails = useEmailStore.getState().emails;
        const { imapAccounts } = useEmailStore.getState();
        const syncPromises: Promise<Email[]>[] = [];
        
        // Gmail sync if token is available
        if (session?.user?.accessToken) {
          try {
            const fetchedEmails = await fetchEmails(session.user.accessToken);
            syncPromises.push(Promise.resolve(fetchedEmails));
          } catch (error) {
            console.error("Failed to fetch Gmail emails:", error);
          }
        }
        
        // IMAP sync for each account
        for (const account of imapAccounts) {
          try {
            const response = await fetch("/api/imap", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "fetchEmails",
                account,
                data: { page: 1, pageSize: 100 },
              }),
            });
            
            if (!response.ok) {
              throw new Error(`Failed to sync IMAP account ${account.label}`);
            }
            
            const data = await response.json();
            
            // Format emails to ensure they have required properties
            const formattedEmails = data.emails.map((email: any) => ({
              ...email,
              labels: email.labels || [],
              from: email.from || { name: '', email: '' },
              to: email.to || [],
              date: email.date || new Date().toISOString(),
              subject: email.subject || '(No Subject)',
              accountType: 'imap',
              accountId: account.id,
            }));
            
            syncPromises.push(Promise.resolve(formattedEmails));
            
            // Update last sync time
            if (account.id) {
              await fetch("/api/imap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "updateLastSync",
                  data: { accountId: account.id },
                }),
              });
            }
          } catch (error) {
            console.error(`Failed to sync IMAP account:`, error);
          }
        }
        
        // Wait for all syncs to complete
        const results = await Promise.allSettled(syncPromises);
        
        // Combine all successful results
        const allNewEmails: Email[] = [];
        results.forEach((result) => {
          if (result.status === "fulfilled") {
            allNewEmails.push(...result.value);
          }
        });
        
        // Merge with existing emails using Map to avoid duplicates
        const emailMap = new Map<string, Email>();
        [...currentEmails, ...allNewEmails].forEach(email => {
          emailMap.set(email.id, email);
        });
        
        const mergedEmails = Array.from(emailMap.values());
        setEmails(mergedEmails);
        
        // Cache the emails
        localStorage.setItem("emails", JSON.stringify(mergedEmails));
        localStorage.setItem("emailsTimestamp", Date.now().toString());
        
        // Load content for emails that don't have it
        const contentLoader = EmailContentLoader.getInstance();
        const emailsWithoutContent = allNewEmails.filter((email: Email) => !email.body || email.body.length === 0);
        
        // Only load content for a batch of emails to avoid overwhelming the system
        const batchSize = 5;
        for (let i = 0; i < emailsWithoutContent.length; i += batchSize) {
          const batch = emailsWithoutContent.slice(i, i + batchSize);
          await Promise.allSettled(
            batch.map((email: Email) => contentLoader.loadEmailContent(email))
          );
        }
      } catch (error) {
        console.error("Failed to sync emails:", error);
      } finally {
        setIsLoading(false);
        setIsBackgroundSync(false);
        initialLoadComplete.current = true;
      }
    };

    loadEmails();

    // Set up polling for new emails every 2 minutes
    const intervalId = setInterval(() => {
      // For interval syncs, always use background mode
      setIsBackgroundSync(true);
      loadEmails();
    }, 0.5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, [session, setEmails]);

  // Set the first contact as selected by default when contacts load
  useEffect(() => {
    if (contacts.length > 0 && !selectedContact) {
      setSelectedContact(contacts[0].email);
      setIsGroupSelected(false);
      setSelectedGroupId(null);
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
        <ResizablePanel
          className="flex flex-col h-full overflow-hidden"
          defaultSize={85}
        >
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
                  onSelectContact={handleContactSelect}
                  className="w-full"
                />
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Conversation View Panel */}
            <ResizablePanel
              className="flex flex-col h-full overflow-hidden"
              defaultSize={70}
            >
              <ConversationView
                contactEmail={selectedContact}
                isLoading={isLoading}
                isGroup={isGroupSelected}
                groupId={selectedGroupId}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
