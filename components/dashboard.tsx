"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { Menu, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { getCacheValue, setCacheValue, removeCacheValue } from "@/lib/client-cache-browser";
import { cn } from "@/lib/utils";

export function EmailDashboard() {
  const { data: session } = useSession();
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isGroupSelected, setIsGroupSelected] = useState(false);
  const { setEmails, contacts, syncTwilioAccounts, syncJustcallAccounts } = useEmailStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isBackgroundSync, setIsBackgroundSync] = useState(false);
  const initialLoadComplete = useRef(false);

  // Mobile responsive states
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showConversation, setShowConversation] = useState(false);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Enhanced contact selection handler for mobile
  const handleContactSelect = (
    email: string,
    isGroup: boolean = false,
    groupId: string | undefined = undefined
  ) => {
    setSelectedContact(email);
    setIsGroupSelected(isGroup);
    setSelectedGroupId(groupId || null);
    if (isMobileView) {
      setShowConversation(true);
    }
  };

  // Handle back navigation on mobile
  const handleBackToList = () => {
    if (isMobileView) {
      setShowConversation(false);
      setSelectedContact(null);
    }
  };

  useEffect(() => {
    // Try to load cached emails first for immediate display
    const loadCachedEmails = async () => {
      const cachedEmails = await getCacheValue<Email[]>("emails");
      if (cachedEmails && cachedEmails.length > 0) {
        console.log("Loaded", cachedEmails.length, "emails from cache");
        setEmails(cachedEmails);
        // Only set loading to false if we have actual data
        setIsLoading(false);
        initialLoadComplete.current = true;
      } else {
        console.log("No cached emails found or empty cache");
      }
    };

    loadCachedEmails();

    // Only clear cache if explicitly logged out
    if (session === null) {
      removeCacheValue("emails");
      removeCacheValue("emailsTimestamp");
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

        // Sync Twilio accounts
        try {
          await syncTwilioAccounts();
        } catch (error) {
          console.error("Failed to sync Twilio accounts:", error);
        }

        // Sync JustCall accounts
        try {
          await syncJustcallAccounts();
        } catch (error) {
          console.error("Failed to sync JustCall accounts:", error);
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

        // Cache the emails in the database
        await setCacheValue("emails", mergedEmails);
        await setCacheValue("emailsTimestamp", Date.now().toString());

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
    }, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [session, setEmails, syncTwilioAccounts, syncJustcallAccounts]);

  // Set the first contact as selected by default when contacts load
  useEffect(() => {
    // Don't auto-select first contact on initial load
    // Only select if user explicitly requests via UI
    // This allows the welcome screen to show on first load

    // We've removed the auto-selection behavior:
    // if (contacts.length > 0 && !selectedContact) {
    //   setSelectedContact(contacts[0].email);
    //   setIsGroupSelected(false);
    //   setSelectedGroupId(null);
    // }
  }, [contacts, selectedContact]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Mobile Menu Button */}
      <div className={cn(
        "fixed top-0 left-0 z-50 p-2 md:hidden",
        showConversation && "hidden"
      )}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSidebarOpen(true)}
          className="h-10 w-10"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileView && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-background border-r transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        isMobileView ? "md:hidden" : "hidden md:block"
      )}>
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Desktop Layout */}
        <div className="hidden md:flex md:flex-1 md:h-full">
          <ResizablePanelGroup
            direction="horizontal"
            className="flex-1 h-full overflow-hidden"
          > 

            <ResizableHandle />

            {/* Main Area Panel */}
            <ResizablePanel
              defaultSize={85}
              className="flex flex-col h-full overflow-hidden"
            >
              <ResizablePanelGroup
                direction="horizontal"
                className="flex-1 h-full overflow-hidden"
              >
                {/* Channel List Panel */}
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
                  defaultSize={70}
                  className="flex flex-col h-full overflow-hidden"
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

        {/* Mobile Layout */}
        <div className="flex flex-col h-full md:hidden">
          <div className={cn(
            "h-full w-full",
            isMobileView && showConversation ? "hidden" : "block"
          )}>
            <EmailList
              isLoading={isLoading}
              selectedContact={selectedContact}
              onSelectContact={handleContactSelect}
              className="w-full"
            />
          </div>

          <div className={cn(
            "h-full w-full",
            isMobileView && !showConversation ? "hidden" : "block"
          )}>
            {isMobileView && showConversation && (
              <div className="flex items-center gap-2 p-2 border-b">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBackToList}
                  className="h-10 w-10"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </div>
            )}
            <ConversationView
              contactEmail={selectedContact}
              isLoading={isLoading}
              isGroup={isGroupSelected}
              groupId={selectedGroupId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
