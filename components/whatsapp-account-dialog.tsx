"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface WhatsAppAccountDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function WhatsAppAccountDialog({ open, onOpenChange }: WhatsAppAccountDialogProps) {
    const [qrCodeData, setQrCodeData] = useState<string>("");
    const [timer, setTimer] = useState<number>(60);
    const [connectCode, setConnectCode] = useState<string>("");
    const { toast } = useToast();

    const fetchQr = async () => {
        try {
            const res = await fetch('/api/whatsapp/qr');
            const data = await res.json();
            if (data.qrCodeString) {
                setQrCodeData(data.qrCodeString);
                setTimer(60);
            }
            if (data.code) {
                setConnectCode(data.code);
            }
        } catch (err) {
            console.error('Failed to fetch WhatsApp QR code:', err);
        }
    };

    // Fetch new QR on mount and every 60s
    useEffect(() => {
        if (!open) return;
        fetchQr();
        const interval = setInterval(fetchQr, 60000);
        return () => clearInterval(interval);
    }, [open]);

    // Countdown timer
    useEffect(() => {
        if (!open) return;
        const countdown = setInterval(() => {
            setTimer((t) => (t > 0 ? t - 1 : 0));
        }, 1000);
        return () => clearInterval(countdown);
    }, [open]);

    const handleConnect = async () => {
        if (!connectCode) return;
        try {
            const res = await fetch('/api/whatsapp/account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: connectCode }),
            });
            if (!res.ok) throw new Error('Linking failed');
            toast({ title: 'Account linked', description: 'WhatsApp account linked successfully.' });
            onOpenChange(false);
            // Refresh account list
            const listRes = await fetch('/api/whatsapp/account');
            if (listRes.ok) {
                const accounts = await listRes.json();
                window.dispatchEvent(new CustomEvent('whatsapp-accounts-updated', { detail: accounts }));
            }
        } catch (error) {
            console.error('Error linking WhatsApp account:', error);
            toast({ title: 'Link failed', description: 'Could not link WhatsApp account.', variant: 'destructive' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Link WhatsApp Account</DialogTitle>
                </DialogHeader>

                <div className="p-4 bg-black rounded text-center">
                    <pre
                        className="font-mono text-xs leading-none whitespace-pre text-white"
                        style={{
                            fontSize: '0.5rem',
                            display: 'inline-block',
                            maxWidth: '100%',
                            overflow: 'visible',
                            lineHeight: 1,
                            margin: 0,
                            padding: 0,
                        }}
                    >
                        {qrCodeData || 'Loading QR...'}
                    </pre>
                    <p className="mt-2 text-sm">Expires in: {timer}s</p>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleConnect} disabled={!connectCode}>
                        Connect
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 