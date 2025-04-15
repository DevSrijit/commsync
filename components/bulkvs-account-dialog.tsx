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

const bulkvsAccountSchema = z.object({
    label: z.string().min(1, "Label is required"),
    apiKey: z.string().min(1, "API Key is required"),
    phoneNumber: z.string().min(1, "Phone number is required"),
    apiUsername: z.string().default("admin@havenmediasolutions.com"),
});

type BulkVSAccountFormValues = z.infer<typeof bulkvsAccountSchema>;

interface BulkVSAccountDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function BulkvsAccountDialog({
    open,
    onOpenChange,
}: BulkVSAccountDialogProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const { data: session, status } = useSession();

    const form = useForm<BulkVSAccountFormValues>({
        resolver: zodResolver(bulkvsAccountSchema),
        defaultValues: {
            label: "",
            apiKey: "",
            phoneNumber: "",
            apiUsername: "",
        },
    });

    const updateSubscription = useSubscriptionUpdate();
    const { limitReached, usedConnections, maxConnections, isLoading: isLoadingLimits } = useConnectionLimits();

    const handleSubmit = async (values: BulkVSAccountFormValues) => {
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
                description: "You must be logged in to link a BulkVS account",
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
            const response = await fetch("/api/bulkvs/link", {
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
                console.error("BulkVS linking error:", errorData);
                throw new Error(
                    errorData.details
                        ? `${errorData.error}: ${errorData.details}`
                        : errorData.error || "Failed to link BulkVS account"
                );
            }

            toast({
                title: "BulkVS account linked successfully",
                description: "Your BulkVS account has been connected.",
            });

            // Reset form and close dialog
            form.reset();
            onOpenChange(false);

            // Fetch latest BulkVS accounts and update store
            try {
                const accountsResponse = await fetch('/api/bulkvs/account');
                if (accountsResponse.ok) {
                    const accounts = await accountsResponse.json();
                    // Dispatch a custom event that sidebar can listen for
                    window.dispatchEvent(new CustomEvent('bulkvs-accounts-updated', { detail: accounts }));
                }
            } catch (error) {
                console.error('Error refreshing BulkVS accounts:', error);
            }

            router.refresh();

            // After the account is saved successfully, update subscription
            await updateSubscription();
        } catch (error) {
            console.error("Error linking BulkVS account:", error);

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
                    errorMessage = "BulkVS API endpoint not found. Please check if your BulkVS account has API access enabled or contact BulkVS support.";
                } else if (errorMessage.includes("Unauthorized") || errorMessage.includes("401")) {
                    errorMessage = "Invalid BulkVS credentials. Please verify both your API Username and API Password/Token match the values in your BulkVS dashboard.";
                } else if (errorMessage.includes("phone number does not exist")) {
                    errorMessage = "The phone number you entered doesn't match any number in your BulkVS account. Please use the exact format provided by BulkVS.";

                    if (availablePhoneNumbers.length > 0) {
                        errorMessage += "\n\nAvailable numbers in your account: " +
                            availablePhoneNumbers.join(", ");
                    }
                } else if (errorMessage.includes("SyntaxError") || errorMessage.includes("Invalid response format")) {
                    errorMessage = "BulkVS API returned an invalid response. This often happens when API access isn't properly enabled for your account. Please contact BulkVS support.";
                } else if (errorMessage.includes("Could not find any phone numbers")) {
                    errorMessage = "No phone numbers were found in your BulkVS account. Please add a phone number to your BulkVS account before connecting.";
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
                    <DialogTitle>Link BulkVS Account</DialogTitle>
                    <DialogDescription>
                        Connect your BulkVS account to sync your messages
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
                                        <Input placeholder="My BulkVS Account" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="apiUsername"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>API Username</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="admin@havenmediasolutions.com"
                                            {...field}
                                        />
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
                                    <FormLabel>API Password/Token</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Your BulkVS API Token" {...field} />
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
                                    <FormLabel>BulkVS Phone Number</FormLabel>
                                    <FormControl>
                                        <Input placeholder="+1234567890" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="text-xs text-muted-foreground pt-2">
                            <p>You can find your API credentials in BulkVS portal under API Information.</p>
                            <p>For Basic Authentication, use these values:</p>
                            <ul className="list-disc pl-4 mt-1">
                                <li><strong>API Username:</strong> Your BulkVS username (default: admin@havenmediasolutions.com)</li>
                                <li><strong>API Password/Token:</strong> The value from "API PASSWORD/TOKEN" in BulkVS dashboard</li>
                                <li><strong>Phone Number:</strong> A valid phone number from your BulkVS account</li>
                            </ul>
                            <p className="mt-1">
                                <strong>Important:</strong> To receive messages, you <u>must</u> configure a webhook in your BulkVS account.
                                BulkVS does not provide an API to fetch past messages, so webhook integration is the only way to receive incoming messages.
                            </p>
                            <p className="mt-1">
                                In your BulkVS dashboard under "Messaging" → "Messaging Webhooks":
                            </p>
                            <ol className="list-decimal pl-4 mt-1">
                                <li>Create a new webhook with your chosen name</li>
                                <li>Set the Message URL to: <strong>https://commsync.gg/api/bulkvs/webhook</strong></li>
                                <li>Click "Add" to save the webhook</li>
                                <li>Click on the new webhook in the list to edit it</li>
                                <li>Set "Delivery Receipt" to "false"</li>
                                <li>Assign this webhook to your phone number(s) under "Inbound" → "DIDs – Manage"</li>
                            </ol>
                            <p className="mt-1">If you're having trouble connecting, please contact BulkVS support to ensure your account has API access enabled.</p>
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