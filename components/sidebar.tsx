"use client";

import { signOut, useSession } from "next-auth/react";
import {
  Archive,
  ChevronDown,
  Inbox,
  LogOut,
  Mail,
  MessageSquarePlus,
  PenSquare,
  Send,
  Star,
  Trash,
  User,
  X,
  Plus,
  Settings,
  Server,
  MessageSquare,
  Phone,
  Users,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  ExternalLink,
  BarChart3,
  CircleAlert,
  DownloadCloud,
  MailPlus,
  RefreshCw,
  Palette,
  Sun,
  Moon,
  UsersRound,
} from "lucide-react";
import { SiTwilio } from "@icons-pack/react-simple-icons";
import { Button } from "@/components/ui/button";
import { useEmailStore } from "@/lib/email-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "./ui/separator";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback, useRef } from "react";
import { MessageComposer } from "./message-composer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageInput } from "./message-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImapAccountDialog } from "./imap-account-dialog";
import { JustCallAccountDialog } from "./justcall-account-dialog";
import { JustCallAccountCard } from "./justcall-account-card";
import { Badge } from "./ui/badge";
import { ImapAccountCard } from "./imap-account-card";
import GroupDialog from "./group-dialog";
import { TwilioAccountDialog } from "./twilio-account-dialog";
import { useToast } from "@/components/ui/use-toast";
import { EmailContentLoader } from "@/lib/email-content-loader";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { formatStorage, formatTierName, StoredSubscriptionData, getStoredSubscriptionData, isStoredSubscriptionStale } from "@/lib/subscription";
import { PlanType } from "@/lib/stripe";
import { useSubscription } from "@/hooks/use-subscription";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useTheme } from "next-themes";
import { OrganizationDialog } from "./organization-dialog";

export type MessageCategory =
  | "inbox"
  | "draft"
  | "sent"
  | "starred"
  | "trash"
  | "archive"
  | "sms"
  | "contacts"
  | "all";

