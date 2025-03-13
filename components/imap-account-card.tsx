"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEmailStore } from "@/lib/email-store";
import { ImapAccount } from "@/lib/imap-service";
import { formatDistanceToNow } from "date-fns";
import { RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface ImapAccountCardProps {
  account: ImapAccount;
}

export function ImapAccountCard({ account }: ImapAccountCardProps) {
  const { removeImapAccount } = useEmailStore();
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

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
      toast({
        title: "Sync successful",
        description: `Synced ${data.emails.length} emails from ${account.label}`,
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
          accountId: account.id,
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
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{account.label}</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSync}
            disabled={isSyncing}
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-xs text-muted-foreground">
          <p>Host: {account.host}</p>
          <p>Port: {account.port}</p>
          <p>Username: {account.username}</p>
          <p>
            Last sync:{" "}
            {account.lastSync
              ? formatDistanceToNow(new Date(account.lastSync), {
                  addSuffix: true,
                })
              : "Never"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}