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

const justCallAccountSchema = z.object({
  label: z.string().min(1, "Label is required"),
  apiKey: z.string().min(1, "API Key is required"),
  apiSecret: z.string().min(1, "API Secret is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
});

type JustCallAccountFormValues = z.infer<typeof justCallAccountSchema>;

interface JustCallAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JustCallAccountDialog({
  open,
  onOpenChange,
}: JustCallAccountDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { data: session, status } = useSession();

  const form = useForm<JustCallAccountFormValues>({
    resolver: zodResolver(justCallAccountSchema),
    defaultValues: {
      label: "",
      apiKey: "",
      apiSecret: "",
      phoneNumber: "",
    },
  });

  const updateSubscription = useSubscriptionUpdate();
  const { limitReached, usedConnections, maxConnections, isLoading: isLoadingLimits } = useConnectionLimits();

  const handleSubmit = async (values: JustCallAccountFormValues) => {
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
        description: "You must be logged in to link a JustCall account",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    
    console.log("Session status:", status);
    console.log("Session data:", {
      userId: session?.user?.id || "No user ID",
      email: session?.user?.email || "No email",
      isAuthenticated: status === "authenticated"
    });
    
    try {
      const response = await fetch("/api/justcall/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
        // Add credentials to ensure cookies are sent with the request
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error occurred" }));
        console.error("JustCall linking error:", errorData);
        throw new Error(
          errorData.details 
            ? `${errorData.error}: ${errorData.details}` 
            : errorData.error || "Failed to link JustCall account"
        );
      }

      toast({
        title: "JustCall account linked successfully",
        description: "Your JustCall account has been connected.",
      });

      // Reset form and close dialog
      form.reset();
      onOpenChange(false);
      
      // Fetch latest JustCall accounts and update store
      try {
        const accountsResponse = await fetch('/api/justcall/account');
        if (accountsResponse.ok) {
          const accounts = await accountsResponse.json();
          // Dispatch a custom event that sidebar can listen for
          window.dispatchEvent(new CustomEvent('justcall-accounts-updated', { detail: accounts }));
        }
      } catch (error) {
        console.error('Error refreshing JustCall accounts:', error);
      }

      router.refresh();

      // After the account is saved successfully, update subscription
      await updateSubscription();
    } catch (error) {
      console.error("Error linking JustCall account:", error);
      
      let errorMessage = "Unknown error occurred";
      let availablePhoneNumbers: string[] = [];
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        try {
          // Try to parse the error message for available numbers
          if (errorMessage.includes("phone number does not exist")) {
            const errorObj = JSON.parse(errorMessage.substring(errorMessage.indexOf('{')));
            if (errorObj.availableNumbers && Array.isArray(errorObj.availableNumbers)) {
              availablePhoneNumbers = errorObj.availableNumbers;
            }
          }
        } catch (parseError) {
          // Ignore parsing errors
        }
        
        // Add helpful troubleshooting guidance for specific errors
        if (errorMessage.includes("endpoint not found") || errorMessage.includes("404")) {
          errorMessage = "JustCall API endpoint not found. Please check if your JustCall account has API access enabled or contact JustCall support.";
        } else if (errorMessage.includes("Unauthorized") || errorMessage.includes("401")) {
          errorMessage = "Invalid JustCall credentials. Please verify your API key and secret.";
        } else if (errorMessage.includes("phone number does not exist")) {
          errorMessage = "The phone number you entered doesn't match any number in your JustCall account. Please use the exact format provided by JustCall.";
          
          if (availablePhoneNumbers.length > 0) {
            errorMessage += "\n\nAvailable numbers in your account: " + 
              availablePhoneNumbers.join(", ");
          }
        }
      }
      
      toast({
        title: "Error linking account",
        description: errorMessage,
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
          <DialogTitle>Link JustCall Account</DialogTitle>
          <DialogDescription>
            Connect your JustCall account to sync your messages
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
                    <Input placeholder="My JustCall Account" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
                  <FormControl>
                    <Input placeholder="Your JustCall API Key" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="apiSecret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Secret</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Your JustCall API Secret"
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
                  <FormLabel>JustCall Phone Number</FormLabel>
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