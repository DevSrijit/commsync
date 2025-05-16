"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "./loading-spinner";
import { QrCode, RefreshCw, AlertCircle } from "lucide-react";

interface WhatsAppAccountDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function WhatsAppAccountDialog({ open, onOpenChange }: WhatsAppAccountDialogProps) {
    const [qrCodeData, setQrCodeData] = useState<string>("");
    const [timer, setTimer] = useState<number>(60);
    const [connectCode, setConnectCode] = useState<string>("");
    const [accountId, setAccountId] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const fetchQr = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/whatsapp/qr');
            if (!res.ok) {
                throw new Error(`Failed to fetch QR code: ${res.status} ${res.statusText}`);
            }
            const data = await res.json();
            if (data.qrCodeString) {
                setQrCodeData(data.qrCodeString);
                setTimer(60);
            }
            if (data.code) {
                setConnectCode(data.code);
            }
            if (data.accountId) {
                setAccountId(data.accountId);
            }
        } catch (err) {
            console.error('Failed to fetch WhatsApp QR code:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch WhatsApp QR code');
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch new QR on mount and every 60s
    useEffect(() => {
        if (!open) return;
        fetchQr();
        const interval = setInterval(() => {
            if (timer <= 1) {
                fetchQr(); // Fetch new QR when timer reaches 0
            }
        }, 60000);
        return () => clearInterval(interval);
    }, [open]);

    // Countdown timer
    useEffect(() => {
        if (!open) return;
        const countdown = setInterval(() => {
            setTimer((t) => {
                if (t <= 1) {
                    fetchQr(); // Auto-refresh QR when timer reaches 0
                    return 60;
                }
                return t - 1;
            });
        }, 1000);
        return () => clearInterval(countdown);
    }, [open]);

    const handleConnect = async () => {
        if (!connectCode || !accountId) return;
        setIsLoading(true);
        try {
            const res = await fetch('/api/whatsapp/account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: connectCode, accountId }),
            });
            if (!res.ok) throw new Error('Linking failed');
            toast({
                title: 'Account linked successfully',
                description: 'Your WhatsApp account has been connected.',
            });
            onOpenChange(false);

            // Refresh account list
            const listRes = await fetch('/api/whatsapp/account');
            if (listRes.ok) {
                const accounts = await listRes.json();
                window.dispatchEvent(new CustomEvent('whatsapp-accounts-updated', { detail: accounts }));
            }
        } catch (error) {
            console.error('Error linking WhatsApp account:', error);
            toast({
                title: 'Connection failed',
                description: 'Could not link WhatsApp account. Please try again.',
                variant: 'destructive'
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                        <QrCode className="h-5 w-5" />
                        Link WhatsApp Account
                    </DialogTitle>
                    <DialogDescription>
                        Scan this QR code with your WhatsApp mobile app to connect your account
                    </DialogDescription>
                </DialogHeader>

                {error ? (
                    <div className="bg-destructive/10 rounded-lg p-4 text-center">
                        <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
                        <p className="text-destructive font-medium mb-1">Error fetching QR code</p>
                        <p className="text-sm text-muted-foreground">{error}</p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchQr}
                            className="mt-3"
                            disabled={isLoading}
                        >
                            {isLoading ? <LoadingSpinner size={16} className="mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                            Try Again
                        </Button>
                    </div>
                ) : (
                    <div className="bg-background border rounded-xl overflow-hidden">
                        <div className="bg-black pt-6 flex items-center justify-center">
                            {isLoading ? (
                                <div className="h-48 w-48 flex items-center justify-center">
                                    <LoadingSpinner size={36} />
                                </div>
                            ) : (
                                <pre
                                    className="font-mono text-xs leading-none whitespace-pre text-white bg-black rounded"
                                    style={{
                                        fontSize: '0.5rem',
                                        display: 'inline-block',
                                        maxWidth: '100%',
                                        overflow: 'visible',
                                        lineHeight: 1,
                                    }}
                                >
                                    {qrCodeData || 'Loading QR...'}
                                </pre>
                            )}
                        </div>
                        <div className="p-4 flex flex-col items-center">
                            <div className="flex items-center gap-1 mb-1">
                                <div className={`h-2 w-2 rounded-full ${timer < 15 ? 'bg-destructive' : 'bg-green-500'}`}></div>
                                <p className="text-sm font-medium">
                                    QR expires in: <span className={timer < 15 ? 'text-destructive' : ''}>{timer}s</span>
                                </p>
                            </div>
                            <p className="text-xs text-muted-foreground text-center max-w-[280px] mb-2">
                                Open WhatsApp on your phone, tap on Settings and click on Linked Devices to scan this code.
                            </p>
                            <p className="text-xs text-muted-foreground text-center max-w-[280px]">
                                After logging in, click the button below to connect your account.
                            </p>
                        </div>
                    </div>
                )}

                <DialogFooter className="flex items-center gap-2 mx-auto">
                    <Button
                        variant="outline"
                        onClick={fetchQr}
                        disabled={isLoading}
                        size="sm"
                        className="h-9"
                    >
                        {isLoading ? <LoadingSpinner size={16} className="mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                        Refresh QR
                    </Button>
                    <Button
                        onClick={handleConnect}
                        disabled={!connectCode || !accountId || isLoading}
                        size="sm"
                        className="h-9"
                    >
                        {isLoading ? <LoadingSpinner size={16} className="mr-2" /> : null}
                        Connect
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        size="sm"
                        className="h-9"
                    >
                        Cancel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}