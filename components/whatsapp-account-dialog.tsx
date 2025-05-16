"use client";

import { useState, useEffect, useRef } from "react";
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
    const [connectionStatus, setConnectionStatus] = useState<"pending" | "connected" | "error">("pending");
    const [countdown, setCountdown] = useState(60);
    const countdownInterval = useRef<NodeJS.Timeout | null>(null);
    const statusCheckInterval = useRef<NodeJS.Timeout | null>(null);

    // Clear intervals on unmount or dialog close
    useEffect(() => {
        return () => {
            if (countdownInterval.current) clearInterval(countdownInterval.current);
            if (statusCheckInterval.current) clearInterval(statusCheckInterval.current);
        };
    }, []);

    // Reset state when dialog opens and start QR flow
    useEffect(() => {
        if (open) {
            resetAll();
            handleConnect();
        } else {
            if (countdownInterval.current) clearInterval(countdownInterval.current);
            if (statusCheckInterval.current) clearInterval(statusCheckInterval.current);
        }
        // eslint-disable-next-line
    }, [open]);

    // Countdown timer effect
    useEffect(() => {
        if (!open) return;
        if (countdownInterval.current) clearInterval(countdownInterval.current);
        countdownInterval.current = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    // Time's up, refresh QR
                    handleConnect();
                    return 60;
                }
                return prev - 1;
            });
        }, 1000);
        return () => {
            if (countdownInterval.current) clearInterval(countdownInterval.current);
        };
        // eslint-disable-next-line
    }, [qrCodeData, open]);

    // Polling for connection status
    const startStatusPolling = (id: string) => {
        if (statusCheckInterval.current) clearInterval(statusCheckInterval.current);
        statusCheckInterval.current = setInterval(async () => {
            try {
                const statusResponse = await fetch(`/api/unipile/check-status?accountId=${id}`);
                if (!statusResponse.ok) return;
                const statusData = await statusResponse.json();
                if (statusData.status === "connected") {
                    clearInterval(statusCheckInterval.current!);
                    setConnectionStatus("connected");
                    toast({
                        title: "Success",
                        description: "WhatsApp connected successfully!",
                    });
                    setTimeout(() => {
                        onOpenChange(false);
                        window.dispatchEvent(new CustomEvent("whatsapp-accounts-updated"));
                    }, 2000);
                }
            } catch (error) {
                // ignore
            }
        }, 5000);
    };

    // Reset all state and intervals
    const resetAll = () => {
        setQrCodeData(null);
        setAccountId(null);
        setConnectionStatus("pending");
        setCountdown(60);
        if (countdownInterval.current) clearInterval(countdownInterval.current);
        if (statusCheckInterval.current) clearInterval(statusCheckInterval.current);
    };

    // Connect and get QR code
    const handleConnect = async () => {
        setIsLoading(true);
        setQrCodeData(null);
        setAccountId(null);
        setConnectionStatus("pending");
        setCountdown(60);
        if (statusCheckInterval.current) clearInterval(statusCheckInterval.current);
        try {
            const response = await fetch("/api/unipile/connect-whatsapp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            if (!response.ok) throw new Error("Failed to initiate WhatsApp connection");
            const data = await response.json();
            if (!data || !data.qrCodeString) throw new Error("QR code missing from response");
            setQrCodeData(data.qrCodeString);
            setAccountId(data.accountId);
            setConnectionStatus("pending");
            setCountdown(60);
            startStatusPolling(data.accountId);
        } catch (error: any) {
            setConnectionStatus("error");
            toast({
                title: "Error",
                description: `Failed to connect WhatsApp: ${error.message}`,
                variant: "destructive",
            });
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
                                fontSize: '0.5rem',
                                display: 'inline-block',
                                maxWidth: '100%',
                                overflow: 'visible',
                                lineHeight: 1,
                                margin: 0,
                                padding: 0
                            }}
                        >
                            {qrCodeData}
                        </pre>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-muted-foreground">QR code expires in</span>
                        <span className="font-mono text-base font-bold text-green-500 animate-pulse">{countdown}s</span>
                    </div>
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