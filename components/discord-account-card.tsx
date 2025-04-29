import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Trash2, MoreHorizontal, RefreshCw, CheckCircle2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSubscriptionUpdate } from "@/hooks/use-subscription";

interface DiscordAccountCardProps {
  account: {
    id: string;
    label: string;
    discordUserId: string;
    discordUserTag?: string;
    lastSync: Date;
  };
}

export function DiscordAccountCard({ account }: DiscordAccountCardProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const updateSubscription = useSubscriptionUpdate();

  const handleSync = async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    
    try {
      const response = await fetch(`/api/discord/sync?accountId=${account.id}`, {
        method: "POST",
      });
      
      if (!response.ok) {
        throw new Error("Failed to sync Discord account");
      }
      
      const data = await response.json();
      
      toast({
        title: "Account synced",
        description: `Discord account "${account.label}" has been synced.`,
      });
      
    } catch (error) {
      console.error("Error syncing Discord account:", error);
      
      toast({
        title: "Sync failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    
    setIsDeleting(true);
    
    try {
      const response = await fetch(`/api/discord/account?id=${account.id}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete Discord account");
      }
      
      toast({
        title: "Account deleted",
        description: `Discord account "${account.label}" has been removed.`,
      });
      
      // Notify sidebar that accounts have been updated
      window.dispatchEvent(new CustomEvent("discord-accounts-updated"));
      
      // Update subscription
      await updateSubscription();
      
    } catch (error) {
      console.error("Error deleting Discord account:", error);
      
      toast({
        title: "Deletion failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-4 pb-2 bg-gradient-to-r from-indigo-700 to-indigo-500">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-white text-md font-medium">
              {account.label}
            </CardTitle>
            <CardDescription className="text-indigo-100">
              {account.discordUserTag || account.discordUserId}
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0 text-white hover:bg-indigo-600"
              >
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSync} disabled={isSyncing}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync messages
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove account
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
          <div className="flex items-center">
            <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
            <span>Connected</span>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  Last synced: {formatDistanceToNow(new Date(account.lastSync), { addSuffix: true })}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{new Date(account.lastSync).toLocaleString()}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-2"
          onClick={handleSync}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Now
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
} 