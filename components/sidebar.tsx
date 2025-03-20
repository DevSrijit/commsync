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
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "./ui/separator";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
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
import { JustCallAccountDialog } from "./justcall-account-dialog";
import { JustCallAccountCard } from "./justcall-account-card";
import { Badge } from "./ui/badge";
import { ImapAccountCard } from "./imap-account-card";
import GroupDialog from "./group-dialog";
import { TwilioAccountDialog } from "./twilio-account-dialog";

export type MessageCategory =
  | "inbox"
  | "draft"
  | "sent"
  | "starred"
  | "trash"
  | "archive"
  | "sms"
  | "all";

export function Sidebar() {
  const { data: session } = useSession();
  const { emails, setActiveFilter, activeFilter, imapAccounts } =
    useEmailStore();
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

  return (
    <div className="w-full border-r border-border bg-card flex flex-col h-full">
      <div className="p-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={session?.user?.image || ""} />
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
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => signOut()}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button
          variant="secondary"
          className="w-full mt-4"
          size="sm"
          onClick={() => setIsComposerOpen(true)}
        >
          <PenSquare className="h-4 w-4 mr-2" />
          Compose
        </Button>

        <Separator className="my-4" />
      </div>
      
      <ScrollArea className="flex-1">
        <div className="px-2 mb-4">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start mb-1 px-3 py-2 text-sm font-medium",
              activeFilter === "inbox" && "bg-accent text-accent-foreground"
            )}
            onClick={() => setActiveFilter("inbox")}
          >
            <Inbox className="h-4 w-4 mr-2" />
            <span className="flex-1 text-left">Inbox</span>
            <span className="ml-auto text-xs font-medium bg-muted/80 px-2 py-0.5 rounded-full">{inboxCount}</span>
          </Button>
          
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start mb-1 px-3 py-2 text-sm font-medium",
              activeFilter === "draft" && "bg-accent text-accent-foreground"
            )}
            onClick={() => setActiveFilter("draft")}
          >
            <PenSquare className="h-4 w-4 mr-2" />
            <span className="flex-1 text-left">Drafts</span>
            <span className="ml-auto text-xs font-medium bg-muted/80 px-2 py-0.5 rounded-full">{draftCount}</span>
          </Button>
          
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start mb-1 px-3 py-2 text-sm font-medium",
              activeFilter === "sent" && "bg-accent text-accent-foreground"
            )}
            onClick={() => setActiveFilter("sent")}
          >
            <Send className="h-4 w-4 mr-2" />
            <span className="flex-1 text-left">Sent</span>
            <span className="ml-auto text-xs font-medium bg-muted/80 px-2 py-0.5 rounded-full">{sentCount}</span>
          </Button>
          
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start mb-1 px-3 py-2 text-sm font-medium",
              activeFilter === "starred" && "bg-accent text-accent-foreground"
            )}
            onClick={() => setActiveFilter("starred")}
          >
            <Star className="h-4 w-4 mr-2" />
            <span className="flex-1 text-left">Starred</span>
            <span className="ml-auto text-xs font-medium bg-muted/80 px-2 py-0.5 rounded-full">{starredCount}</span>
          </Button>
          
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start mb-1 px-3 py-2 text-sm font-medium",
              activeFilter === "trash" && "bg-accent text-accent-foreground"
            )}
            onClick={() => setActiveFilter("trash")}
          >
            <Trash className="h-4 w-4 mr-2" />
            <span className="flex-1 text-left">Trash</span>
            <span className="ml-auto text-xs font-medium bg-muted/80 px-2 py-0.5 rounded-full">{trashCount}</span>
          </Button>
          
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start mb-1 px-3 py-2 text-sm font-medium",
              activeFilter === "archive" && "bg-accent text-accent-foreground"
            )}
            onClick={() => setActiveFilter("archive")}
          >
            <Archive className="h-4 w-4 mr-2" />
            <span className="flex-1 text-left">Archive</span>
            <span className="ml-auto text-xs font-medium bg-muted/80 px-2 py-0.5 rounded-full">{archiveCount}</span>
          </Button>
          
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start mb-1 px-3 py-2 text-sm font-medium",
              activeFilter === "sms" && "bg-accent text-accent-foreground"
            )}
            onClick={() => setActiveFilter("sms")}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            <span className="flex-1 text-left">SMS</span>
            <span className="ml-auto text-xs font-medium bg-muted/80 px-2 py-0.5 rounded-full">
              {emails.filter(email => 
                email.accountType === 'twilio' || 
                email.accountType === 'justcall' || 
                (email.labels && email.labels.includes('SMS'))
              ).length}
            </span>
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start mb-1 px-3 py-2 text-sm font-medium"
            disabled={isSyncingSMS}
            onClick={async () => {
              try {
                setIsSyncingSMS(true);
                await Promise.all([
                  useEmailStore.getState().syncTwilioAccounts(),
                  useEmailStore.getState().syncJustcallAccounts()
                ]);
              } catch (error) {
                console.error("Error syncing SMS messages:", error);
              } finally {
                setIsSyncingSMS(false);
              }
            }}
          >
            <div className="flex items-center w-full">
              <MessageSquare className="h-4 w-4 mr-2" />
              <span className="flex-1 text-left">Sync SMS</span>
              {isSyncingSMS && (
                <span className="ml-2 animate-spin">⟳</span>
              )}
            </div>
          </Button>
        </div>

        <div className="px-4 pt-2 pb-1">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Accounts</h2>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsImapDialogOpen(true)}>
                  <Mail className="h-4 w-4 mr-2" />
                  <span>Email Account</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsJustCallDialogOpen(true)}>
                  <Phone className="h-4 w-4 mr-2" />
                  <span>JustCall Account</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsTwilioDialogOpen(true)}>
                  <SiTwilio className="h-4 w-4 mr-2" />
                  <span>Twilio Account</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsGroupDialogOpen(true)}>
                  <Users className="h-4 w-4 mr-2" />
                  <span>Add Contact</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        <div className="px-2">
          <Button
            variant="ghost"
            className="w-full justify-start mb-1 px-3 py-2 text-sm font-medium"
            onClick={() => setIsImapListOpen(true)}
          >
            <Mail className="h-4 w-4 mr-2" />
            <span className="flex-1 text-left">Email Accounts</span>
            <span className="ml-auto text-xs font-medium bg-muted/80 px-2 py-0.5 rounded-full">{imapAccounts.length}</span>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start mb-1 px-3 py-2 text-sm font-medium"
            disabled={isSyncingEmail}
            onClick={async () => {
              try {
                setIsSyncingEmail(true);
                await useEmailStore.getState().syncImapAccounts();
              } catch (error) {
                console.error("Error syncing IMAP accounts:", error);
              } finally {
                setIsSyncingEmail(false);
              }
            }}
          >
            <div className="flex items-center w-full">
              <Mail className="h-4 w-4 mr-2" />
              <span className="flex-1 text-left">Sync Email</span>
              {isSyncingEmail && (
                <span className="ml-2 animate-spin">⟳</span>
              )}
            </div>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start mb-1 px-3 py-2 text-sm font-medium"
            onClick={() => setIsJustCallListOpen(true)}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            <span className="flex-1 text-left">JustCall Accounts</span>
            <span className="ml-auto text-xs font-medium bg-muted/80 px-2 py-0.5 rounded-full">{justCallAccounts.length}</span>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start mb-1 px-3 py-2 text-sm font-medium"
            onClick={() => setIsTwilioListOpen(true)}
          >
            <SiTwilio className="h-4 w-4 mr-2" />
            <span className="flex-1 text-left">Twilio Accounts</span>
            <span className="ml-auto text-xs font-medium bg-muted/80 px-2 py-0.5 rounded-full">{twilioAccounts.length}</span>
          </Button>
        </div>
      </ScrollArea>

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
    </div>
  );
}