export function Sidebar() {
  const { data: session } = useSession();
  const { emails, setActiveFilter, activeFilter, imapAccounts, groups } =
    useEmailStore();
  const { toast } = useToast();
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isImapDialogOpen, setIsImapDialogOpen] = useState(false);
  const [isJustCallDialogOpen, setIsJustCallDialogOpen] = useState(false);
  const [isImapListOpen, setIsImapListOpen] = useState(false);
  const [isJustCallListOpen, setIsJustCallListOpen] = useState(false);
  const [isTwilioListOpen, setIsTwilioListOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [justCallAccounts, setJustCallAccounts] = useState<any[]>([]);
  const [twilioAccounts, setTwilioAccounts] = useState<any[]>([]);
  const [isTwilioDialogOpen, setIsTwilioDialogOpen] = useState(false);
  const [isSyncingSMS, setIsSyncingSMS] = useState(false);
  const [isSyncingEmail, setIsSyncingEmail] = useState(false);
  const [isOrganizationDialogOpen, setIsOrganizationDialogOpen] = useState(false);

  // State for account collapsible sections
  const [isEmailAccountsOpen, setIsEmailAccountsOpen] = useState(true);
  const [isSMSAccountsOpen, setIsSMSAccountsOpen] = useState(true);

  // Use useRef to store subscription data and avoid re-renders
  const subscriptionDataRef = useRef<StoredSubscriptionData | null>(null);
  const [subscriptionData, setSubscriptionData] = useState<StoredSubscriptionData | null>(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);

  // Use the subscription hook
  const { fetchSubscription, updateSubscription } = useSubscription();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loadPageSize, setLoadPageSize] = useState(100);

  const { setTheme } = useTheme();

  // Function to fetch subscription data without causing re-renders
  const updateSubscriptionDataBackground = useCallback(async () => {
    if (!session?.user) return;

    try {
      const data = await fetchSubscription();
      if (data) {
        // Store in ref
        subscriptionDataRef.current = data;

        // Only update state if there are significant changes to minimize re-renders
        if (!subscriptionData ||
          data.usedStorage !== subscriptionData.usedStorage ||
          data.usedConnections !== subscriptionData.usedConnections ||
          data.usedAiCredits !== subscriptionData.usedAiCredits ||
          data.status !== subscriptionData.status) {
          setSubscriptionData(data);
        }
      }
    } catch (error) {
      console.error('Error fetching subscription data in background:', error);
    }
  }, [session?.user, fetchSubscription, subscriptionData]);

  // Initial fetch of subscription data
  useEffect(() => {
    const getSubscriptionData = async () => {
      if (!session?.user) return;

      try {
        // Only show loading state on initial load
        if (!subscriptionData) {
          setIsLoadingSubscription(true);
        }

        // First try to get from local storage for immediate display
        const storedData = getStoredSubscriptionData();
        if (storedData && !isStoredSubscriptionStale()) {
          setSubscriptionData(storedData);
          subscriptionDataRef.current = storedData;
          setIsLoadingSubscription(false);
        }

        // Then fetch the latest data from server
        const data = await fetchSubscription();
        if (data) {
          // Only update if something changed
          if (!subscriptionData ||
            data.usedStorage !== (subscriptionData?.usedStorage || 0) ||
            data.usedConnections !== (subscriptionData?.usedConnections || 0) ||
            data.usedAiCredits !== (subscriptionData?.usedAiCredits || 0) ||
            data.status !== subscriptionData?.status) {
            setSubscriptionData(data);
            subscriptionDataRef.current = data;
          }
        }
      } catch (error) {
        console.error('Error fetching subscription data:', error);
      } finally {
        setIsLoadingSubscription(false);
      }
    };

    getSubscriptionData();
  }, [session?.user, fetchSubscription, subscriptionData]);

  // Set up an interval to update subscription data in the background
  useEffect(() => {
    // Skip if no user session
    if (!session?.user) return;

    // Set up interval for periodic background updates (every 5 minutes)
    const intervalId = setInterval(() => {
      updateSubscriptionDataBackground();
    }, 5 * 60 * 1000);

    // Clear interval on unmount
    return () => clearInterval(intervalId);
  }, [session?.user, updateSubscriptionDataBackground]);

  // Refresh subscription data when accounts change
  useEffect(() => {
    if (imapAccounts.length > 0 || justCallAccounts.length > 0 || twilioAccounts.length > 0) {
      updateSubscriptionDataBackground();
    }
  }, [imapAccounts.length, justCallAccounts.length, twilioAccounts.length, updateSubscriptionDataBackground]);

  // Fetch JustCall accounts
  useEffect(() => {
    const fetchJustCallAccounts = async () => {
      try {
        const response = await fetch('/api/justcall/account');
        if (response.ok) {
          const data = await response.json();
          setJustCallAccounts(data);
        }
      } catch (error) {
        console.error('Error fetching JustCall accounts:', error);
      }
    };

    // Fetch Twilio accounts
    const fetchTwilioAccounts = async () => {
      try {
        const response = await fetch('/api/twilio/account');
        if (response.ok) {
          const data = await response.json();
          setTwilioAccounts(data);
        }
      } catch (error) {
        console.error('Error fetching Twilio accounts:', error);
      }
    };

    if (session?.user) {
      fetchJustCallAccounts();
      fetchTwilioAccounts();
    }

    // Add event listeners for account updates
    const handleJustCallAccountsUpdated = (event: CustomEvent) => {
      setJustCallAccounts(event.detail);
    };

    const handleTwilioAccountsUpdated = (event: CustomEvent) => {
      setTwilioAccounts(event.detail);
    };

    window.addEventListener('justcall-accounts-updated', handleJustCallAccountsUpdated as EventListener);
    window.addEventListener('twilio-accounts-updated', handleTwilioAccountsUpdated as EventListener);

    return () => {
      window.removeEventListener('justcall-accounts-updated', handleJustCallAccountsUpdated as EventListener);
      window.removeEventListener('twilio-accounts-updated', handleTwilioAccountsUpdated as EventListener);
    };
  }, [session?.user]);

  // Log IMAP accounts when they change
  useEffect(() => {
    console.log(`Sidebar: IMAP accounts updated - ${imapAccounts.length} accounts found`);
    if (imapAccounts.length > 0) {
      console.log('IMAP account labels:', imapAccounts.map(acc => acc.label));
    }
  }, [imapAccounts]);

  const inboxCount = emails.filter(
    (email) =>
      !(email.labels?.includes("TRASH") || email.labels?.includes("SENT"))
  ).length;
  const draftCount = emails.filter((email) =>
    email.labels?.includes("DRAFT")
  ).length;
  const sentCount = emails.filter((email) =>
    email.labels?.includes("SENT")
  ).length;
  const trashCount = emails.filter((email) =>
    email.labels?.includes("TRASH")
  ).length;
  const starredCount = emails.filter((email) =>
    email.labels?.includes("STARRED")
  ).length;
  const archiveCount = emails.filter((email) =>
    email.labels?.includes("ARCHIVE")
  ).length;

  const smsCount = emails.filter(email =>
    email.accountType === 'twilio' ||
    email.accountType === 'justcall' ||
    (email.labels && email.labels.includes('SMS'))
  ).length;

  const contactsCount = groups?.length || 0;

  // Calculate subscription-related values
  const storageUsed = subscriptionData?.usedStorage || 0;
  const storageLimit = subscriptionData?.totalStorage || 100; // Default 100MB for Lite
  const connectionsUsed = subscriptionData?.usedConnections || 1;
  const connectionsLimit = subscriptionData?.totalConnections || 6; // Default 6 connections for Lite
  const aiCreditsUsed = subscriptionData?.usedAiCredits || 0;
  const aiCreditsLimit = subscriptionData?.totalAiCredits || 25; // Default 25 credits for Lite

  // Format values for display
  const formattedStorageUsed = formatStorage(storageUsed);
  const formattedStorageLimit = formatStorage(storageLimit);
  const storagePercentage = Math.min(100, (storageUsed / storageLimit) * 100);
  const connectionsPercentage = Math.min(100, (connectionsUsed / connectionsLimit) * 100);
  const aiCreditsPercentage = Math.min(100, (aiCreditsUsed / aiCreditsLimit) * 100);

  // Get subscription tier
  const subscriptionTier = subscriptionData?.planType
    ? formatTierName(subscriptionData.planType)
    : "Standard";

  // Determine if subscription is active
  const hasActiveSubscription = subscriptionData?.status === 'active' ||
    subscriptionData?.status === 'trialing';

  // Message filter buttons, extracted for cleaner code
  const MessageFilterButton = ({
    icon: Icon,
    label,
    filter,
    count
  }: {
    icon: React.ElementType,
    label: string,
    filter: MessageCategory,
    count: number
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "w-full justify-start mb-0.5 px-2 py-1.5 text-sm font-medium rounded-md h-9",
        activeFilter === filter
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent/50 hover:text-accent-foreground"
      )}
      onClick={() => setActiveFilter(filter)}
    >
      <Icon className="h-4 w-4 mr-2" />
      <span className="flex-1 text-left">{label}</span>
      {count > 0 && (
        <Badge variant="secondary" className="ml-auto font-normal">
          {count}
        </Badge>
      )}
    </Button>
  );

  useEffect(() => {
    // Load saved page size from localStorage
    const savedPageSize = localStorage.getItem('loadPageSize');
    if (savedPageSize) {
      setLoadPageSize(parseInt(savedPageSize));
    }
  }, []);

  const handlePageSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = parseInt(event.target.value);
    setLoadPageSize(newSize);
    localStorage.setItem('loadPageSize', newSize.toString());

    // Update the store with the new page size
    const store = useEmailStore.getState();
    store.setLoadPageSize(newSize);
  };

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col border-r border-border bg-card overflow-hidden">
        <div className="p-4 pb-0 flex-shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={session?.user?.image || `https://api.dicebear.com/9.x/glass/svg?radius=50&seed=${session?.user?.email}&randomizeIds=true`} />
              <AvatarFallback>
                {session?.user?.name?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{session?.user?.name || "User"}</p>
              <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-lg border border-border/40 backdrop-blur-sm">
                <DropdownMenuLabel className="font-medium text-sm">Account</DropdownMenuLabel>
                <DropdownMenuItem asChild className="flex items-center gap-2 cursor-pointer">
                  <a href="/settings/subscription">
                    <CreditCard className="mr-2 h-4 w-4" />
                    <span>Subscription</span>
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsOrganizationDialogOpen(true)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <UsersRound className="mr-2 h-4 w-4" />
                  <span>Organization</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSettingsOpen(true)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Preferences</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="font-medium text-xs px-2 pt-2">Theme</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => setTheme("light")}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Sun className="mr-2 h-4 w-4" />
                  <span>Light</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme("dark")}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Moon className="mr-2 h-4 w-4" />
                  <span>Dark</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme("system")}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <div className="mr-2 h-4 w-4 flex items-center justify-center">💻</div>
                  <span>System</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="flex items-center gap-2 text-destructive cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="rounded-lg p-3 bg-muted/40 border border-border/50 mb-4 backdrop-filter backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Badge variant={hasActiveSubscription ? "default" : "secondary"} className="font-medium">
                  {subscriptionTier}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {isLoadingSubscription ? 'Loading...' : formattedStorageLimit}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Storage</span>
                  <span className="font-medium">
                    {isLoadingSubscription ? '...' : `${formattedStorageUsed}/${formattedStorageLimit}`}
                  </span>
                </div>
                <Progress
                  value={storagePercentage}
                  className={cn(
                    "h-1.5 rounded-sm",
                    storagePercentage > 90
                      ? "bg-destructive/20"
                      : storagePercentage > 70
                        ? "bg-warning/20"
                        : "bg-primary/20"
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Connections</span>
                  <span className="font-medium">
                    {isLoadingSubscription ? '...' : `${connectionsUsed}/${connectionsLimit}`}
                  </span>
                </div>
                <Progress
                  value={connectionsPercentage}
                  className={cn(
                    "h-1.5 rounded-sm",
                    connectionsPercentage > 90
                      ? "bg-destructive/20"
                      : connectionsPercentage > 70
                        ? "bg-warning/20"
                        : "bg-primary/20"
                  )}
                />
              </div>

              {hasActiveSubscription && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">AI Credits</span>
                    <span className="font-medium">
                      {isLoadingSubscription ? '...' : `${aiCreditsUsed}/${aiCreditsLimit}`}
                    </span>
                  </div>
                  <Progress
                    value={aiCreditsPercentage}
                    className={cn(
                      "h-1.5 rounded-sm",
                      aiCreditsPercentage > 90
                        ? "bg-destructive/20"
                        : aiCreditsPercentage > 70
                          ? "bg-warning/20"
                          : "bg-primary/20"
                    )}
                  />
                </div>
              )}
            </div>
          </div>

          <Button
            variant="default"
            className="w-full mb-4"
            size="sm"
            onClick={() => setIsComposerOpen(true)}
          >
            <PenSquare className="h-4 w-4 mr-2" />
            Compose
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="py-1 px-2">
            <div className="space-y-4">
              {/* Primary Message Filters */}
              <div className="space-y-0.5">
                <MessageFilterButton
                  icon={Inbox}
                  label="Inbox"
                  filter="inbox"
                  count={inboxCount}
                />
                <MessageFilterButton
                  icon={Star}
                  label="Starred"
                  filter="starred"
                  count={starredCount}
                />
                <MessageFilterButton
                  icon={Send}
                  label="Sent"
                  filter="sent"
                  count={sentCount}
                />
                <MessageFilterButton
                  icon={PenSquare}
                  label="Drafts"
                  filter="draft"
                  count={draftCount}
                />
                <MessageFilterButton
                  icon={MessageSquare}
                  label="SMS"
                  filter="sms"
                  count={smsCount}
                />
                <MessageFilterButton
                  icon={Users}
                  label="Contacts"
                  filter="contacts"
                  count={contactsCount}
                />
                <MessageFilterButton
                  icon={Archive}
                  label="Archive"
                  filter="archive"
                  count={archiveCount}
                />
                <MessageFilterButton
                  icon={Trash}
                  label="Trash"
                  filter="trash"
                  count={trashCount}
                />
              </div>

              {/* Sync Buttons */}
              <div className="space-y-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start rounded-md"
                  disabled={isSyncingSMS}
                  onClick={async () => {
                    // Check for storage limit
                    const currentData = subscriptionDataRef.current || subscriptionData;
                    if (currentData && currentData.usedStorage >= currentData.totalStorage) {
                      toast({
                        title: "Storage limit reached",
                        description: "Please delete some conversations or upgrade your plan to continue syncing.",
                        variant: "destructive",
                      });
                      return;
                    }

                    try {
                      setIsSyncingSMS(true);
                      await Promise.all([
                        useEmailStore.getState().syncTwilioAccounts(),
                        useEmailStore.getState().syncJustcallAccounts()
                      ]);

                      // Update subscription usage after sync
                      const updated = await updateSubscription();
                      if (updated) {
                        setSubscriptionData(updated);
                        subscriptionDataRef.current = updated;
                      }
                    } catch (error) {
                      console.error("Error syncing SMS messages:", error);
                    } finally {
                      setIsSyncingSMS(false);
                    }
                  }}
                >
                  <div className="flex items-center w-full">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    <span className="flex-1 text-left text-xs">Sync SMS</span>
                    {isSyncingSMS && (
                      <span className="ml-2 animate-spin">⟳</span>
                    )}
                  </div>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start rounded-md"
                  disabled={isSyncingEmail}
                  onClick={async () => {
                    // Check for storage limit
                    const currentData = subscriptionDataRef.current || subscriptionData;
                    if (currentData && currentData.usedStorage >= currentData.totalStorage) {
                      toast({
                        title: "Storage limit reached",
                        description: "Please delete some conversations or upgrade your plan to continue syncing.",
                        variant: "destructive",
                      });
                      return;
                    }

                    try {
                      setIsSyncingEmail(true);

                      // Sync Gmail messages if access token is available
                      if (session?.user?.accessToken) {
                        try {
                          console.log("Syncing Gmail messages");
                          await useEmailStore.getState().syncEmails(session.user.accessToken);
                          console.log("Gmail sync complete");
                        } catch (error) {
                          console.error("Error syncing Gmail messages:", error);
                        }
                      }

                      // Sync all IMAP accounts
                      const { imapAccounts } = useEmailStore.getState();
                      const contentLoader = EmailContentLoader.getInstance();
                      let totalEmailsLoaded = 0;

                      for (const account of imapAccounts) {
                        try {
                          console.log(`Syncing account: ${account.label}`);

                          // Fetch emails for this account
                          const response = await fetch("/api/imap", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                              action: "fetchEmails",
                              account,
                              data: {
                                page: 1,
                                pageSize: 100,
                              },
                            }),
                          });

                          if (!response.ok) {
                            console.error(`Failed to sync emails for ${account.label}`);
                            continue; // Skip to next account on error
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

                          // Update the email store with fetched emails
                          const store = useEmailStore.getState();
                          store.setEmails([...store.emails, ...formattedEmails]);
                          totalEmailsLoaded += formattedEmails.length;

                          // Update last sync time
                          if (account.id) {
                            await fetch("/api/imap", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({
                                action: "updateLastSync",
                                data: {
                                  accountId: account.id,
                                }
                              }),
                            });
                          }

                          // Load content for emails that don't have it
                          const emailsWithoutContent = formattedEmails.filter((email: any) => !email.body || email.body.length === 0);

                          // Load content for up to 5 emails at a time
                          if (emailsWithoutContent.length > 0) {
                            const batchSize = 5;
                            for (let i = 0; i < emailsWithoutContent.length; i += batchSize) {
                              const batch = emailsWithoutContent.slice(i, i + batchSize);
                              await Promise.allSettled(
                                batch.map((email: any) => contentLoader.loadEmailContent(email))
                              );
                            }
                          }
                        } catch (error) {
                          console.error(`Error syncing account ${account.label}:`, error);
                        }
                      }

                      // Update subscription usage after sync
                      const updated = await updateSubscription();
                      if (updated) {
                        setSubscriptionData(updated);
                        subscriptionDataRef.current = updated;
                      }

                      // Show toast notification with results
                      if (totalEmailsLoaded > 0) {
                        toast({
                          title: "Sync successful",
                          description: `Synced ${totalEmailsLoaded} emails from ${imapAccounts.length} accounts${session?.user?.accessToken ? ' and Gmail' : ''}`,
                        });
                      } else {
                        toast({
                          title: "Sync complete",
                          description: session?.user?.accessToken
                            ? "No new emails found from IMAP accounts or Gmail"
                            : "No new emails found",
                        });
                      }
                    } catch (error) {
                      console.error("Error syncing IMAP accounts:", error);
                      toast({
                        title: "Sync failed",
                        description: "Failed to sync emails. Please try again.",
                        variant: "destructive",
                      });
                    } finally {
                      setIsSyncingEmail(false);
                    }
                  }}
                >
                  <div className="flex items-center w-full">
                    <Mail className="h-4 w-4 mr-2" />
                    <span className="flex-1 text-left text-xs">Sync Email</span>
                    {isSyncingEmail && (
                      <span className="ml-2 animate-spin">⟳</span>
                    )}
                  </div>
                </Button>
              </div>

              {/* Account Sections */}
              <div className="space-y-3">
                <div className="px-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Accounts
                    </h3>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onClick={() => setIsImapDialogOpen(true)} className="gap-2">
                          <Mail className="h-4 w-4" />
                          <span>Email Account</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsJustCallDialogOpen(true)} className="gap-2">
                          <Phone className="h-4 w-4" />
                          <span>JustCall Account</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsTwilioDialogOpen(true)} className="gap-2">
                          <SiTwilio className="h-4 w-4" />
                          <span>Twilio Account</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setIsGroupDialogOpen(true)} className="gap-2">
                          <Users className="h-4 w-4" />
                          <span>Manage Contact</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Email Accounts Collapsible */}
                <Collapsible
                  open={isEmailAccountsOpen}
                  onOpenChange={setIsEmailAccountsOpen}
                  className="px-2"
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex w-full justify-between px-2 py-1 h-8 font-medium text-sm"
                    >
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-2" />
                        <span>Email Accounts</span>
                      </div>
                      <Badge variant="outline" className="ml-auto mr-2 font-normal">
                        {imapAccounts.length}
                      </Badge>
                      <ChevronRight className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        isEmailAccountsOpen ? "transform rotate-90" : ""
                      )} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-1 pb-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start mb-1 px-2 py-1 text-xs rounded-md"
                      onClick={() => setIsImapListOpen(true)}
                    >
                      <span className="flex-1 text-left">Manage email accounts</span>
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                    <div className="space-y-1">
                      {imapAccounts.map((account) => (
                        <div key={account.id} className="px-2 py-1 text-sm flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-blue-400"></span>
                          <span className="truncate text-xs">{account.label}</span>
                        </div>
                      ))}
                      {imapAccounts.length === 0 && (
                        <div className="px-2 py-1 text-xs text-muted-foreground italic">
                          No accounts added
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* SMS Accounts Collapsible */}
                <Collapsible
                  open={isSMSAccountsOpen}
                  onOpenChange={setIsSMSAccountsOpen}
                  className="px-2"
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex w-full justify-between px-2 py-1 h-8 font-medium text-sm"
                    >
                      <div className="flex items-center">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        <span>SMS Accounts</span>
                      </div>
                      <Badge variant="outline" className="ml-auto mr-2 font-normal">
                        {justCallAccounts.length + twilioAccounts.length}
                      </Badge>
                      <ChevronRight className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        isSMSAccountsOpen ? "transform rotate-90" : ""
                      )} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-1 pb-2 space-y-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start px-2 py-1 text-xs rounded-md"
                      onClick={() => setIsJustCallListOpen(true)}
                    >
                      <span className="flex-1 text-left">JustCall accounts</span>
                      <Badge variant="outline" className="ml-auto font-normal">
                        {justCallAccounts.length}
                      </Badge>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start px-2 py-1 text-xs rounded-md"
                      onClick={() => setIsTwilioListOpen(true)}
                    >
                      <span className="flex-1 text-left">Twilio accounts</span>
                      <Badge variant="outline" className="ml-auto font-normal">
                        {twilioAccounts.length}
                      </Badge>
                    </Button>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-border flex-shrink-0 mt-auto">
          <div className="w-full rounded-md border border-dashed p-2.5 flex items-center justify-between">
            <div className="text-xs">
              <p className="font-medium">Need help?</p>
              <p className="text-muted-foreground" onClick={() => window.open("#", "_blank")}>Contact support</p>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => window.open("mailto:commsync@havenmediasolutions.com", "_blank")}>
              Support
            </Button>
          </div>
        </div>

        {/* IMAP Accounts Dialog */}
        <Dialog open={isImapListOpen} onOpenChange={setIsImapListOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Email Accounts</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setIsImapListOpen(false);
                  setIsImapDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Email Account
              </Button>
              <div className="space-y-2">
                {imapAccounts.map((account) => (
                  <ImapAccountCard key={account.id} account={account} />
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* JustCall Accounts Dialog */}
        <Dialog open={isJustCallListOpen} onOpenChange={setIsJustCallListOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>JustCall Accounts</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setIsJustCallListOpen(false);
                  setIsJustCallDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add JustCall Account
              </Button>
              <div className="space-y-2">
                {justCallAccounts.map((account) => (
                  <JustCallAccountCard
                    key={account.id}
                    id={account.id}
                    phoneNumber={account.accountIdentifier}
                    label={account.platform}
                    lastSync={account.lastSync}
                  />
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Twilio Accounts Dialog */}
        <Dialog open={isTwilioListOpen} onOpenChange={setIsTwilioListOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Twilio Accounts</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setIsTwilioListOpen(false);
                  setIsTwilioDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Twilio Account
              </Button>
              <div className="space-y-2">
                {twilioAccounts.map((account) => (
                  <div key={account.id} className="bg-card rounded-lg border p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{account.label}</h3>
                        <p className="text-sm text-muted-foreground">{account.phoneNumber}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Last sync: {new Date(account.lastSync).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={async () => {
                          if (confirm("Are you sure you want to delete this account?")) {
                            try {
                              const response = await fetch(`/api/twilio/account?id=${account.id}`, {
                                method: "DELETE",
                              });
                              if (response.ok) {
                                setTwilioAccounts(accounts =>
                                  accounts.filter(a => a.id !== account.id)
                                );
                              }
                            } catch (error) {
                              console.error("Error deleting account:", error);
                            }
                          }
                        }}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Message Composer */}
        <MessageComposer
          open={isComposerOpen}
          onOpenChange={setIsComposerOpen}
          onSend={async (recipients, subject, content, attachments) => {
            // This is a fallback and won't be used with our new implementation
            console.log("Legacy send method called");
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }}
        />

        {/* IMAP Account Dialog */}
        <ImapAccountDialog
          open={isImapDialogOpen}
          onOpenChange={setIsImapDialogOpen}
        />

        {/* JustCall Account Dialog */}
        <JustCallAccountDialog
          open={isJustCallDialogOpen}
          onOpenChange={setIsJustCallDialogOpen}
        />

        {/* Twilio Account Dialog */}
        <TwilioAccountDialog
          open={isTwilioDialogOpen}
          onOpenChange={setIsTwilioDialogOpen}
        />

        {/* Add Group Dialog */}
        <GroupDialog
          open={isGroupDialogOpen}
          onOpenChange={setIsGroupDialogOpen}
        />

        {/* Settings Dialog */}
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="sm:max-w-md rounded-xl border-border/40 backdrop-blur-sm">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">Preferences</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Configure your messaging experience
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="loadPageSize" className="text-sm font-medium">
                  Messages per load
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Choose how many messages to fetch when clicking "Load more"
                </p>
                <select
                  id="loadPageSize"
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={loadPageSize}
                  onChange={handlePageSizeChange}
                >
                  <option value="100">100 messages</option>
                  <option value="200">200 messages</option>
                  <option value="500">500 messages</option>
                  <option value="1000">1000 messages</option>
                  <option value="5000">5000 messages</option>
                </select>
              </div>
            </div>

            <DialogFooter className="flex justify-end space-x-2">
              <Button
                onClick={() => setSettingsOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium"
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Organization Dialog */}
        <OrganizationDialog
          open={isOrganizationDialogOpen}
          onOpenChange={setIsOrganizationDialogOpen}
        />
      </div>
    </TooltipProvider>
  );
}
