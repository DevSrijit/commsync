"use client";

import { useState } from "react";
import { MessageInput } from "@/components/message-input";
import { formatDistanceToNow } from "date-fns";
import { useEmailStore } from "@/lib/email-store";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

interface ConversationViewProps {
  contactEmail: string | null;
  isLoading: boolean;
}

const getAttachmentIcon = (mimeType: string) => {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.startsWith("text/")) return FileText;
  return File;
};

export function ConversationView({
  contactEmail,
  isLoading,
}: ConversationViewProps) {
  const { data: session } = useSession();
  const { emails, contacts, addEmail } = useEmailStore();
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const contact = contacts.find((c) => c.email === contactEmail);
  const conversation = emails
    .filter(
      (email) =>
        (email.from.email === contactEmail &&
          email.to.some((to) => to.email === session?.user?.email)) ||
        (email.from.email === session?.user?.email &&
          email.to.some((to) => to.email === contactEmail))
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (!contactEmail) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground">
        Select a conversation to view
      </div>
    );
  }

  return (
    <ResizablePanelGroup direction="vertical">
      <div className="flex-1 flex flex-col h-full bg-background">
        <ResizablePanel
          className="border-b border-border p-4 flex justify-between items-center bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-background/60"
          defaultSize={5}
          maxSize={10}
          minSize={5}
        >
          <div className="flex items-center">
            <Avatar className="h-10 w-10 mr-4">
              <AvatarFallback>{contact?.name.charAt(0) || "?"}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-medium">{contact?.name || contactEmail}</h2>
              <p className="text-sm text-muted-foreground">{contactEmail}</p>
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4 max-w-5xl mx-auto">
              {isLoading ? (
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
                      className={`flex ${
                        isFromMe ? "justify-end" : "justify-start"
                      } gap-3 items-end`}
                    >
                      {!isFromMe && (
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {contact?.name.charAt(0) || "?"}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={`max-w-[85%] rounded-2xl p-4 ${
                          isFromMe
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
                          {email.attachments &&
                            email.attachments.length > 0 && (
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
                                      href={`${attachment.url}&access_token=${session?.user?.accessToken}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="group relative flex flex-col gap-1 p-2 bg-background/10 rounded-lg hover:bg-background/20 transition-colors"
                                    >
                                      {isImage ? (
                                        <div className="aspect-video relative rounded-md overflow-hidden bg-background/20">
                                          <img
                                            src={`${attachment.url}&access_token=${session?.user?.accessToken}`}
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
                      {isFromMe && (
                        <Avatar className="h-8 w-8">
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
        <ResizablePanel
          className="border-t border-border p-4 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-background/60"
          defaultSize={20}
          maxSize={35}
          minSize={10}
        >
          <div className="max-w-full mx-auto h-full">
            <MessageInput
              onSend={async (content, attachments) => {
                if (!contactEmail || !session?.user?.accessToken) return;

                setIsSending(true);
                try {
                  const newEmail = await sendEmail({
                    accessToken: session.user.accessToken,
                    to: contactEmail,
                    subject: `Re: ${
                      contact?.lastMessageSubject || "No subject"
                    }`,
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
          </div>
        </ResizablePanel>
      </div>
    </ResizablePanelGroup>
  );
}
