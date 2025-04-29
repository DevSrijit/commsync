import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "./loading-spinner";
import { useSubscriptionUpdate, useConnectionLimits } from "@/hooks/use-subscription";
import { LimitReachedOverlay } from "@/components/limit-reached-overlay";
import { ExternalLink } from "lucide-react";

const discordAccountSchema = z.object({
  label: z.string().min(1, "Label is required"),
});

type DiscordAccountFormValues = z.infer<typeof discordAccountSchema>;

interface DiscordAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DiscordAccountDialog({
  open,
  onOpenChange,
}: DiscordAccountDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { data: session, status } = useSession();

  const form = useForm<DiscordAccountFormValues>({
    resolver: zodResolver(discordAccountSchema),
    defaultValues: {
      label: "",
    },
  });

  const updateSubscription = useSubscriptionUpdate();
  const { limitReached, usedConnections, maxConnections, isLoading: isLoadingLimits } = useConnectionLimits();

  const handleSubmit = async (values: DiscordAccountFormValues) => {
    setIsLoading(true);
    
    // Force refresh the session before submitting
    try {
      await fetch("/api/auth/session", { 
        method: "GET",
        credentials: "include"
      });
    } catch (error) {
      console.error("Failed to refresh session:", error);
    }
    
    // Check if user is authenticated
    if (status !== "authenticated" || !session) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to link a Discord account",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    
    try {
      // Redirect to Discord OAuth flow with the label as state
      // The state parameter will be returned to the callback URL
      const state = encodeURIComponent(JSON.stringify({ label: values.label }));
      const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
      const redirectUri = encodeURIComponent(`${window.location.origin}/api/discord/callback`);
      const scope = encodeURIComponent("identify messages.read direct_messages.read");
      
      const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;
      
      // Redirect to Discord OAuth
      window.location.href = url;
      
    } catch (error) {
      console.error("Error initiating Discord OAuth flow:", error);
      
      toast({
        title: "Error linking account",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Link Discord Account</DialogTitle>
          <DialogDescription>
            Connect your Discord account to sync your direct messages
          </DialogDescription>
        </DialogHeader>

        {limitReached && !isLoadingLimits && (
          <LimitReachedOverlay 
            type="connections" 
            used={usedConnections} 
            limit={maxConnections} 
          />
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Label</FormLabel>
                  <FormControl>
                    <Input placeholder="My Discord Account" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="text-xs text-muted-foreground pt-2">
              <p>
                When you click "Link Account", you'll be redirected to Discord to authorize access.
                CommsSync only requests access to your direct messages and will not access your servers or send messages without your permission.
              </p>

              <p className="mt-2">
                The Discord integration will allow you to:
              </p>
              
              <ul className="list-disc pl-4 mt-1">
                <li>View and synchronize direct messages and group chats</li>
                <li>Respond to messages through CommsSync</li>
                <li>Keep a searchable archive of your conversations</li>
              </ul>
              
              <div className="mt-3 flex items-center">
                <a 
                  href="https://discord.com/safety/privacy-policy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 flex items-center"
                >
                  Discord Privacy Policy
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? <LoadingSpinner /> : "Link Account"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
} 