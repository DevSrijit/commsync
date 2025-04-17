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
import { useSubscriptionUpdate, useConnectionLimits } from "@/hooks/use-subscription";
import { LimitReachedOverlay } from "@/components/limit-reached-overlay";

const nylasAccountSchema = z.object({
    label: z.string().min(1, "Label is required")
});

type NylasAccountFormValues = z.infer<typeof nylasAccountSchema>;

interface NylasAccountDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function NylasAccountDialog({
    open,
    onOpenChange,
}: NylasAccountDialogProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<NylasAccountFormValues>({
        resolver: zodResolver(nylasAccountSchema),
        defaultValues: {
            label: "Outlook Account"
        }
    });

    const updateSubscription = useSubscriptionUpdate();
    const { limitReached, usedConnections, maxConnections, isLoading: isLoadingLimits } = useConnectionLimits();

    const handleSubmit = async (values: NylasAccountFormValues) => {
        setIsLoading(true);

        try {
            // Redirect to the Nylas OAuth flow
            const response = await fetch(`/api/nylas/auth?label=${encodeURIComponent(values.label)}`);

            if (!response.ok) {
                // If there's an error response, try to parse it
                try {
                    const errorData = await response.json();
                    throw new Error(errorData.error || errorData.details || "Failed to start authentication");
                } catch (jsonError) {
                    throw new Error("Failed to start authentication");
                }
            }

            // If it's a redirect response, get the redirect URL
            const redirectUrl = response.url;

            // Reset form and close dialog
            form.reset();
            onOpenChange(false);

            // Redirect the user to the Nylas OAuth page
            window.location.href = redirectUrl;

        } catch (error) {
            console.error("Error starting Nylas authentication:", error);

            toast({
                title: "Error connecting account",
                description: error instanceof Error ? error.message : "An unknown error occurred",
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
                    <DialogTitle>Connect Microsoft Outlook</DialogTitle>
                    <DialogDescription>
                        Connect your Outlook or Office 365 account to sync your emails
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
                                        <Input placeholder="My Outlook Account" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="text-xs text-muted-foreground pt-2">
                            <p>You'll be redirected to Microsoft to securely sign in to your account.</p>
                            <p className="mt-1">CommsSync uses Nylas to securely connect to Outlook and Office 365.</p>
                            <p className="mt-1">We only request the minimum permissions needed to read and send emails.</p>
                        </div>

                        <DialogFooter className="mt-6">
                            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? <LoadingSpinner className="mr-2 h-4 w-4" /> : null}
                                Connect Account
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
} 