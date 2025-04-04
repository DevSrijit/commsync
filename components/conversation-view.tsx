"use client";

import { useState, useEffect, useMemo } from "react";
import { MessageInput } from "@/components/message-input";
import { formatDistanceToNow } from "date-fns";
import { useEmailStore } from "@/lib/email-store";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Image, FileText, File, Users, MessageSquare, Mail, Inbox, MailQuestion, Info, Sparkles } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import EncapsulatedEmailContent from "./EncapsulatedEmailContent";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { AlertTriangle } from "lucide-react";
import { Email } from "@/lib/types";
import { useSendMessage } from "@/lib/messaging";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { htmlToSmsText } from "@/lib/utils";
import { SummaryDialog } from "@/components/ai/SummaryDialog";
import {
  getUserSubscriptionData,
  StoredSubscriptionData,
  hasActiveAccess,
} from "@/lib/subscription";
import {
  hasEnoughCreditsForFeature,
  AI_CREDIT_COSTS
} from "@/lib/ai-credits";
import { htmlToText } from 'html-to-text';

interface WelcomeScreenProps {
  userEmail?: string | null;
}

function WelcomeScreen({ userEmail }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-12 text-center max-w-3xl mx-auto">
      <div className="mb-8 relative">
        <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto relative">
          <Mail className="h-12 w-12 text-primary" />
          <div className="absolute -right-3 -bottom-3 h-10 w-10 rounded-full bg-secondary flex items-center justify-center border-4 border-background">
            <MessageSquare className="h-5 w-5 text-secondary-foreground" />
          </div>
        </div>
      </div>

      <h1 className="text-3xl font-bold tracking-tight mb-3">Welcome to CommSync</h1>
      {userEmail && (
        <p className="text-muted-foreground mb-8">
          Connected as <span className="font-medium text-foreground">{userEmail}</span>
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 w-full max-w-2xl mx-auto">
        <div className="border rounded-lg p-4 flex items-start gap-3 bg-card hover:bg-accent/50 transition-colors">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center">
            <Inbox className="h-5 w-5 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-medium mb-1">Select a Conversation</h3>
            <p className="text-sm text-muted-foreground">Choose from your existing conversations in the sidebar to get started.</p>
          </div>
        </div>

        <div className="border rounded-lg p-4 flex items-start gap-3 bg-card hover:bg-accent/50 transition-colors">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-medium mb-1">Add Contacts</h3>
            <p className="text-sm text-muted-foreground">Manage your contacts and create groups for easier communication.</p>
          </div>
        </div>
      </div>

      <div className="border border-dashed rounded-lg p-5 w-full max-w-2xl text-left bg-muted/40">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium mb-2">Getting Started</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Connect your email and SMS accounts from the sidebar</li>
              <li>• Sync your conversations using the sync buttons</li>
              <li>• Create contact groups for bulk messaging</li>
              <li>• Compose new messages from any connected account</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ConversationViewProps {
  contactEmail: string | null;
  isLoading: boolean;
  isGroup?: boolean;
  groupId?: string | null;
}

const getAttachmentIcon = (mimeType: string | undefined) => {
  if (!mimeType) return File;
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.startsWith("text/")) return FileText;
  return File;
};

const getGravatarUrl = (email: string) => {
  const initial = email.charAt(0).toUpperCase();
  return `https://api.dicebear.com/9.x/glass/svg?radius=50&seed=${initial}&randomizeIds=true`;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export function ConversationView({
  contactEmail,
  isLoading,
  isGroup = false,
  groupId = null,
}: ConversationViewProps) {
  const { data: session } = useSession();
  const {
    emails,
    activeFilter,
    activeGroup,
    groups,
    contacts,
    addEmail,
    setEmails,
    imapAccounts,
    twilioAccounts,
    justcallAccounts,
  } = useEmailStore();
  const { toast } = useToast();
  const { sendMessage } = useSendMessage();

  // State for Summary Dialog
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<StoredSubscriptionData | null>(null);

  // State to track whether we've already shown a Gmail error
  const [shownGmailError, setShownGmailError] = useState(false);

  // Determine if we're dealing with a group based on contactEmail format
  const isContactGroup = useMemo(() => {
    return contactEmail?.startsWith('group:') || isGroup;
  }, [contactEmail, isGroup]);

  // Extract the groupId from the contactEmail if it's in the group:id format
  const derivedGroupId = useMemo(() => {
    if (contactEmail?.startsWith('group:')) {
      return contactEmail.split(':')[1];
    }
    return groupId;
  }, [contactEmail, groupId]);

  // Find the group if we have a groupId
  const selectedGroup = useMemo(() => {
    if (derivedGroupId) {
      return groups.find((g) => g.id === derivedGroupId);
    }
    return null;
  }, [derivedGroupId, groups]);

  // Filter emails based on active filter and group
  const filteredEmails = useMemo(() => {
    if (activeFilter.startsWith("group:") && activeGroup) {
      // Find the active group
      const group = groups.find((g) => g.id === activeGroup);
      if (group) {
        // Filter emails that involve any address or phone number in the group
        return emails.filter((email) => {
          // For email conversations
          const emailMatches = group.addresses.some(
            (addr) =>
              email.from?.email === addr ||
              email.to?.some((to) => to.email === addr)
          );

          // For SMS/phone conversations
          const phoneMatches = group.phoneNumbers.some(
            (phone) => {
              // Handle different formats of phone numbers
              const normalizedPhone = phone.replace(/\D/g, '');
              const normalizedFrom = email.from?.email.replace(/\D/g, '');
              const normalizedToPhones = email.to?.map(to => to.email.replace(/\D/g, ''));

              return (
                // Check if the SMS is from this phone number
                (normalizedFrom && normalizedFrom.includes(normalizedPhone)) ||
                // Check if the SMS is to this phone number
                (normalizedToPhones && normalizedToPhones.some(toPhone =>
                  toPhone && toPhone.includes(normalizedPhone)
                ))
              );
            }
          );

          // Return emails that match either email addresses or phone numbers
          return emailMatches || phoneMatches;
        });
      }
      return [];
    }

    // If there's a contactEmail and it's a group
    if (contactEmail && isGroup && groupId) {
      // Find the group by ID
      const group = groups.find((g) => g.id === groupId);
      if (group) {
        // Filter emails that involve any address or phone number in the group
        return emails.filter((email) => {
          // For email conversations
          const emailMatches = group.addresses.some(
            (addr) =>
              email.from?.email === addr ||
              email.to?.some((to) => to.email === addr)
          );

          // For SMS/phone conversations
          const phoneMatches = group.phoneNumbers.some(
            (phone) => {
              // Handle different formats of phone numbers
              const normalizedPhone = phone.replace(/\D/g, '');
              const normalizedFrom = email.from?.email.replace(/\D/g, '');
              const normalizedToPhones = email.to?.map(to => to.email.replace(/\D/g, ''));

              return (
                // Check if the SMS is from this phone number
                (normalizedFrom && normalizedFrom.includes(normalizedPhone)) ||
                // Check if the SMS is to this phone number
                (normalizedToPhones && normalizedToPhones.some(toPhone =>
                  toPhone && toPhone.includes(normalizedPhone)
                ))
              );
            }
          );

          // Return emails that match either email addresses or phone numbers
          return emailMatches || phoneMatches;
        });
      }
    }

    // Original filtering logic for other filters
    if (activeFilter === "inbox") {
      return emails.filter(
        (email) =>
          !(email.labels?.includes("TRASH") || email.labels?.includes("SENT"))
      );
    } else if (activeFilter === "draft") {
      return emails.filter((email) => email.labels?.includes("DRAFT"));
    } else if (activeFilter === "sent") {
      return emails.filter((email) => email.labels?.includes("SENT"));
    } else if (activeFilter === "trash") {
      return emails.filter((email) => email.labels?.includes("TRASH"));
    } else if (activeFilter === "starred") {
      return emails.filter((email) => email.labels?.includes("STARRED"));
    } else if (activeFilter === "archive") {
      return emails.filter((email) => email.labels?.includes("ARCHIVE"));
    } else {
      return emails;
    }
  }, [emails, activeFilter, activeGroup, groups]);

  const [isSending, setIsSending] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [messageContent, setMessageContent] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  // State for selected platform and account when multiple are available
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const contact = contacts.find((c) => c.email === contactEmail);

  // Enhanced debugging for troubleshooting
  useEffect(() => {
    if (contactEmail && contact) {
      console.log(
        `Contact selected: ${contactEmail}, Account ID: ${contact.accountId}`
      );
      if (contact.accountId) {
        const imapAccount = imapAccounts.find(
          (acc) => acc.id === contact.accountId
        );
        console.log(`Found IMAP account:`, imapAccount?.label);
      }
    }
  }, [contactEmail, contact, imapAccounts]);

  // Always use all emails to ensure conversations include both sent and received emails
  const allEmails = emails;

  // Update conversation filtering to handle group conversations
  const conversation = useMemo(() =>
    emails
      .filter((email) => {
        // If we're looking at a group conversation
        if (isContactGroup && selectedGroup) {
          // Check if the email involves any address in the group
          const emailMatches = selectedGroup.addresses.some(
            (addr) =>
              email.from?.email === addr ||
              email.to?.some((to) => to.email === addr)
          );

          // For SMS/phone conversations
          const phoneMatches = selectedGroup.phoneNumbers.some(
            (phone) => {
              // Handle different formats of phone numbers
              const normalizedPhone = phone.replace(/\D/g, '');
              const normalizedFrom = email.from?.email.replace(/\D/g, '');
              const normalizedToPhones = email.to?.map(to => to.email.replace(/\D/g, ''));

              return (
                // Check if the SMS is from this phone number
                (normalizedFrom && normalizedFrom.includes(normalizedPhone)) ||
                // Check if the SMS is to this phone number
                (normalizedToPhones && normalizedToPhones.some(toPhone =>
                  toPhone && toPhone.includes(normalizedPhone)
                ))
              );
            }
          );

          return emailMatches || phoneMatches;
        }

        // Regular contact conversation (non-group)
        const contact = contacts.find((c) => c.email === contactEmail);

        // For Gmail emails (from the user's Gmail account)
        if (
          session?.user?.email &&
          (!email.accountId || email.accountType === "gmail")
        ) {
          // Enhanced Gmail conversation detection that handles forwarded emails
          // Check for normal conversation pattern
          const isDirectConversation =
            (email.from.email === contactEmail &&
              email.to.some((to) => to.email === session.user.email)) ||
            (email.from.email === session.user.email &&
              email.to.some((to) => to.email === contactEmail));

          if (isDirectConversation) {
            return true;
          }

          // Check for forwarded emails using metadata
          if (email.metadata) {
            // If this is a forwarded email, check the original sender or recipients
            if (email.metadata.isForwarded) {
              // Check if the original sender matches the contact
              if (email.metadata.originalSender &&
                email.metadata.originalSender.email === contactEmail) {
                return true;
              }

              // Check if the contact is in the all recipients list
              if (email.metadata.allRecipients &&
                email.metadata.allRecipients.some(r => r.email === contactEmail)) {
                return true;
              }
            }

            // Check Message-ID, References and In-Reply-To chains
            const messageRefs = [
              email.metadata.messageId,
              email.metadata.references,
              email.metadata.inReplyTo
            ].filter(Boolean).join(' ');

            // If any message reference contains the contact email, it's likely part of the conversation
            if (typeof contactEmail === 'string' && contactEmail.length > 0 && messageRefs.includes(contactEmail)) {
              return true;
            }
          }

          // Check subject threading (look for similar subjects)
          // Some conversations are threaded by subject pattern
          if (contact?.lastMessageSubject && email.subject) {
            const normalizedContactSubject = contact.lastMessageSubject
              .replace(/^(?:RE|FWD?|AW|WG):\s*/i, '')
              .trim()
              .toLowerCase();

            const normalizedEmailSubject = email.subject
              .replace(/^(?:RE|FWD?|AW|WG):\s*/i, '')
              .trim()
              .toLowerCase();

            // If normalized subjects match and it's a conversation with this email
            if (normalizedContactSubject === normalizedEmailSubject &&
              (email.from.email === contactEmail ||
                email.to.some(to => to.email === contactEmail))) {
              return true;
            }
          }
        }

        // For IMAP emails
        if (contact?.accountId && email.accountId === contact.accountId) {
          // Fixed IMAP email filtering - don't check for account ID in the to/from fields
          const isImapConversation =
            email.from.email === contactEmail ||
            email.to.some((to) => to.email === contactEmail);

          if (isImapConversation) {
            return true;
          }
        }

        return false;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [emails, contactEmail, session?.user?.email, contacts, isContactGroup, selectedGroup]);

  useEffect(() => {
    console.log(`Conversation contains ${conversation.length} emails`);
  }, [conversation.length]);

  // Add useEffect to handle empty conversation
  useEffect(() => {
    const fetchConversation = async () => {
      // Check if contactEmail actually exists before fetching
      if (!contactEmail) {
        return;
      }

      if (
        !isLoading &&
        !isRefetching &&
        session?.user?.accessToken &&
        contact && // Make sure we have a contact
        conversation.length === 0 // Only fetch if conversation is empty
      ) {
        setIsRefetching(true);

        try {
          // For Gmail accounts
          if (!contact.accountId) {
            // Enhanced Gmail conversation fetching
            try {
              // Try to search for the messages by query
              const response = await fetch("/api/gmail/search", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  query: `from:${contactEmail} OR to:${contactEmail}`,
                  accessToken: session.user.accessToken
                }),
              });

              const data = await response.json();

              if (data.success && data.messages && data.messages.length > 0) {
                // Add these emails to the store
                const existingEmails = new Map(emails.map((e) => [e.id, e]));
                data.messages.forEach((email: Email) =>
                  existingEmails.set(email.id, email)
                );

                setEmails(Array.from(existingEmails.values()));

                toast({
                  title: "Conversation loaded",
                  description: `Found ${data.messages.length} messages`,
                });
                setIsRefetching(false);
                return;
              }
            } catch (searchError) {
              console.warn("Gmail search failed, falling back to error message:", searchError);
            }

            // If we get here, we couldn't find the conversation via search
            // Only show the Gmail error toast once per conversation
            if (!shownGmailError) {
              setShownGmailError(true);
              toast({
                title: "Gmail conversation unavailable",
                description:
                  "We cannot display this conversation due to Gmail API limitations. Try searching for the contact in your Gmail.",
                variant: "destructive",
                duration: 5000,
              });
            }

            setIsRefetching(false);
            return;
          }
          // For IMAP accounts - keep existing code
          else if (contact.accountId) {
            toast({
              title: "Loading conversation",
              description: "Fetching messages for this contact...",
            });

            const imapAccount = imapAccounts.find(
              (acc) => acc.id === contact.accountId
            );

            if (imapAccount) {
              const response = await fetch("/api/imap", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  action: "getConversation",
                  account: imapAccount,
                  data: {
                    contactEmail: contactEmail,
                    includeBody: true,
                  },
                }),
              });

              const data = await response.json();
              if (data.messages && data.messages.length > 0) {
                // Add these emails to the store
                const existingEmails = new Map(emails.map((e) => [e.id, e]));
                data.messages.forEach((email: Email) =>
                  existingEmails.set(email.id, email)
                );

                setEmails(Array.from(existingEmails.values()));

                toast({
                  title: "Conversation loaded",
                  description: `Found ${data.messages.length} messages`,
                });
              } else {
                toast({
                  title: "No messages found",
                  description: "Start a new conversation",
                });
              }
            }
          }
        } catch (error) {
          console.error("Error fetching conversation:", error);
          toast({
            title: "Error loading conversation",
            description: "Please try again later",
            variant: "destructive",
          });
        } finally {
          setIsRefetching(false);
        }
      }
    };

    // Only run fetchConversation if we have a contactEmail - not on initial render
    if (contactEmail) {
      fetchConversation();
    }
  }, [
    contactEmail,
    isLoading,
    isRefetching,
    session?.user?.accessToken,
    contact,
    conversation.length,
    emails,
    setEmails,
    toast,
    imapAccounts,
    shownGmailError,
  ]);

  // Fetch user subscription data on mount or session change via API route
  useEffect(() => {
    async function fetchSubscription() {
      // No need to check session?.user?.id here, API route handles auth
      try {
        // Use the main subscription endpoint - it handles fetching without usage update by default
        const response = await fetch('/api/subscription');

        if (!response.ok) {
          // Handle non-2xx responses (like 401 Unauthorized, 500 Internal Server Error)
          const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Set the subscription data from the API response
        setSubscriptionData(data.subscription); // The API returns { subscription: ... }
        console.log("Subscription data fetched via API:", data.subscription);

      } catch (error) {
        console.error("Failed to fetch subscription data via API:", error);
        setSubscriptionData(null); // Ensure it's null on error
        toast({
          title: "Could not load subscription",
          description: `AI features might be unavailable. ${error instanceof Error ? error.message : ''}`,
          variant: "destructive",
          duration: 5000,
        });
      }
    }

    // Only fetch if we have a session (or attempt, API handles actual auth)
    if (session) {
      fetchSubscription();
    } else {
      setSubscriptionData(null); // Clear if no session
    }

  }, [session, toast]); // Depend on the whole session object now

  // Prepare conversation text for summarization
  const conversationTextForSummary = useMemo(() => {
    return conversation
      .map((email) => {
        const sender = email.from?.name || email.from?.email || 'Unknown Sender';
        const date = formatDistanceToNow(new Date(email.date || ""), { addSuffix: true });
        // Clean HTML body for better processing by AI
        const bodyText = email.body ? htmlToText(email.body, { wordwrap: 130 }) : '(No content)';

        // Simple format, adjust as needed for AI quality
        return `Sender: ${sender}\nDate: ${date}\n\n${bodyText}\n\n---\n`;
      })
      .join(""); // Join messages into a single string
  }, [conversation]);

  // Update loading state to include refetching
  const isLoadingState = isLoading;

  // Detect platform from conversation
  useEffect(() => {
    if (conversation.length > 0) {
      // Sort conversation to get the most recent message
      const latestEmail = [...conversation].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];

      // Set platform based on latest message
      if (latestEmail.accountType) {
        setSelectedPlatform(latestEmail.accountType);
        if (latestEmail.accountId) {
          setSelectedAccountId(latestEmail.accountId);
        }
        console.log(`Detected platform: ${latestEmail.accountType}, Account ID: ${latestEmail.accountId || 'none'}`);
      } else if (latestEmail.platform) {
        setSelectedPlatform(latestEmail.platform);
        if (latestEmail.accountId) {
          setSelectedAccountId(latestEmail.accountId);
        }
        console.log(`Detected platform: ${latestEmail.platform}, Account ID: ${latestEmail.accountId || 'none'}`);
      } else {
        // Default to Gmail if no platform detected
        setSelectedPlatform('gmail');
        setSelectedAccountId(null);
        console.log('No platform detected, defaulting to Gmail');
      }
    } else if (contact?.accountType) {
      // If no conversation but contact has accountType, use that
      setSelectedPlatform(contact.accountType);
      if (contact.accountId) {
        setSelectedAccountId(contact.accountId);
      }
      console.log(`Using contact platform: ${contact.accountType}, Account ID: ${contact.accountId || 'none'}`);
    } else {
      // Default to Gmail
      setSelectedPlatform('gmail');
      setSelectedAccountId(null);
    }
  }, [conversation, contact]);

  // Get a displayable name for the current conversation
  const conversationName = useMemo(() => {
    if (isContactGroup && selectedGroup) {
      return selectedGroup.name;
    }

    if (contactEmail) {
      const contact = contacts.find((c) => c.email === contactEmail);
      return contact?.name || contactEmail.split('@')[0];
    }

    return "Conversation";
  }, [contactEmail, contacts, isContactGroup, selectedGroup]);

  // Count of contacts in the group
  const contactCount = useMemo(() => {
    if (selectedGroup) {
      return {
        emails: selectedGroup.addresses.length,
        phones: selectedGroup.phoneNumbers.length,
        total: selectedGroup.addresses.length + selectedGroup.phoneNumbers.length
      };
    }
    return null;
  }, [selectedGroup]);

  // Debug function for SMS message direction
  function debugSmsMessageDirection(email: Email, isFromMe: boolean) {
    if (email.accountType !== 'twilio' && email.accountType !== 'justcall') {
      return; // Only debug SMS messages
    }

    console.log(`[SMS Debug] Message ID: ${email.id}`);
    console.log(`[SMS Debug] Direction determined: ${isFromMe ? "FROM ME (outbound)" : "TO ME (inbound)"}`);
    console.log(`[SMS Debug] Account type: ${email.accountType}`);
    console.log(`[SMS Debug] From: ${email.from.email}`);
    console.log(`[SMS Debug] To: ${email.to.map(t => t.email).join(', ')}`);
    console.log(`[SMS Debug] Labels: ${email.labels?.join(', ') || 'none'}`);
    console.log(`[SMS Debug] Account ID: ${email.accountId || 'none'}`);
    console.log(`[SMS Debug] Subject: ${email.subject}`);
    console.log(`[SMS Debug] Date: ${email.date}`);
    console.log('----------------------');
  }

  // Handler for clicking the Summarize button
  const handleSummarizeClick = async () => {
    // 1. Check if subscription data is loaded
    if (!subscriptionData) {
      toast({
        title: "Subscription Not Loaded",
        description: "Cannot check AI credits. Please wait or refresh.",
        variant: "destructive",
      });
      return;
    }

    // 2. Check for active access (covers active plans and trials)
    // We can use the hasActiveAccess function from subscription utils if needed,
    // but hasEnoughCreditsForFeature implies active access if total > 0
    // Let's rely on the credit check for simplicity here.

    // 3. Check for enough credits
    const hasEnoughCredits = await hasEnoughCreditsForFeature(
      subscriptionData,
      'SUMMARIZE_THREAD'
    );

    if (!hasEnoughCredits) {
      toast({
        title: "Insufficient AI Credits",
        description: `You need ${AI_CREDIT_COSTS.SUMMARIZE_THREAD} credits to summarize. Please upgrade or check your usage.`,
        variant: "destructive",
      });
      return;
    }

    // 4. Check if there's content to summarize
    if (!conversationTextForSummary || conversationTextForSummary.trim().length === 0) {
      toast({
        title: "Nothing to Summarize",
        description: "The conversation appears to be empty.",
      });
      return;
    }

    // 5. Open the dialog
    console.log("Opening summary dialog...");
    setIsSummaryDialogOpen(true);
  };

  if (!contactEmail) {
    return (
      <WelcomeScreen userEmail={session?.user?.email} />
    );
  }

  return (
    <ResizablePanelGroup
      direction="vertical"
      className="flex-1 h-full overflow-hidden"
    >
      {/* Conversation Header Panel */}
      <ResizablePanel
        defaultSize={8} // Slightly increase size for the button
        minSize={8}
        maxSize={15}
        className="border-b border-border p-4 flex justify-between items-center bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      >
        <div className="flex items-center gap-3"> {/* Container for Left side */}
          {isContactGroup && selectedGroup ? (
            // Group Display
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-medium">{conversationName}</h2>
                <p className="text-xs text-muted-foreground">
                  {contactCount?.total} contacts ({contactCount?.emails} emails, {contactCount?.phones} phone numbers)
                </p>
              </div>
            </div>
          ) : (
            // Single Contact Display
            <div className="flex items-center gap-2">
              <Avatar className="h-9 w-9">
                <AvatarImage
                  src={getGravatarUrl(contactEmail || "")}
                  alt={conversationName}
                />
                <AvatarFallback>{conversationName[0]}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-medium">{conversationName}</h2>
                <p className="text-xs text-muted-foreground">{contactEmail}</p>
              </div>
            </div>
          )}
        </div>
        {/* Action Buttons on the Right */}
        <div className="flex items-center gap-2">
          {/* Add Summarize button here */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleSummarizeClick}
            disabled={isLoadingState || isRefetching || conversation.length === 0 || !subscriptionData} // Disable if loading, no messages, or no sub data
            title="Summarize Conversation (AI)"
          >
            <Sparkles className="h-4 w-4" />
          </Button>
          {/* Other action buttons could go here */}
        </div>
      </ResizablePanel>

      <ResizableHandle />

      {/* Messages List Panel (scrollable) */}
      <ResizablePanel
        defaultSize={70}
        className="flex flex-col overflow-hidden"
      >
        <ScrollArea className="flex-1">
          <div className="space-y-4 max-w-5xl mx-auto p-4">
            {isLoadingState ? (
              // Show skeleton placeholders while loading or refetching
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex flex-col space-y-2">
                    <Skeleton className="h-4 w-[100px]" />
                    <Skeleton className="h-20 w-full max-w-md" />
                  </div>
                ))}
              </div>
            ) : conversation.length > 0 ? (
              conversation.map((email) => {
                // Determine if message is from the user (outbound) or to the user (inbound)
                let isFromMe = false;

                // Check based on platform/account type
                if (email.accountType === "gmail") {
                  // For Gmail: check against session.user.email
                  isFromMe = email.from.email === session?.user?.email;
                } else if (email.accountType === "imap") {
                  // For IMAP: check if this is the account owner's email
                  isFromMe = email.accountId === contact?.accountId &&
                    !email.from.email.includes(contactEmail);
                } else if (email.accountType === "twilio" || email.accountType === "justcall") {
                  // For SMS platforms: check direction property directly

                  // First check if there's an explicit direction label
                  if (email.labels?.includes("OUTBOUND")) {
                    isFromMe = true;
                  } else if (email.labels?.includes("INBOUND")) {
                    isFromMe = false;
                  } else {
                    // For JustCall: messages they create have direction set to "inbound" when coming TO the user
                    // and "outbound" when sent FROM the user
                    const isOutbound = email.labels?.some(label =>
                      label === "outbound" ||
                      label === "OUTBOUND" ||
                      label === "Outbound" ||
                      label === "outbound-api" ||
                      label === "outbound-reply"
                    );

                    const isInbound = email.labels?.some(label =>
                      label === "inbound" ||
                      label === "INBOUND" ||
                      label === "Inbound"
                    );

                    if (isOutbound) {
                      isFromMe = true;
                    } else if (isInbound) {
                      isFromMe = false;
                    } else {
                      // Check for typical JustCall pattern: 
                      // If FROM.EMAIL contains an account phone number, it's outbound (from us)
                      // If TO contains an account phone number, it's inbound (to us)

                      const accountPhoneNumbers: string[] = [];

                      // Get all phone numbers from Twilio accounts
                      twilioAccounts.forEach(acc => {
                        if (acc.phoneNumber) {
                          accountPhoneNumbers.push(acc.phoneNumber.replace(/\D/g, ''));
                        }
                      });

                      // Get all phone numbers from JustCall accounts
                      justcallAccounts.forEach(acc => {
                        if (acc.accountIdentifier) {
                          accountPhoneNumbers.push(acc.accountIdentifier.replace(/\D/g, ''));
                        }
                      });

                      // Clean phone numbers for comparison
                      const fromPhone = email.from.email.replace(/\D/g, '');
                      const toPhones = email.to.map(to => to.email.replace(/\D/g, ''));

                      // If the message is FROM one of our account phone numbers, it's from us
                      const isFromAccountPhone = accountPhoneNumbers.some(phone =>
                        fromPhone.includes(phone) || phone.includes(fromPhone)
                      );

                      // If the message is TO one of our account phone numbers, it's to us
                      const isToAccountPhone = accountPhoneNumbers.some(phone =>
                        toPhones.some(toPhone => toPhone.includes(phone) || phone.includes(toPhone))
                      );

                      if (isFromAccountPhone) {
                        isFromMe = true;
                      } else if (isToAccountPhone) {
                        isFromMe = false;
                      } else {
                        // Fall back to account-specific checks
                        const twilioAccount = twilioAccounts.find(a => a.id === email.accountId);
                        const justcallAccount = justcallAccounts.find(a => a.id === email.accountId);

                        if (twilioAccount) {
                          // In Twilio, if our phone number is the "from", it's an outbound message (from us)
                          isFromMe = email.from.email.replace(/\D/g, '').includes(twilioAccount.phoneNumber.replace(/\D/g, ''));
                        } else if (justcallAccount) {
                          // In JustCall, similar logic applies
                          isFromMe = email.from.email.replace(/\D/g, '').includes(justcallAccount.accountIdentifier.replace(/\D/g, ''));
                        } else {
                          // Last resort - If the contact's phone is in the "to" field, it's from us
                          const contactPhone = contactEmail?.replace(/\D/g, '');

                          if (contactPhone) {
                            const toPhones = email.to.map(to => to.email.replace(/\D/g, ''));
                            isFromMe = toPhones.some(toPhone => toPhone.includes(contactPhone) || contactPhone.includes(toPhone));
                          }
                        }
                      }
                    }
                  }
                }

                // Debug function for SMS message direction
                debugSmsMessageDirection(email, isFromMe);

                return (
                  <div
                    key={email.id}
                    className={`flex ${isFromMe ? "justify-end" : "justify-start"
                      } gap-3 items-end`}
                  >
                    {/* Avatar on the left if it's from the contact */}
                    {!isFromMe && (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={getGravatarUrl(email.from.email)} />
                        <AvatarFallback>
                          {contact?.name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    {/* Message bubble */}
                    <div
                      className={`max-w-[85%] rounded-2xl p-4 ${isFromMe
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted rounded-bl-sm"
                        }`}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-baseline gap-4">
                          <span className="font-medium text-sm">
                            {email.subject}
                          </span>
                          <span className="text-xs opacity-70">
                            {formatDistanceToNow(new Date(email.date || ""), {
                              addSuffix: true,
                              includeSeconds: true,
                            })}
                            {email.accountType === "justcall" && (
                              <span className="ml-1">
                                [Debug:{" "}
                                {new Date(email.date || "").toISOString()}]
                              </span>
                            )}
                          </span>
                        </div>
                        {/* Handle SMS message display */}
                        {(email.accountType === "twilio" || email.accountType === "justcall") ? (
                          <div className="whitespace-pre-wrap font-mono text-sm">
                            {email.body}
                          </div>
                        ) : (
                          <EncapsulatedEmailContent html={DOMPurify.sanitize(email.body)} />
                        )}
                        {/* Attachments */}
                        {email.attachments && email.attachments.length > 0 && (
                          <div
                            key={`attachments-${email.id}`}
                            className="mt-2 grid grid-cols-2 gap-2"
                          >
                            {email.attachments.map((attachment, index) => {
                              // Ensure we have a valid attachment with required properties
                              if (!attachment || !attachment.id) {
                                return (
                                  <div
                                    key={`invalid-attachment-${index}`}
                                    className="p-2 bg-background/10 rounded-lg text-xs opacity-70"
                                  >
                                    Invalid attachment
                                  </div>
                                );
                              }

                              // Safely determine mime type and icon
                              const mimeType = attachment.mimeType || "";
                              const IconComponent = getAttachmentIcon(mimeType);
                              const isImage =
                                mimeType && mimeType.startsWith("image/");

                              // Generate a safe filename
                              const filename =
                                attachment.filename ||
                                `attachment-${index + 1}`;

                              // Handle attachment preview and download safely
                              return (
                                <a
                                  key={attachment.id}
                                  href={attachment.url || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => {
                                    if (!attachment.url) {
                                      e.preventDefault();
                                      toast({
                                        title: "Attachment unavailable",
                                        description:
                                          "This attachment cannot be downloaded",
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                  className="group relative flex flex-col gap-1 p-2 bg-background/10 rounded-lg hover:bg-background/20 transition-colors"
                                >
                                  {isImage ? (
                                    // Safe image preview with fallback
                                    <div className="relative w-full aspect-square bg-muted/50 rounded overflow-hidden">
                                      {attachment.url ? (
                                        <img
                                          src={attachment.url}
                                          alt={filename}
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            e.currentTarget.style.display =
                                              "none";
                                            const container =
                                              e.currentTarget.parentElement;
                                            if (container) {
                                              const iconEl =
                                                document.createElement("div");
                                              iconEl.className =
                                                "flex items-center justify-center w-full h-full";
                                              iconEl.innerHTML =
                                                '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                                              container.appendChild(iconEl);
                                            }
                                          }}
                                        />
                                      ) : (
                                        <div className="flex items-center justify-center w-full h-full">
                                          <IconComponent className="w-8 h-8 opacity-50" />
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center w-full aspect-square bg-muted/30 rounded">
                                      <IconComponent className="w-8 h-8 opacity-70" />
                                    </div>
                                  )}
                                  <div className="text-xs truncate max-w-full">
                                    {filename}
                                  </div>
                                  <div className="text-xs opacity-70">
                                    {attachment.size
                                      ? formatFileSize(attachment.size)
                                      : mimeType.split("/")[0] || "Unknown"}
                                  </div>
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Avatar on the right if it's from me */}
                    {isFromMe && (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={session?.user?.image || `https://api.dicebear.com/9.x/glass/svg?radius=50&seed=${session?.user?.email}&randomizeIds=true`} />
                        <AvatarFallback>
                          {session?.user?.name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              })
            ) : (
              // No messages found - show appropriate message
              <div className="flex flex-col items-center justify-center p-8 text-center">
                {!contact?.accountId ? (
                  // Gmail-specific message
                  <div className="max-w-md">
                    <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      Gmail Conversation Unavailable
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      We cannot display this conversation due to Gmail API limitations. This may be due to search restrictions or authentication constraints.
                    </p>
                    <div className="mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="mr-2"
                        onClick={() => {
                          // Trigger a manual sync of Gmail emails
                          if (session?.user?.accessToken) {
                            toast({
                              title: "Syncing Gmail",
                              description: "Attempting to load more recent messages...",
                            });

                            useEmailStore.getState().syncEmails(session.user.accessToken);

                            // After sync completes, clear the shown error flag to allow retrying
                            setTimeout(() => {
                              setShownGmailError(false);
                            }, 3000);
                          }
                        }}
                      >
                        Retry Sync
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Open Gmail search in new tab
                          const searchQuery = encodeURIComponent(`from:${contactEmail} OR to:${contactEmail}`);
                          window.open(`https://mail.google.com/mail/u/0/#search/${searchQuery}`, '_blank');
                        }}
                      >
                        Open in Gmail
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Generic empty conversation message for IMAP
                  <div className="max-w-md">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      No Messages Found
                    </h3>
                    <p className="text-muted-foreground">
                      Start a new conversation with this contact.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </ResizablePanel>

      <ResizableHandle />

      {/* Message Input Panel */}
      <ResizablePanel
        defaultSize={30}
        minSize={20}
        maxSize={60}
        className="border-t border-border p-4 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      >
        <MessageInput
          onSend={async (content, uploadedAttachments) => {
            if (!contactEmail || !session?.user?.accessToken) return;

            setIsSending(true);
            try {
              // Handle group emails
              if (isGroup && groupId) {
                const group = groups.find((g) => g.id === groupId);

                if (group) {
                  if (selectedPlatform === "gmail" || selectedPlatform === "imap") {
                    // For email platforms with group
                    const recipients = group.addresses.join(",");
                    await sendMessage({
                      platform: selectedPlatform,
                      recipients,
                      subject: `Re: Group: ${group.name}`,
                      content,
                      attachments: uploadedAttachments,
                      accountId: selectedAccountId || undefined
                    }, {
                      accessToken: session.user.accessToken,
                      onSuccess: (newMessage) => {
                        if (newMessage) {
                          addEmail(newMessage);
                          toast({
                            title: "Message sent",
                            description: `Your message has been sent to ${group.addresses.length} recipients`,
                          });

                          // Trigger sync after message is sent
                          setTimeout(() => {
                            useEmailStore.getState().syncAllPlatforms(session.user.accessToken);
                          }, 1000); // Small delay to ensure message is processed
                        }
                      }
                    });
                  } else if (selectedPlatform === "twilio" || selectedPlatform === "justcall") {
                    // For SMS platforms with group, send individual messages
                    const phoneNumbers = group.phoneNumbers.length > 0
                      ? group.phoneNumbers
                      : group.addresses; // Fallback to addresses if no phone numbers

                    for (const phoneNumber of phoneNumbers) {
                      await sendMessage({
                        platform: selectedPlatform,
                        recipients: phoneNumber,
                        content,
                        attachments: uploadedAttachments,
                        accountId: selectedAccountId || undefined
                      }, {
                        accessToken: session.user.accessToken,
                        onSuccess: (newMessage) => {
                          if (newMessage) {
                            addEmail(newMessage);
                          }
                        }
                      });
                    }

                    toast({
                      title: "Messages sent",
                      description: `Your message has been sent to ${phoneNumbers.length} recipients`,
                    });

                    // Trigger sync after all messages are sent
                    setTimeout(() => {
                      useEmailStore.getState().syncAllPlatforms(session.user.accessToken);
                    }, 1000); // Small delay to ensure messages are processed
                  }
                }
              } else {
                // Regular single-recipient message
                if (selectedPlatform === "gmail" || selectedPlatform === "imap") {
                  // For email platforms
                  // Get threadId for proper threading if available
                  const latestEmailInConversation = conversation.length > 0
                    ? conversation.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
                    : null;
                  const threadId = latestEmailInConversation?.threadId || null;

                  await sendMessage({
                    platform: selectedPlatform,
                    recipients: contactEmail,
                    subject: `Re: ${latestEmailInConversation?.subject || contact?.lastMessageSubject || "No subject"}`,
                    content,
                    attachments: uploadedAttachments,
                    accountId: selectedAccountId || undefined,
                    threadId
                  }, {
                    accessToken: session.user.accessToken,
                    onSuccess: (newMessage) => {
                      if (newMessage) {
                        addEmail(newMessage);
                        toast({
                          title: "Message sent",
                          description: "Your reply has been sent successfully",
                        });

                        // Trigger sync after message is sent
                        setTimeout(() => {
                          useEmailStore.getState().syncAllPlatforms(session.user.accessToken);
                        }, 1000); // Small delay to ensure message is processed
                      }
                    }
                  });
                } else if (selectedPlatform === "twilio" || selectedPlatform === "justcall") {
                  // For SMS platforms
                  let justcallNumber = undefined;

                  // Get JustCall phone number if needed
                  if (selectedPlatform === "justcall" && selectedAccountId) {
                    const account = justcallAccounts.find(a => a.id === selectedAccountId);
                    justcallNumber = account?.accountIdentifier || undefined;
                  }

                  await sendMessage({
                    platform: selectedPlatform,
                    recipients: contactEmail,
                    content,
                    attachments: uploadedAttachments,
                    accountId: selectedAccountId || undefined,
                    justcallNumber
                  }, {
                    accessToken: session.user.accessToken,
                    onSuccess: (newMessage) => {
                      if (newMessage) {
                        addEmail(newMessage);
                        toast({
                          title: "Message sent",
                          description: "Your message has been sent successfully",
                        });

                        // Trigger sync after message is sent
                        setTimeout(() => {
                          useEmailStore.getState().syncAllPlatforms(session.user.accessToken);
                        }, 1000); // Small delay to ensure message is processed
                      }
                    }
                  });
                }
              }
            } catch (error) {
              console.error("Failed to send message:", error);
              toast({
                title: "Failed to send message",
                description: "Please try again later",
                variant: "destructive",
              });
            } finally {
              setIsSending(false);
            }
          }}
          isLoading={isSending}
          placeholder={
            isGroup && groupId
              ? `Reply to group...`
              : `Reply to ${contact?.name || contactEmail}...`
          }
          platform={selectedPlatform || "gmail"}
          accountId={selectedAccountId || undefined}
          isGroup={isGroup}
          groupId={groupId}
          platformOptions={conversation.reduce((options, email) => {
            if (email.accountType && !options.includes(email.accountType)) {
              options.push(email.accountType);
            }
            return options;
          }, [] as string[])}
          onPlatformChange={(platform: string, accountId?: string) => {
            setSelectedPlatform(platform);
            if (accountId === undefined) {
              setSelectedAccountId(null);
            } else {
              setSelectedAccountId(accountId);
            }
          }}
        />
      </ResizablePanel>

      {/* Render the Summary Dialog */}
      {isSummaryDialogOpen && (
        <SummaryDialog
          isOpen={isSummaryDialogOpen}
          onOpenChange={setIsSummaryDialogOpen}
          conversationText={conversationTextForSummary}
          subscriptionId={subscriptionData?.id || null} // Pass subscription ID
          userId={session?.user?.id || null} // Pass user ID
        />
      )}

    </ResizablePanelGroup>
  );
}
