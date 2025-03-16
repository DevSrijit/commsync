import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Trash2, RefreshCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "./loading-spinner";
import { Badge } from "./ui/badge";

interface JustCallAccountCardProps {
  id: string;
  phoneNumber: string;
  label: string;
  lastSync: string;
}

export function JustCallAccountCard({
  id,
  phoneNumber,
  label,
  lastSync,
}: JustCallAccountCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  
  // Automatic sync on component mount
  useEffect(() => {
    // Check if the account hasn't been synced in the last hour
    const lastSyncTime = new Date(lastSync).getTime();
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    if (lastSyncTime < oneHourAgo) {
      handleSync();
    }
  }, [lastSync]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // Use the centralized sync endpoint
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: 'justcall',
          accountId: id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to sync JustCall account");
      }

      toast({
        title: "Sync started",
        description: "Your JustCall messages are being synced in the background.",
      });
      
      // Refresh the page after a short delay to show updated data
      setTimeout(() => {
        router.refresh();
      }, 1000);
      
    } catch (error) {
      console.error("Error syncing JustCall account:", error);
      toast({
        title: "Sync failed",
        description: "Could not sync your JustCall messages.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/justcall/account?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete JustCall account");
      }

      toast({
        title: "Account deleted",
        description: "Your JustCall account has been removed.",
      });
      router.refresh();
    } catch (error) {
      console.error("Error deleting JustCall account:", error);
      toast({
        title: "Error deleting account",
        description: "Could not delete your JustCall account.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteAlert(false);
    }
  };

  // Calculate time since last sync
  const formattedLastSync = new Date(lastSync).toLocaleString();
  const lastSyncDate = new Date(lastSync);
  const now = new Date();
  const timeDiff = now.getTime() - lastSyncDate.getTime();
  const minutesAgo = Math.floor(timeDiff / (1000 * 60));
  const hoursAgo = Math.floor(minutesAgo / 60);
  const daysAgo = Math.floor(hoursAgo / 24);
  
  let syncStatus = '';
  if (daysAgo > 0) {
    syncStatus = `${daysAgo} ${daysAgo === 1 ? 'day' : 'days'} ago`;
  } else if (hoursAgo > 0) {
    syncStatus = `${hoursAgo} ${hoursAgo === 1 ? 'hour' : 'hours'} ago`;
  } else if (minutesAgo > 0) {
    syncStatus = `${minutesAgo} ${minutesAgo === 1 ? 'minute' : 'minutes'} ago`;
  } else {
    syncStatus = 'Just now';
  }

  return (
    <>
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{label}</CardTitle>
            <Badge variant="outline">JustCall</Badge>
          </div>
          <CardDescription className="text-xs truncate">
            {phoneNumber}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-2 text-xs">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-3 w-3" />
            <span>Last synced: {syncStatus}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">{formattedLastSync}</span>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteAlert(true)}
            disabled={isDeleting}
          >
            {isDeleting ? <LoadingSpinner /> : <Trash2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <LoadingSpinner />
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this JustCall account and remove all
              associated data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {isDeleting ? <LoadingSpinner /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 