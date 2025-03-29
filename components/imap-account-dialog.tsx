"use client";

import { useState, useEffect } from "react";
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
import { formatDistanceToNow } from "date-fns";
import { useSubscriptionUpdate, useConnectionLimits } from "@/hooks/use-subscription";
import { LimitReachedOverlay } from "@/components/limit-reached-overlay";

const imapFormSchema = z.object({
  label: z.string().min(1, "Label is required"),
  host: z.string().min(1, "Host is required"),
  port: z.coerce.number().int().positive("Port must be a positive number"),
  username: z.string().email("Must be a valid email"),
  password: z.string().min(1, "Password is required"),
  secure: z.boolean().default(true),
  smtpHost: z.string().optional(),
  smtpPort: z.coerce
    .number()
    .int()
    .positive("SMTP port must be a positive number")
    .optional(),
  smtpSecure: z.boolean().default(true),
});

type ImapFormValues = z.infer<typeof imapFormSchema> & {
  lastSync?: Date | null;
};

interface ImapAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImapAccountDialog({
  open,
  onOpenChange,
}: ImapAccountDialogProps) {
  const { toast } = useToast();
  const { addImapAccount } = useEmailStore();
  const [isLoading, setIsLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "failed"
  >("idle");
  const [lastSyncDate, setLastSyncDate] = useState<Date | null>(null);
  
  const updateSubscription = useSubscriptionUpdate();
  const { limitReached, usedConnections, maxConnections, isLoading: isLoadingLimits } = useConnectionLimits();

  const form = useForm<ImapFormValues>({
    resolver: zodResolver(imapFormSchema),
    defaultValues: {
      label: "",
      host: "",
      port: 993,
      username: "",
      password: "",
      secure: true,
      smtpHost: "",
      smtpPort: 587,
      smtpSecure: true,
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
        lastSync: data.lastSync || undefined,
      });

      if (result.lastSync) {
        setLastSyncDate(new Date(result.lastSync));
      }

      // Update subscription usage to reflect new connection
      await updateSubscription();

      toast({
        title: "Account added",
        description: `${data.label} has been added successfully`,
      });

      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Failed to add account",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
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
          description:
            "Could not connect to IMAP server. Please check your settings.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setTestStatus("failed");
      toast({
        title: "Connection test failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="top-0 bg-background z-10 pb-4 border-b">
          <DialogTitle>Add IMAP Account</DialogTitle>
          <DialogDescription>
            Connect to any email provider that supports IMAP
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
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6 py-6"
          >
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel>Account Label</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Personal Gmail"
                        {...field}
                        className="max-w-md"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      A friendly name for this account
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid sm:grid-cols-2 gap-4">
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
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-muted/5 hover:bg-muted/10 transition-colors">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Use secure connection (SSL/TLS)</FormLabel>
                      <FormDescription className="text-xs">
                        Recommended for most email providers
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <div className="border rounded-lg p-4 space-y-4 bg-muted/5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">SMTP Settings</h3>
                  <span className="text-xs text-muted-foreground">
                    (for sending emails)
                  </span>
                </div>
                <FormDescription className="text-xs">
                  Leave blank to use the same settings as IMAP
                </FormDescription>

                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="smtpHost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP Host</FormLabel>
                        <FormControl>
                          <Input placeholder="smtp.gmail.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="smtpPort"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP Port</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="587" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="smtpSecure"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-background hover:bg-muted/5 transition-colors">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Use secure SMTP connection</FormLabel>
                        <FormDescription className="text-xs">
                          Use TLS/SSL for SMTP (port 465). Turn off for STARTTLS
                          (port 587)
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email/Username</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        {...field}
                        className="max-w-md"
                      />
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
                    <FormDescription className="text-xs">
                      For Gmail, use an App Password instead of your regular
                      password
                    </FormDescription>
                    <FormControl>
                      <Input type="password" {...field} className="max-w-md" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="text-sm text-muted-foreground">
              {lastSyncDate ? (
                <p>
                  Last synced:{" "}
                  {formatDistanceToNow(lastSyncDate, { addSuffix: true })}
                </p>
              ) : (
                <p>Last synced: Never</p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 bottom-0 bg-background pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={testConnection}
                disabled={testStatus === "testing" || isLoading}
                className="transition-colors"
              >
                {testStatus === "testing" ? (
                  <LoadingSpinner className="mr-2 h-4 w-4" />
                ) : null}
                {testStatus === "success" ? "✓ " : null}
                Test Connection
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="transition-colors"
              >
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
