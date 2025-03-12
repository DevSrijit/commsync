"use client"

import { useState } from "react"
import { MessageInput } from "@/components/message-input"
import { formatDistanceToNow } from "date-fns"
import { useEmailStore } from "@/lib/email-store"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useSession } from "next-auth/react"
import { sendEmail } from "@/lib/gmail-api"
import { useToast } from "@/hooks/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Paperclip } from "lucide-react"

interface ConversationViewProps {
  contactEmail: string | null
  isLoading: boolean
}

export function ConversationView({ contactEmail, isLoading }: ConversationViewProps) {
  const { data: session } = useSession()
  const { emails, contacts, addEmail } = useEmailStore()
  const [replyText, setReplyText] = useState("")
  const [isSending, setIsSending] = useState(false)
  const { toast } = useToast()

  const contact = contacts.find((c) => c.email === contactEmail)
  const conversation = emails
    .filter(
      (email) =>
        (email.from.email === contactEmail && email.to.some((to) => to.email === session?.user?.email)) ||
        (email.from.email === session?.user?.email && email.to.some((to) => to.email === contactEmail)),
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const handleSendReply = async () => {
    if (!contactEmail || !replyText.trim() || !session?.user?.accessToken) return

    setIsSending(true)
    try {
      const newEmail = await sendEmail({
        accessToken: session.user.accessToken,
        to: contactEmail,
        subject: `Re: ${contact?.lastMessageSubject || "No subject"}`,
        body: replyText,
      })

      addEmail(newEmail)
      setReplyText("")
      toast({
        title: "Email sent",
        description: "Your reply has been sent successfully",
      })
    } catch (error) {
      console.error("Failed to send email:", error)
      toast({
        title: "Failed to send email",
        description: "Please try again later",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  if (!contactEmail) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground">
        Select a conversation to view
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      <div className="border-b border-border p-4 flex justify-between items-center bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center">
          <Avatar className="h-10 w-10 mr-4">
            <AvatarFallback>{contact?.name.charAt(0) || "?"}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-medium">{contact?.name || contactEmail}</h2>
            <p className="text-sm text-muted-foreground">{contactEmail}</p>
          </div>
        </div>
      </div>

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
              const isFromMe = email.from.email === session?.user?.email

              return (
                <div
                  key={email.id}
                  className={`flex ${isFromMe ? "justify-end" : "justify-start"} gap-3 items-end`}
                >
                  {!isFromMe && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{contact?.name.charAt(0) || "?"}</AvatarFallback>
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
                        <span className="font-medium text-sm">{email.subject}</span>
                        <span className="text-xs opacity-70">
                          {formatDistanceToNow(new Date(email.date), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {email.body}
                      </div>
                      {email.attachments && email.attachments.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {email.attachments.map((attachment) => (
                            <div
                              key={attachment.id}
                              className="flex items-center gap-2 bg-background/10 rounded-lg p-2 text-sm"
                            >
                              <Paperclip className="h-4 w-4" />
                              <span className="truncate flex-1">{attachment.name}</span>
                              <span className="text-xs opacity-70">
                                {Math.round(attachment.size / 1024)}KB
                              </span>
                              {attachment.url && (
                                <a
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary-foreground/70 hover:text-primary-foreground"
                                >
                                  Download
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {isFromMe && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{session?.user?.name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border p-4 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-3xl mx-auto">
          <MessageInput
            onSend={async (content, attachments) => {
              if (!contactEmail || !session?.user?.accessToken) return

              setIsSending(true)
              try {
                const newEmail = await sendEmail({
                  accessToken: session.user.accessToken,
                  to: contactEmail,
                  subject: `Re: ${contact?.lastMessageSubject || "No subject"}`,
                  body: content,
                })

                addEmail(newEmail)
                toast({
                  title: "Email sent",
                  description: "Your reply has been sent successfully",
                })
              } catch (error) {
                console.error("Failed to send email:", error)
                toast({
                  title: "Failed to send email",
                  description: "Please try again later",
                  variant: "destructive",
                })
              } finally {
                setIsSending(false)
              }
            }}
            isLoading={isSending}
            placeholder={`Reply to ${contact?.name || contactEmail}...`}
          />
        </div>
      </div>
    </div>
  )
}

