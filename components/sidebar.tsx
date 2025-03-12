"use client";

import { signOut, useSession } from "next-auth/react";
import {
  Archive,
  ChevronDown,
  Inbox,
  LogOut,
  Mail,
  Send,
  Star,
  Trash,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEmailStore } from "@/lib/email-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "./ui/separator";
import { cn } from "@/lib/utils";

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
  const { emails, setActiveFilter, activeFilter } = useEmailStore();

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

  return (
    <div className="w-full border-r border-border bg-card flex flex-col h-full">
      <div className="p-4 border-b border-border flex-shrink-0">
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
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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
      </ScrollArea>

      <Separator />
    </div>
  );
}
