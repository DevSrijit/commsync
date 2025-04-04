"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Send,
  Paperclip,
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Undo,
  Redo,
  Highlighter,
  Strikethrough,
  X,
  Mail,
  Phone,
  MessageSquare,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Strike from "@tiptap/extension-strike";
import Highlight from "@tiptap/extension-highlight";
import { UnderlineIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEmailStore } from "@/lib/email-store";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { htmlToSmsText } from "@/lib/utils";
import { GenerateMessageDialog } from "@/components/ai/GenerateMessageDialog";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import {
  hasEnoughCreditsForFeature,
  AI_CREDIT_COSTS
} from "@/lib/ai-credits";

// Add MessagePlatform type
export type MessagePlatform = "gmail" | "imap" | "twilio" | "justcall";

interface MessageInputProps {
  onSend: (content: string, attachments: File[]) => void;
  isLoading?: boolean;
  placeholder?: string;
  showSend?: boolean;
  customSend?: (content: string, attachments: File[]) => Promise<boolean> | void;
  // Add new props for platform support
  platform?: MessagePlatform | string;
  accountId?: string;
  isGroup?: boolean;
  groupId?: string | null;
  platformOptions?: string[];
  onPlatformChange?: (platform: string, accountId?: string) => void;
  // Add conversation context for AI generation
  conversationContext?: string;
  contactName?: string;
}

