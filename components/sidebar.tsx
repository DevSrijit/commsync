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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEmailStore } from "@/lib/email-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "./ui/separator";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { MessageComposer } from "./message-composer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
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
import { Badge } from "./ui/badge";

export type MessageCategory =
  | "inbox"
  | "draft"
  | "sent"
  | "starred"
  | "trash"
  | "archive"
  | "all";

export function Sidebar() {
  const { data: session } = useSession();
  const { emails, setActiveFilter, activeFilter, imapAccounts } = useEmailStore();
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isImapDialogOpen, setIsImapDialogOpen] = useState(false);

  const inboxCount = emails.filter(
    (email) => !email.labels.includes("TRASH") && !email.labels.includes("SENT")
  ).length;
  const draftCount = emails.filter((email) =>
    email.labels.includes("DRAFT")
  ).length;
  const sentCount = emails.filter((email) =>
    email.labels.includes("SENT")
  ).length;
  const trashCount = emails.filter((email) =>
    email.labels.includes("TRASH")
  ).length;
  const starredCount = emails.filter((email) =>
    email.labels.includes("STARRED")
  ).length;
  const archiveCount = emails.filter((email) =>
    email.labels.includes("ARCHIVE")
  ).length;

  const handleSendMessage = async (recipients: string, subject: string, content: string, attachments: File[]) => {
    // Implementation for sending the message
    // For now just log and wait to simulate sending
    console.log("Sending message:", { recipients, subject, content, attachments });
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  return (
    <div className="w-full border-r border-border bg-card flex flex-col h-full">
      <div className="p-4 flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start">
              <Avatar className="h-6 w-6 mr-2">
                <AvatarImage src={session?.user?.image || ""} />
                <AvatarFallback>
                  {session?.user?.name?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
              {session?.user?.name || "User"}
              <ChevronDown className="ml-auto h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={() => setIsImapDialogOpen(true)}>
              <Server className="mr-2 h-4 w-4" />
              Add IMAP Account
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Separator className="mb-5" />

      <ScrollArea className="flex-1 py-2">
        <nav className="grid gap-1 px-2">
          <Button
            variant="ghost"
            className={cn(
              "justify-start w-full",
              activeFilter === "inbox" && "bg-neutral-100 dark:bg-neutral-800"
            )}
            onClick={() => setActiveFilter("inbox")}
          >
            <Inbox className="mr-2 h-4 w-4" />
            Inbox
            <span className="ml-auto text-muted-foreground text-sm">
              {inboxCount}
            </span>
          </Button>
          <Button
            variant="ghost"
            className={cn(
              "justify-start w-full",
              activeFilter === "draft" && "bg-neutral-100 dark:bg-neutral-800"
            )}
            onClick={() => setActiveFilter("draft")}
          >
            <Mail className="mr-2 h-4 w-4" />
            Drafts
            <span className="ml-auto text-muted-foreground text-sm">
              {draftCount}
            </span>
          </Button>
          <Button
            variant="ghost"
            className={cn(
              "justify-start w-full",
              activeFilter === "sent" && "bg-neutral-100 dark:bg-neutral-800"
            )}
            onClick={() => setActiveFilter("sent")}
          >
            <Send className="mr-2 h-4 w-4" />
            Sent
            <span className="ml-auto text-muted-foreground text-sm">
              {sentCount}
            </span>
          </Button>
          <Button
            variant="ghost"
            className={cn(
              "justify-start w-full",
              activeFilter === "starred" && "bg-neutral-100 dark:bg-neutral-800"
            )}
            onClick={() => setActiveFilter("starred")}
          >
            <Star className="mr-2 h-4 w-4" />
            Starred
            <span className="ml-auto text-muted-foreground text-sm">
              {starredCount}
            </span>
          </Button>
          <Button
            variant="ghost"
            className={cn(
              "justify-start w-full",
              activeFilter === "trash" && "bg-neutral-100 dark:bg-neutral-800"
            )}
            onClick={() => setActiveFilter("trash")}
          >
            <Trash className="mr-2 h-4 w-4" />
            Trash
            <span className="ml-auto text-muted-foreground text-sm">
              {trashCount}
            </span>
          </Button>
          <Button
            variant="ghost"
            className={cn(
              "justify-start w-full",
              activeFilter === "archive" && "bg-neutral-100 dark:bg-neutral-800"
            )}
            onClick={() => setActiveFilter("archive")}
          >
            <Archive className="mr-2 h-4 w-4" />
            Archive
            <span className="ml-auto text-muted-foreground text-sm">
              {archiveCount}
            </span>
          </Button>
        </nav>

        <Separator className="my-5" />

        {/* New Message Button */}
        <div className="px-2">
          <Button
            variant="default"
            className="w-full flex items-center gap-2 bg-neutral-400"
            onClick={() => setIsComposerOpen(true)}
          >
            <PenSquare className="h-4 w-4" />
            <span>New Message</span>
          </Button>
        </div>
      </ScrollArea>

      {/* Message Composer */}
      <MessageComposer
        open={isComposerOpen}
        onOpenChange={setIsComposerOpen}
        onSend={async (recipients, subject, content, attachments) => {
          // This is a fallback and won't be used with our new implementation
          console.log("Legacy send method called");
          await new Promise(resolve => setTimeout(resolve, 1000));
        }}
      />

      {/* IMAP Account Dialog */}
      <ImapAccountDialog
        open={isImapDialogOpen}
        onOpenChange={setIsImapDialogOpen}
      />
    </div>
  );
}
