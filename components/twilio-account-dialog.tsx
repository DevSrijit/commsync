import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { SiTwilio } from "@icons-pack/react-simple-icons";
import { useSubscriptionUpdate, useConnectionLimits } from "@/hooks/use-subscription";
import { LimitReachedOverlay } from "@/components/limit-reached-overlay";

const twilioAccountSchema = z.object({
  label: z.string().min(1, "Label is required"),
  accountSid: z.string().min(1, "Account SID is required"),
  authToken: z.string().min(1, "Auth Token is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
});

type TwilioAccountFormValues = z.infer<typeof twilioAccountSchema>;

interface TwilioAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TwilioAccountDialog({
  open,
  onOpenChange,
}: TwilioAccountDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  const updateSubscription = useSubscriptionUpdate();
  const { limitReached, usedConnections, maxConnections, isLoading: isLoadingLimits } = useConnectionLimits();

  const form = useForm<TwilioAccountFormValues>({
    resolver: zodResolver(twilioAccountSchema),
    defaultValues: {
      label: "",
      accountSid: "",
      authToken: "",
      phoneNumber: "",
    },
  });

  const handleSubmit = async (values: TwilioAccountFormValues) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/twilio/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to link Twilio account");
      }

      await updateSubscription();

      toast({
        title: "Twilio account linked successfully",
        description: "Your Twilio account has been connected.",
      });

      // Reset form and close dialog
      form.reset();
      onOpenChange(false);
      
      // Fetch latest Twilio accounts and update store
      try {
        const accountsResponse = await fetch('/api/twilio/account');
        if (accountsResponse.ok) {
          const accounts = await accountsResponse.json();
          // Dispatch a custom event that sidebar can listen for
          window.dispatchEvent(new CustomEvent('twilio-accounts-updated', { detail: accounts }));
        }
      } catch (error) {
        console.error('Error refreshing Twilio accounts:', error);
      }
      
      router.refresh();
    } catch (error) {
      console.error("Error linking Twilio account:", error);
      toast({
        title: "Error linking account",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <SiTwilio className="h-6 w-6" />
            <DialogTitle>Link Twilio Account</DialogTitle>
          </div>
          <DialogDescription>
            Connect your Twilio account to sync your messages
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
                    <Input placeholder="My Twilio Account" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accountSid"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account SID</FormLabel>
                  <FormControl>
                    <Input placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="authToken"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Auth Token</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Your Twilio Auth Token"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Twilio Phone Number</FormLabel>
                  <FormControl>
                    <Input placeholder="+1234567890" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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