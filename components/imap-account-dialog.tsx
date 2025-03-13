"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useEmailStore } from "@/lib/email-store";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingSpinner } from "@/components/loading-spinner";

const imapFormSchema = z.object({
    label: z.string().min(1, "Label is required"),
    host: z.string().min(1, "Host is required"),
    port: z.coerce.number().int().positive("Port must be a positive number"),
    username: z.string().email("Must be a valid email"),
    password: z.string().min(1, "Password is required"),
    secure: z.boolean().default(true),
});

type ImapFormValues = z.infer<typeof imapFormSchema>;

interface ImapAccountDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ImapAccountDialog({ open, onOpenChange }: ImapAccountDialogProps) {
    const { toast } = useToast();
    const { addImapAccount } = useEmailStore();
    const [isLoading, setIsLoading] = useState(false);
    const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "failed">("idle");

    const form = useForm<ImapFormValues>({
        resolver: zodResolver(imapFormSchema),
        defaultValues: {
            label: "",
            host: "",
            port: 993,
            username: "",
            password: "",
            secure: true,
        },
    });

    async function onSubmit(data: ImapFormValues) {
        setIsLoading(true);

        try {
            const response = await fetch("/api/imap", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    action: "saveAccount",
                    account: data,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to save IMAP account");
            }

            // Add account to store with the server-generated ID
            addImapAccount({
                id: result.id,
                ...data,
            });

            toast({
                title: "Account added",
                description: `${data.label} has been added successfully`,
            });

            form.reset();
            onOpenChange(false);
        } catch (error) {
            toast({
                title: "Failed to add account",
                description: error instanceof Error ? error.message : "Unknown error occurred",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }

    async function testConnection() {
        const { host, port, username, password, secure } = form.getValues();

        if (!host || !port || !username || !password) {
            toast({
                title: "Missing fields",
                description: "Please fill in all required fields before testing",
                variant: "destructive",
            });
            return;
        }

        setTestStatus("testing");

        try {
            const response = await fetch("/api/imap", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    action: "testConnection",
                    account: {
                        host,
                        port,
                        username,
                        password,
                        secure,
                    },
                }),
            });

            const data = await response.json();

            if (data.success) {
                setTestStatus("success");
                toast({
                    title: "Connection successful",
                    description: "IMAP connection test passed",
                });
            } else {
                setTestStatus("failed");
                toast({
                    title: "Connection failed",
                    description: "Could not connect to IMAP server. Please check your settings.",
                    variant: "destructive",
                });
            }
        } catch (error) {
            setTestStatus("failed");
            toast({
                title: "Connection test failed",
                description: error instanceof Error ? error.message : "Unknown error occurred",
                variant: "destructive",
            });
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add IMAP Account</DialogTitle>
                    <DialogDescription>
                        Connect to any email provider that supports IMAP
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="label"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Account Label</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Personal Gmail" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        A friendly name for this account
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="host"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>IMAP Host</FormLabel>
                                        <FormControl>
                                            <Input placeholder="imap.gmail.com" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="port"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Port</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="secure"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>Use secure connection (SSL/TLS)</FormLabel>
                                        <FormDescription>
                                            Recommended for most email providers
                                        </FormDescription>
                                    </div>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="username"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email/Username</FormLabel>
                                    <FormControl>
                                        <Input type="email" placeholder="you@example.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Password</FormLabel>
                                    <FormDescription>
                                        For Gmail, use an App Password instead of your regular password
                                    </FormDescription>
                                    <FormControl>
                                        <Input type="password" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={testConnection}
                                disabled={testStatus === "testing" || isLoading}
                            >
                                {testStatus === "testing" ? (
                                    <LoadingSpinner className="mr-2 h-4 w-4" />
                                ) : null}
                                {testStatus === "success" ? "✓ " : null}
                                Test Connection
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading && <LoadingSpinner className="mr-2 h-4 w-4" />}
                                Add Account
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}