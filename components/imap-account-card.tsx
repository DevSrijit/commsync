"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEmailStore } from "@/lib/email-store";
import { ImapAccount } from "@/lib/imap-service";
import { formatDistanceToNow } from "date-fns";
import { RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface ImapAccountCardProps {
  account: ImapAccount;
}

export function ImapAccountCard({ account }: ImapAccountCardProps) {
  const { removeImapAccount } = useEmailStore();
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    handleSync();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
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
            pageSize: 50,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to sync emails");
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
      }));

      // Update the email store with fetched emails
      const store = useEmailStore.getState();
      store.setEmails([...store.emails, ...formattedEmails]);

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

      toast({
        title: "Sync successful",
        description: `Synced ${formattedEmails.length} emails from ${account.label}`,
      });
    } catch (error) {
      toast({
        title: "Sync failed",
        description: "Failed to sync emails. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async () => {
    try {
      const response = await fetch("/api/imap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "deleteAccount",
          data: {
            accountId: account.id,
          }
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete account");
      }

      removeImapAccount(account.id!);
      toast({
        title: "Account removed",
        description: `${account.label} has been removed successfully`,
      });
    } catch (error) {
      toast({
        title: "Failed to remove account",
        description: "Please try again later",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="w-full mx-2 mb-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 pt-3">
        <CardTitle className="text-sm font-medium truncate flex-1">
          {account.label}
        </CardTitle>
        <div className="flex items-center gap-1 ml-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleSync}
            disabled={isSyncing}
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        <div className="text-xs text-muted-foreground space-y-0.5">
          <p className="truncate">Host: {account.host}</p>
          <p>Port: {account.port}</p>
          <p className="truncate">Username: {account.username}</p>
          <p>
            Last sync:{" "}
            {account.lastSync
              ? formatDistanceToNow(new Date(account.lastSync), {
                addSuffix: true,
                includeSeconds: true
              })
              : "Never"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}