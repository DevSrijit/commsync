"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/use-toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode } from "lucide-react";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Skeleton } from "@/components/ui/skeleton";

interface WhatsAppAccountDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function WhatsAppAccountDialog({
    open,
    onOpenChange,
}: WhatsAppAccountDialogProps) {
    const { data: session } = useSession();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [qrCodeData, setQrCodeData] = useState<string | null>(null);
    const [accountId, setAccountId] = useState<string | null>(null);
    const [statusCheckInterval, setStatusCheckInterval] = useState<NodeJS.Timeout | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<"pending" | "connected" | "error">("pending");

    // Clear the interval when the component unmounts or dialog closes
    useEffect(() => {
        return () => {
            if (statusCheckInterval) {
                clearInterval(statusCheckInterval);
            }
        };
    }, [statusCheckInterval]);

    // Reset state when dialog opens and immediately start the connection process
    useEffect(() => {
        if (open) {
            setQrCodeData(null);
            setAccountId(null);
            setConnectionStatus("pending");
            if (statusCheckInterval) {
                clearInterval(statusCheckInterval);
                setStatusCheckInterval(null);
            }

            // Auto-start the connection process when the dialog opens
            handleConnect();
        }
    }, [open]);

    const handleConnect = async () => {
        if (!session?.user?.id) {
            toast({
                title: "Error",
                description: "You must be logged in to connect WhatsApp",
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);
        setQrCodeData(null);

        try {
            console.log("Initiating WhatsApp connection...");
            // Initiate WhatsApp connection
            const response = await fetch("/api/unipile/connect-whatsapp", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            console.log("Response status:", response.status);

            if (!response.ok) {
                throw new Error(`Failed to initiate WhatsApp connection: ${response.status}`);
            }

            // Parse the response carefully to avoid JSON parse errors
            let data;
            try {
                data = await response.json();
                console.log("WhatsApp connect response received");
            } catch (jsonError) {
                console.error("Error parsing response as JSON:", jsonError);
                const text = await response.text();
                console.log("Raw response text:", text.substring(0, 100));
                throw new Error("Invalid JSON response");
            }

            if (!data || !data.qrCodeString) {
                console.error("Missing QR code in response:", data);
                throw new Error("QR code missing from response");
            }

            console.log("Setting QR code data...");

            setQrCodeData(data.qrCodeString);
            setAccountId(data.accountId);

            // Start checking connection status
            const intervalId = setInterval(async () => {
                if (!data.accountId) {
                    console.error("Missing account ID, cannot check status");
                    return;
                }

                try {
                    console.log(`Checking connection status for account: ${data.accountId}`);
                    const statusResponse = await fetch(
                        `/api/unipile/check-status?accountId=${data.accountId}`,
                        {
                            method: "GET",
                        }
                    );

                    if (!statusResponse.ok) {
                        throw new Error("Failed to check connection status");
                    }

                    const statusData = await statusResponse.json();
                    console.log("Connection status:", statusData.status);

                    if (statusData.status === "connected") {
                        clearInterval(intervalId);
                        setStatusCheckInterval(null);
                        setConnectionStatus("connected");

                        // Show success message
                        toast({
                            title: "Success",
                            description: "WhatsApp connected successfully!",
                        });

                        // Close the dialog after a short delay
                        setTimeout(() => {
                            onOpenChange(false);

                            // Trigger an event to update the WhatsApp accounts list
                            const event = new CustomEvent("whatsapp-accounts-updated");
                            window.dispatchEvent(event);
                        }, 2000);
                    }
                } catch (error) {
                    console.error("Error checking connection status:", error);
                }
            }, 5000); // Check every 5 seconds

            setStatusCheckInterval(intervalId);
        } catch (error: any) {
            console.error("Error connecting WhatsApp:", error);
            toast({
                title: "Error",
                description: `Failed to connect WhatsApp: ${error.message}`,
                variant: "destructive",
            });
            setConnectionStatus("error");
        } finally {
            setIsLoading(false);
        }
    };

    const renderQrCode = () => {
        if (connectionStatus === "connected") {
            return (
                <div className="flex flex-col items-center justify-center py-8 w-full">
                    <div className="h-20 w-20 rounded-full bg-green-50 flex items-center justify-center mb-5 shadow-sm">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-10 w-10 text-green-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                    </div>
                    <h3 className="text-xl font-medium mb-2">Connected!</h3>
                    <p className="text-sm text-center text-muted-foreground max-w-xs">
                        Your WhatsApp account has been connected successfully. You can now send and receive messages.
                    </p>

                    <div className="flex items-center gap-2 mt-6 text-sm text-green-600">
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        <span>Account active</span>
                    </div>
                </div>
            );
        }

        if (isLoading && !qrCodeData) {
            return (
                <div className="flex flex-col items-center justify-center py-8 w-full">
                    <div className="bg-gray-100 rounded-lg p-6 flex items-center justify-center mb-6 shadow-sm w-64 h-64">
                        <Skeleton className="w-full h-full" />
                    </div>
                    <p className="text-sm text-center text-muted-foreground animate-pulse">
                        Generating QR code...
                    </p>
                </div>
            );
        }

        if (qrCodeData) {
            return (
                <div className="flex flex-col items-center justify-center w-full">
                        <pre
                            className="font-mono text-xs leading-none whitespace-pre text-white"
                            style={{
                                lineHeight: 1,
                                fontSize: '0.5rem',
                                display: 'inline-block',
                                maxWidth: '100%',
                                overflow: 'visible',
                            }}
                        >
                            {qrCodeData}
                        </pre>
                    <p className="text-sm text-center font-medium mb-3">
                        Scan this QR code with your WhatsApp app:
                    </p>
                    <ol className="text-sm text-muted-foreground list-decimal pl-8 mb-6 space-y-2 w-full max-w-xs">
                        <li>Open WhatsApp on your phone</li>
                        <li>Tap Menu or Settings and select Linked Devices</li>
                        <li>Tap on "Link a Device"</li>
                        <li>Point your phone to this screen to scan the QR code</li>
                    </ol>
                    <div className="flex justify-center items-center gap-2 text-sm text-muted-foreground mt-2">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        Waiting for connection...
                    </div>
                </div>
            );
        }

        // If we have an error or no QR code yet
        return (
            <div className="flex flex-col items-center justify-center py-8 w-full">
                {connectionStatus === "error" ? (
                    <div className="h-16 w-16 rounded-full bg-red-50 flex items-center justify-center mb-5">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-8 w-8 text-red-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </div>
                ) : (
                    <QrCode className="h-16 w-16 text-primary mb-5" />
                )}

                <p className="text-sm text-center mb-6 max-w-xs">
                    {connectionStatus === "error"
                        ? "Failed to generate QR code. Please try again."
                        : "Preparing your WhatsApp connection..."}
                </p>

                {connectionStatus === "error" && (
                    <Button
                        onClick={handleConnect}
                        disabled={isLoading}
                        className="w-full max-w-xs"
                        variant="default"
                    >
                        {isLoading ? <LoadingSpinner /> : "Try Again"}
                    </Button>
                )}
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md p-6">
                <DialogHeader className="pb-2">
                    <DialogTitle className="text-xl">Connect WhatsApp</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Connect your WhatsApp account to send and receive messages in real-time.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center pt-2 pb-4">
                    {renderQrCode()}
                </div>

                <DialogFooter className="sm:justify-center pt-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="min-w-[100px]"
                    >
                        {connectionStatus === "connected" ? "Close" : "Cancel"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 