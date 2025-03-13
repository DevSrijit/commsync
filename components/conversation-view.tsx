"use client";

import { useState } from "react";
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
import { useEffect } from "react";
import { fetchEmails } from "@/lib/gmail-api";

interface ConversationViewProps {
  contactEmail: string | null;
  isLoading: boolean;
}

const getAttachmentIcon = (mimeType: string) => {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.startsWith("text/")) return FileText;
  return File;
};

// Add this helper function at the top of the file
const getGravatarUrl = (email: string) => {
  const firstChar = email.charAt(0).toLowerCase();
  const img = `https://avatar.iran.liara.run/username?username=${firstChar}`
  return img;
};

export function ConversationView({
  contactEmail,
  isLoading,
}: ConversationViewProps) {
  const { data: session } = useSession();
  const { emails, contacts, addEmail, setEmails } = useEmailStore();
  const [isSending, setIsSending] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const { toast } = useToast();

  const contact = contacts.find((c) => c.email === contactEmail);

  // Filter all emails related to this conversation
  const conversation = emails
    .filter(
      (email) =>
        (email.from.email === contactEmail &&
          email.to.some((to) => to.email === session?.user?.email)) ||
        (email.from.email === session?.user?.email &&
          email.to.some((to) => to.email === contactEmail))
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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
  }, [contactEmail, isLoading, isRefetching, session?.user?.accessToken, contact, conversation.length, emails, setEmails, toast]);

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
                const isFromMe = email.from.email === session?.user?.email;
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
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            {email.attachments.map((attachment) => {
                              const IconComponent = getAttachmentIcon(
                                attachment.mimeType
                              );
                              const isImage =
                                attachment.mimeType.startsWith("image/");

                              return (
                                <a
                                  key={attachment.id}
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    if (attachment.url) {
                                      window.open(attachment.url, "_blank");
                                      fetch(attachment.url, {
                                        headers: {
                                          Authorization: `Bearer ${session?.user?.accessToken}`,
                                        },
                                      }).catch((error) => {
                                        console.error(
                                          "Error downloading attachment:",
                                          error
                                        );
                                      });
                                    }
                                  }}
                                  className="group relative flex flex-col gap-1 p-2 bg-background/10 rounded-lg hover:bg-background/20 transition-colors"
                                >
                                  {isImage ? (
                                    <div className="aspect-video relative rounded-md overflow-hidden bg-background/20">
                                      <img
                                        src={attachment.url}
                                        alt={attachment.name}
                                        className="absolute inset-0 w-full h-full object-cover"
                                      />
                                    </div>
                                  ) : (
                                    <div className="aspect-video flex items-center justify-center bg-background/20 rounded-md">
                                      <IconComponent className="h-8 w-8 opacity-50" />
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <Paperclip className="h-3 w-3 flex-shrink-0 opacity-50" />
                                    <span className="text-xs truncate flex-1">
                                      {attachment.name}
                                    </span>
                                    <span className="text-xs opacity-70">
                                      {Math.round(attachment.size / 1024)}KB
                                    </span>
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
          onSend={async (content, attachments) => {
            if (!contactEmail || !session?.user?.accessToken) return;

            setIsSending(true);
            try {
              const newEmail = await sendEmail({
                accessToken: session.user.accessToken,
                to: contactEmail,
                subject: `Re: ${contact?.lastMessageSubject || "No subject"}`,
                body: content,
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