export function MessageInput({
  onSend,
  isLoading,
  placeholder,
  showSend = true,
  customSend,
  platform = "gmail",
  accountId,
  isGroup = false,
  groupId = null,
  platformOptions = [],
  onPlatformChange,
  conversationContext = "",
  contactName = "",
}: MessageInputProps) {
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const { data: session } = useSession();
  const { toast } = useToast();

  // State for AI message generation
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);

  // Get accounts for platform selection
  const { imapAccounts, twilioAccounts, justcallAccounts } = useEmailStore();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        dropcursor: {
          color: "rgba(0, 0, 0, 0.3)",
          width: 2,
        },
        history: {
          depth: 100,
          newGroupDelay: 500
        },
        bulletList: {
          HTMLAttributes: {
            class: "list-disc ml-4",
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: "list-decimal ml-4",
          },
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || "Write something …",
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline'
        }
      }),
      Underline,
      Strike,
      Highlight.configure({
        HTMLAttributes: {
          class: 'bg-purple-400 dark:bg-purple-300 px-0.5 rounded',
        }
      }),
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert w-full focus:outline-none min-h-0 flex-grow overflow-y-auto [&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:ml-4 [&_ul>li]:pl-0 [&_ol>li]:pl-0 [&_ul>li]:relative [&_ol>li]:relative [&_ul>li]:marker:absolute [&_ol>li]:marker:left-0 [&_ol>li]:marker:left-0",
      },
    },
    content: "",
  });

  const openLinkDialog = useCallback(() => {
    if (!editor) return;

    const previousUrl = editor.getAttributes('link').href || '';
    setLinkUrl(previousUrl);
    setIsLinkDialogOpen(true);
  }, [editor]);

  const saveLinkHandler = useCallback(() => {
    if (!editor) return;

    // If URL is empty, unset the link
    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      // Add https if no protocol is specified
      const normalizedUrl = linkUrl.startsWith('http://') || linkUrl.startsWith('https://')
        ? linkUrl
        : `https://${linkUrl}`;

      editor.chain().focus().extendMarkRange('link').setLink({ href: normalizedUrl }).run();
    }

    setIsLinkDialogOpen(false);
  }, [editor, linkUrl]);

  const handleSend = () => {
    if (editor && !editor.isEmpty) {
      const content = editor.getHTML();
      // Convert HTML to SMS text if platform is SMS
      const formattedContent = platform === "twilio" || platform === "justcall"
        ? htmlToSmsText(content)
        : content;
      onSend(formattedContent, attachments);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    setAttachments((prev) => [...prev, ...files]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const clearEditor = useCallback(() => {
    if (editor) {
      editor.commands.clearContent(true);
    }
    setAttachments([]);
  }, [editor]);

  // Get platform icon and color
  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "gmail":
      case "imap":
        return <Mail className="h-4 w-4" />;
      case "twilio":
        return <Phone className="h-4 w-4" />;
      case "justcall":
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  // Get readable platform name
  const getPlatformName = (platform: string) => {
    switch (platform) {
      case "gmail":
        return "Gmail";
      case "imap":
        return "Email";
      case "twilio":
        return "Twilio SMS";
      case "justcall":
        return "JustCall SMS";
      default:
        return platform.charAt(0).toUpperCase() + platform.slice(1);
    }
  };

  // Get platform account name or ID
  const getAccountName = (platform: string, accountId?: string) => {
    if (!accountId) {
      return null;
    }

    if (platform === "imap") {
      const account = imapAccounts.find(acc => acc.id === accountId);
      return account?.label || account?.username || "IMAP Account";
    } else if (platform === "twilio") {
      const account = twilioAccounts.find(acc => acc.id === accountId);
      return account?.label || account?.phoneNumber || "Twilio Account";
    } else if (platform === "justcall") {
      const account = justcallAccounts.find(acc => acc.id === accountId);
      return account?.accountIdentifier || "JustCall Account";
    }

    return null;
  };

  // Handle platform change
  const handlePlatformChange = (newPlatform: string) => {
    if (!onPlatformChange) return;

    // Find a default account for the new platform
    let newAccountId;
    if (newPlatform === "gmail") {
      newAccountId = undefined;
    } else if (newPlatform === "imap" && imapAccounts.length > 0) {
      newAccountId = imapAccounts[0].id;
    } else if (newPlatform === "twilio" && twilioAccounts.length > 0) {
      newAccountId = twilioAccounts[0].id;
    } else if (newPlatform === "justcall" && justcallAccounts.length > 0) {
      newAccountId = justcallAccounts[0].id;
    }

    onPlatformChange(newPlatform, newAccountId);
  };

  // Fetch user subscription data on mount or session change
  useEffect(() => {
    async function fetchSubscription() {
      try {
        const response = await fetch('/api/subscription');
        if (!response.ok) throw new Error("Subscription check failed");

        const data = await response.json();
        if (data.subscription) {
          setSubscriptionData(data.subscription);
          console.log("Subscription data fetched for AI generation:", data.subscription);
        }
      } catch (error) {
        console.error("Failed to fetch subscription data:", error);
        setSubscriptionData(null);
      }
    }

    if (session) {
      fetchSubscription();
    } else {
      setSubscriptionData(null);
    }
  }, [session]);

  // Handler for AI message generation button
  const handleGenerateMessage = async () => {
    // Check subscription data
    if (!subscriptionData) {
      try {
        // Quick attempt to get subscription data
        const response = await fetch('/api/subscription');
        if (!response.ok) throw new Error("Subscription check failed");

        const data = await response.json();
        if (data.subscription) {
          setSubscriptionData(data.subscription);

          // Continue with credit check
          const hasCredits = await hasEnoughCreditsForFeature(
            data.subscription,
            'GENERATE_RESPONSE'
          );

          if (!hasCredits) {
            toast({
              title: "Insufficient AI Credits",
              description: `You need ${AI_CREDIT_COSTS.GENERATE_RESPONSE} credits to generate a message. Please upgrade or check your usage.`,
              variant: "destructive",
            });
            return;
          }

          // If we have credits, open dialog
          setIsGenerateDialogOpen(true);
          return;
        }
      } catch (error) {
        console.warn("Subscription check failed:", error);
      }

      // Even if subscription check fails, still allow dialog
      setIsGenerateDialogOpen(true);
      return;
    }

    // Check for credits if we already have subscription data
    const hasEnoughCredits = await hasEnoughCreditsForFeature(
      subscriptionData,
      'GENERATE_RESPONSE'
    );

    if (!hasEnoughCredits) {
      toast({
        title: "Insufficient AI Credits",
        description: `You need ${AI_CREDIT_COSTS.GENERATE_RESPONSE} credits to generate a message. Please upgrade or check your usage.`,
        variant: "destructive",
      });
      return;
    }

    // Open the dialog
    setIsGenerateDialogOpen(true);
  };

  return (
    <>
      <div
        className="border rounded-lg bg-background flex flex-col w-full h-full"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {editor && (
          <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
            <div className="flex items-center gap-1 rounded-md border bg-background shadow-md">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={cn(
                  "flex-shrink-0",
                  editor.isActive("bold") && "bg-muted"
                )}
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={cn(
                  "flex-shrink-0",
                  editor.isActive("italic") && "bg-muted"
                )}
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={cn(
                  "flex-shrink-0",
                  editor.isActive("underline") && "bg-muted"
                )}
              >
                <UnderlineIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={cn(
                  "flex-shrink-0",
                  editor.isActive("strike") && "bg-muted"
                )}
              >
                <Strikethrough className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                className={cn(
                  "flex-shrink-0",
                  editor.isActive("highlight") && "bg-muted"
                )}
              >
                <Highlighter className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={openLinkDialog}
                className={cn(
                  "flex-shrink-0",
                  editor.isActive("link") && "bg-muted"
                )}
              >
                <LinkIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={cn(
                  "flex-shrink-0",
                  editor.isActive("bulletList") && "bg-muted"
                )}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={cn(
                  "flex-shrink-0",
                  editor.isActive("orderedList") && "bg-muted"
                )}
              >
                <ListOrdered className="h-4 w-4" />
              </Button>
            </div>
          </BubbleMenu>
        )}

        <div className="flex items-center justify-between gap-2 border-b p-2 flex-shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleBold().run()}
              className={cn(
                "flex-shrink-0",
                editor?.isActive("bold") && "bg-muted"
              )}
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              className={cn(
                "flex-shrink-0",
                editor?.isActive("italic") && "bg-muted"
              )}
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              className={cn(
                "flex-shrink-0",
                editor?.isActive("underline") && "bg-muted"
              )}
            >
              <UnderlineIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleStrike().run()}
              className={cn(
                "flex-shrink-0",
                editor?.isActive("strike") && "bg-muted"
              )}
            >
              <Strikethrough className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleHighlight().run()}
              className={cn(
                "flex-shrink-0",
                editor?.isActive("highlight") && "bg-muted"
              )}
            >
              <Highlighter className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={openLinkDialog}
              className={cn(
                "flex-shrink-0",
                editor?.isActive("link") && "bg-muted"
              )}
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              className={cn(
                "flex-shrink-0",
                editor?.isActive("bulletList") && "bg-muted"
              )}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              className={cn(
                "flex-shrink-0",
                editor?.isActive("orderedList") && "bg-muted"
              )}
            >
              <ListOrdered className="h-4 w-4" />
            </Button>

            {/* Add AI generation button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerateMessage}
              className="flex-shrink-0 ml-1"
              title="Generate AI message"
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </div>

          {/* Platform indicator/selector if options are available */}
          {platformOptions.length > 0 && onPlatformChange ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-1.5">
                  {getPlatformIcon(platform)}
                  <span className="text-xs font-medium">{getPlatformName(platform)}</span>
                  {getAccountName(platform, accountId) && (
                    <span className="text-xs text-muted-foreground ml-1">
                      ({getAccountName(platform, accountId)})
                    </span>
                  )}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-0" align="end">
                <div className="flex flex-col py-1">
                  {platformOptions.map((option) => (
                    <Button
                      key={option}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "justify-start rounded-none",
                        platform === option && "bg-muted"
                      )}
                      onClick={() => handlePlatformChange(option)}
                    >
                      <div className="flex items-center gap-2">
                        {getPlatformIcon(option)}
                        <span>{getPlatformName(option)}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            /* Static platform indicator if no options */
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/30 text-xs">
              {getPlatformIcon(platform)}
              <span className="font-medium">{getPlatformName(platform)}</span>
              {getAccountName(platform, accountId) && (
                <span className="text-muted-foreground">
                  ({getAccountName(platform, accountId)})
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 p-2 overflow-y-auto">
          <EditorContent editor={editor} className="h-full" />
        </div>

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 py-2 border-t flex-shrink-0">
            {attachments.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-muted px-3 py-1 rounded-full text-sm flex-shrink-0"
              >
                <span className="truncate max-w-[200px]">{file.name}</span>
                <button
                  onClick={() => removeAttachment(index)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center p-2 border-t flex-shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              multiple
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              title="Attach files"
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            {/* Add AI generation button here too for easy access */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleGenerateMessage}
              title="Generate AI message"
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </div>

          {showSend && (
            <Button
              onClick={async () => {
                if (editor && !editor.isEmpty) {
                  const content = editor.getHTML();
                  // Convert HTML to SMS text if platform is SMS
                  const formattedContent = platform === "twilio" || platform === "justcall"
                    ? htmlToSmsText(content)
                    : content;

                  // First save content via handleSend to update parent state
                  onSend(formattedContent, attachments);

                  // Then trigger custom send action if provided, passing current content directly
                  if (customSend) {
                    try {
                      const result = await Promise.resolve(customSend(formattedContent, attachments));
                      // If customSend returns successfully or returns true, clear the editor
                      if (result !== false) {
                        clearEditor();
                      }
                    } catch (error) {
                      // Don't clear the editor if there was an error
                      console.error("Error sending message:", error);
                    }
                  } else {
                    // If no customSend provided, we assume success and clear
                    clearEditor();
                  }
                }
              }}
              disabled={!editor || editor.isEmpty || isLoading}
              className="rounded-full"
            >
              <Send className="h-4 w-4" />
            </Button>)}

        </div>
      </div>

      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insert link</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="url" className="text-right">
                URL
              </Label>
              <Input
                id="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="col-span-3"
                autoComplete="off"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setIsLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveLinkHandler}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Message Generation Dialog */}
      {isGenerateDialogOpen && (
        <GenerateMessageDialog
          isOpen={isGenerateDialogOpen}
          onOpenChange={setIsGenerateDialogOpen}
          conversationContext={conversationContext}
          contactName={contactName}
          platform={platform}
          subscriptionId={subscriptionData?.id || null}
          userId={session?.user?.id || null}
          onMessageGenerated={(generatedMessage) => {
            // Insert the generated message into the editor
            if (editor && generatedMessage) {
              // For SMS platforms, convert to plain text
              const formattedMessage = (platform === "twilio" || platform === "justcall")
                ? htmlToSmsText(generatedMessage)
                : generatedMessage;

              editor.commands.setContent(formattedMessage);
              toast({
                title: "Message inserted",
                description: "AI-generated message has been added to the editor",
              });
            }
          }}
        />
      )}
    </>
  );
}
