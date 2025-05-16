"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { WhatsAppAccountCard } from "./whatsapp-account-card";
import { WhatsAppAccountDialog } from "./whatsapp-account-dialog";
import { LoadingSpinner } from "./loading-spinner";

interface WhatsAppAccountsProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function WhatsAppAccounts({ open, onOpenChange }: WhatsAppAccountsProps) {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isWhatsAppDialogOpen, setIsWhatsAppDialogOpen] = useState(false);

    useEffect(() => {
        if (open) {
            fetchAccounts();
        }
    }, [open]);

    const fetchAccounts = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/whatsapp/account');
            if (response.ok) {
                const data = await response.json();
                setAccounts(data || []);
            }
        } catch (error) {
            console.error('Error fetching WhatsApp accounts:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle the account update event from the WhatsAppAccountDialog
    useEffect(() => {
        const handleAccountsUpdated = (event: CustomEvent) => {
            setAccounts(event.detail);
        };

        window.addEventListener('whatsapp-accounts-updated', handleAccountsUpdated as EventListener);

        return () => {
            window.removeEventListener('whatsapp-accounts-updated', handleAccountsUpdated as EventListener);
        };
    }, []);

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold">WhatsApp Accounts</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 mt-4">
                        <Button
                            variant="outline"
                            className="w-full flex items-center gap-2"
                            onClick={() => setIsWhatsAppDialogOpen(true)}
                        >
                            <Plus className="h-4 w-4" />
                            <span>Add WhatsApp Account</span>
                        </Button>

                        {isLoading ? (
                            <div className="py-8 flex items-center justify-center">
                                <LoadingSpinner size={32} />
                            </div>
                        ) : accounts.length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground">
                                <p>No WhatsApp accounts connected</p>
                                <p className="text-sm mt-1">Add an account to get started</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                                {accounts.map((account) => (
                                    <WhatsAppAccountCard
                                        key={account.id}
                                        id={account.id}
                                        phoneNumber={
                                            account.phoneNumber || account.accountIdentifier || account.id
                                        }
                                        lastSync={account.lastSync}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <WhatsAppAccountDialog
                open={isWhatsAppDialogOpen}
                onOpenChange={(open) => {
                    setIsWhatsAppDialogOpen(open);
                    // Refresh accounts list when dialog closes
                    if (!open) fetchAccounts();
                }}
            />
        </>
    );
} 