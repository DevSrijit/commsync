import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TwilioAccountDialog } from "@/components/twilio-account-dialog";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "./loading-spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Trash2,
  RefreshCw,
  MessageSquare,
  Phone,
} from "lucide-react";

type TwilioAccount = {
  id: string;
  label: string;
  phoneNumber: string;
  accountSid: string;
  lastSync: string;
  createdAt: string;
  updatedAt: string;
};

export function TwilioAccounts() {
  const [accounts, setAccounts] = useState<TwilioAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setSyncing] = useState<{ [key: string]: boolean }>({});
  const [isDeleting, setDeleting] = useState<{ [key: string]: boolean }>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/twilio/account");
      if (!res.ok) {
        throw new Error("Failed to fetch accounts");
      }
      const data = await res.json();
      setAccounts(data);
    } catch (error) {
      console.error("Error fetching Twilio accounts:", error);
      toast({
        title: "Error",
        description: "Failed to load Twilio accounts",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSync = async (accountId: string) => {
    setSyncing((prev) => ({ ...prev, [accountId]: true }));
    try {
      const res = await fetch("/api/twilio/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ twilioAccountId: accountId }),
      });

      if (!res.ok) {
        throw new Error("Failed to sync messages");
      }

      const data = await res.json();
      toast({
        title: "Sync completed",
        description: `Processed: ${data.results.processed}, Skipped: ${data.results.skipped}, Failed: ${data.results.failed}`,
      });

      // Refresh the account list to update lastSync time
      fetchAccounts();
    } catch (error) {
      console.error("Error syncing Twilio messages:", error);
      toast({
        title: "Error",
        description: "Failed to sync Twilio messages",
        variant: "destructive",
      });
    } finally {
      setSyncing((prev) => ({ ...prev, [accountId]: false }));
    }
  };

  const handleDelete = async (accountId: string) => {
    if (!window.confirm("Are you sure you want to delete this account? All messages associated with this account will be deleted.")) {
      return;
    }

    setDeleting((prev) => ({ ...prev, [accountId]: true }));
    try {
      const res = await fetch(`/api/twilio/account?id=${accountId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete account");
      }

      toast({
        title: "Account deleted",
        description: "Twilio account has been deleted successfully",
      });

      // Remove from the local state
      setAccounts((prev) => prev.filter((account) => account.id !== accountId));
    } catch (error) {
      console.error("Error deleting Twilio account:", error);
      toast({
        title: "Error",
        description: "Failed to delete Twilio account",
        variant: "destructive",
      });
    } finally {
      setDeleting((prev) => ({ ...prev, [accountId]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Twilio Accounts</h2>
        <Button onClick={() => setDialogOpen(true)}>Add Account</Button>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-muted p-8 rounded-lg text-center">
          <Phone className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Twilio Accounts</h3>
          <p className="text-muted-foreground mb-4">
            Link your Twilio account to start sending and receiving SMS messages.
          </p>
          <Button onClick={() => setDialogOpen(true)}>Add Twilio Account</Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardHeader>
                <CardTitle>{account.label}</CardTitle>
                <CardDescription>
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {account.phoneNumber}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  <p>Last synced: {new Date(account.lastSync).toLocaleString()}</p>
                  <p className="mt-1">Account SID: {account.accountSid.slice(0, 10)}...</p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSync(account.id)}
                  disabled={isSyncing[account.id]}
                >
                  {isSyncing[account.id] ? (
                    <LoadingSpinner className="mr-2 h-4 w-4" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Sync
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(account.id)}
                  disabled={isDeleting[account.id]}
                >
                  {isDeleting[account.id] ? (
                    <LoadingSpinner className="mr-2 h-4 w-4" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <TwilioAccountDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            fetchAccounts();
          }
        }}
      />
    </div>
  );
}