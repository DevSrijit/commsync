"use client";

import { useState, useEffect, useMemo } from "react";
import { MessageInput } from "@/components/message-input";
import { formatDistanceToNow } from "date-fns";
import { useEmailStore } from "@/lib/email-store";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession } from "next-auth/react";
import { sendEmail } from "@/lib/gmail-api";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Paperclip, Image, FileText, File } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { fetchEmails } from "@/lib/gmail-api";
import { Email } from "@/lib/types";

interface ConversationViewProps {
  contactEmail: string | null;
  isLoading: boolean;
}

const getAttachmentIcon = (mimeType: string | undefined) => {
  if (!mimeType) return File;
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.startsWith("text/")) return FileText;
  return File;
};

const getGravatarUrl = (email: string) => {
  const firstChar = email.charAt(0).toLowerCase();
  const img = `https://avatar.iran.liara.run/username?username=${firstChar}`
  return img;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export function ConversationView({
  contactEmail,
  isLoading,
}: ConversationViewProps) {
  const { data: session } = useSession();
  const { emails, activeFilter, activeGroup, groups, contacts, addEmail, setEmails, imapAccounts } = useEmailStore();
  const { toast } = useToast();
  
  // Filter emails based on active filter and group
  const filteredEmails = useMemo(() => {
    if (activeFilter.startsWith("group:") && activeGroup) {
      // Find the active group
      const group = groups.find(g => g.id === activeGroup);
      if (group) {
        // Filter emails that involve any address in the group
        return emails.filter(email => 
          group.addresses.some(addr => 
            email.from?.includes(addr) || 
            email.to?.includes(addr)
          )
        );
      }
      return [];
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

  const contact = contacts.find((c) => c.email === contactEmail);

  // Enhanced debugging for troubleshooting
  useEffect(() => {
    if (contactEmail && contact) {
      console.log(`Contact selected: ${contactEmail}, Account ID: ${contact.accountId}`);
      if (contact.accountId) {
        const imapAccount = imapAccounts.find(acc => acc.id === contact.accountId);
        console.log(`Found IMAP account:`, imapAccount?.label);
      }
    }
  }, [contactEmail, contact, imapAccounts]);

  // Filter all emails related to this conversation, considering account IDs
  const conversation = filteredEmails
    .filter((email) => {
      if (contactEmail === null) return false;

      // Enhanced debugging
      console.log(`Checking email: ${email.id}, from: ${email.from.email}, accountId: ${email.accountId}, type: ${email.accountType || 'unknown'}`);

      // For Gmail emails (from the user's Gmail account)
      if (session?.user?.email && (!email.accountId || email.accountType === 'gmail')) {
        const isGmailConversation =
          (email.from.email === contactEmail &&
            email.to.some((to) => to.email === session.user.email)) ||
          (email.from.email === session.user.email &&
            email.to.some((to) => to.email === contactEmail));

        if (isGmailConversation) {
          console.log(`Including Gmail email: ${email.id}`);
          return true;
        }
      }

      // For IMAP emails
      if (contact?.accountId && email.accountId === contact.accountId) {
        // Fixed IMAP email filtering - don't check for account ID in the to/from fields
        const isImapConversation =
          (email.from.email === contactEmail) ||
          (email.to.some((to) => to.email === contactEmail));

        if (isImapConversation) {
          console.log(`Including IMAP email: ${email.id}`);
          return true;
        }
      }

      return false;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  useEffect(() => {
    console.log(`Conversation contains ${conversation.length} emails`);
  }, [conversation.length]);

  // Add useEffect to handle empty conversation
  useEffect(() => {
    const fetchConversation = async () => {
      if (
        !isLoading &&
        !isRefetching &&
        contactEmail &&
        session?.user?.accessToken &&
        contact && // Make sure we have a contact
        conversation.length === 0 // Only fetch if conversation is empty
      ) {
        setIsRefetching(true);
        toast({
          title: "Loading conversation",
          description: "Fetching messages for this contact...",
        });

        try {
          // For Gmail accounts
          if (!contact.accountId) {
            const fetchedEmails = await fetchEmails(session.user.accessToken);

            // Filter emails for this contact
            const relevantEmails = fetchedEmails.filter(
              (email) =>
                (email.from.email === contactEmail &&
                  email.to.some((to) => to.email === session?.user?.email)) ||
                (email.from.email === session?.user?.email &&
                  email.to.some((to) => to.email === contactEmail))
            );

            if (relevantEmails.length > 0) {
              // Update local storage with new emails
              const existingEmails = new Map(emails.map(e => [e.id, e]));
              relevantEmails.forEach(email => existingEmails.set(email.id, email));

              setEmails(Array.from(existingEmails.values()));

              toast({
                title: "Conversation loaded",
                description: `Found ${relevantEmails.length} messages`,
              });
            } else {
              toast({
                title: "No messages found",
                description: "Start a new conversation",
              });
            }
          }
          // For IMAP accounts
          else if (contact.accountId) {
            const imapAccount = imapAccounts.find(acc => acc.id === contact.accountId);

            if (imapAccount) {
              const response = await fetch("/api/imap", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  action: "fetchEmails",
                  account: imapAccount,
                  data: {
                    filter: {
                      from: contactEmail,
                    },
                    includeBody: true,
                  },
                }),
              });

              const data = await response.json();
              if (data.emails && data.emails.length > 0) {
                // Add these emails to the store
                const existingEmails = new Map(emails.map(e => [e.id, e]));
                data.emails.forEach((email: Email) => existingEmails.set(email.id, email));

                setEmails(Array.from(existingEmails.values()));

                toast({
                  title: "Conversation loaded",
                  description: `Found ${data.emails.length} messages`,
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

    fetchConversation();
  }, [contactEmail, isLoading, isRefetching, session?.user?.accessToken, contact, conversation.length, emails, setEmails, toast, imapAccounts]);

  // Update loading state to include refetching
  const isLoadingState = isLoading || isRefetching;

  if (!contactEmail) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground">
        Select a conversation to view
      </div>
    );
  }

  return (
    <ResizablePanelGroup
      direction="vertical"
      className="flex-1 h-full overflow-hidden"
    >
      {/* Conversation Header Panel */}
      <ResizablePanel
        defaultSize={5}
        minSize={5}
        maxSize={15}
        className="border-b border-border p-4 flex justify-between items-center bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      >
        <div className="flex items-center">
          <Avatar className="h-10 w-10 mr-4">
            <AvatarImage src={getGravatarUrl(contactEmail || "")} />
            <AvatarFallback>{contact?.name?.charAt(0) || "?"}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-medium">{contact?.name || contactEmail}</h2>
            <p className="text-sm text-muted-foreground">{contactEmail}</p>
          </div>
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
            ) : (
              conversation.map((email) => {
                // Fixed isFromMe logic: 
                // For Gmail: check against session.user.email
                // For IMAP: check if this is the account owner's email
                const isFromMe = email.accountType === 'gmail'
                  ? email.from.email === session?.user?.email
                  : email.accountId === contact?.accountId &&
                  !email.from.email.includes(contactEmail);

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
                            {formatDistanceToNow(new Date(email.date), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none overflow-hidden"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(email.body),
                          }}
                        />
                        {/* Attachments */}
                        {email.attachments && email.attachments.length > 0 && (
                          <div key={`attachments-${email.id}`} className="mt-2 grid grid-cols-2 gap-2">
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
                              const mimeType = attachment.mimeType || '';
                              const IconComponent = getAttachmentIcon(mimeType);
                              const isImage = mimeType && mimeType.startsWith("image/");
                              
                              // Generate a safe filename
                              const filename = attachment.filename || `attachment-${index + 1}`;
                              
                              // Handle attachment preview and download safely
                              return (
                                <a
                                  key={attachment.id}
                                  href={attachment.url || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => {
                                    if (!attachment.url) {
                                      e.preventDefault();
                                      toast({
                                        title: "Attachment unavailable",
                                        description: "This attachment cannot be downloaded",
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
                                            e.currentTarget.style.display = 'none';
                                            const container = e.currentTarget.parentElement;
                                            if (container) {
                                              const iconEl = document.createElement('div');
                                              iconEl.className = 'flex items-center justify-center w-full h-full';
                                              iconEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
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
                                      : mimeType.split('/')[0] || 'Unknown'}
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
                        <AvatarImage src={session?.user?.image || ""} />
                        <AvatarFallback>
                          {session?.user?.name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              })
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
              const newEmail = await sendEmail({
                accessToken: session.user.accessToken,
                to: contactEmail,
                subject: `Re: ${contact?.lastMessageSubject || "No subject"}`,
                body: content,
                attachments: uploadedAttachments, // Pass the attachments
              });

              addEmail(newEmail);
              toast({
                title: "Email sent",
                description: "Your reply has been sent successfully",
              });
            } catch (error) {
              console.error("Failed to send email:", error);
              toast({
                title: "Failed to send email",
                description: "Please try again later",
                variant: "destructive",
              });
            } finally {
              setIsSending(false);
            }
          }}
          isLoading={isSending}
          placeholder={`Reply to ${contact?.name || contactEmail}...`}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}