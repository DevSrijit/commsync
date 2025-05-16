"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Trash2, RefreshCw } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "./loading-spinner";
import { Badge } from "./ui/badge";

interface WhatsAppAccountCardProps {
    id: string;
    phoneNumber: string;
    lastSync: string;
}

export function WhatsAppAccountCard({ id, phoneNumber, lastSync }: WhatsAppAccountCardProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);

    useEffect(() => {
        // Auto-sync if older than 1 hour
        const lastSyncTime = new Date(lastSync).getTime();
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        if (!isSyncing && lastSyncTime < oneHourAgo) {
            handleSync();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastSync]);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const response = await fetch("/api/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ platform: "whatsapp", accountId: id }),
            });
            if (!response.ok) throw new Error("Sync failed");
            toast({ title: "Sync started", description: "Syncing WhatsApp messages..." });
            setTimeout(() => router.refresh(), 1000);
        } catch (error) {
            console.error("Error syncing WhatsApp account:", error);
            toast({ title: "Sync failed", description: "Could not sync WhatsApp messages.", variant: "destructive" });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const response = await fetch(`/api/whatsapp/account?id=${id}`, { method: "DELETE" });
            if (!response.ok) throw new Error("Delete failed");
            toast({ title: "Account removed", description: "WhatsApp account unlinked." });
            router.refresh();

            // Update the list of accounts via custom event
            const listRes = await fetch('/api/whatsapp/account');
            if (listRes.ok) {
                const accounts = await listRes.json();
                window.dispatchEvent(new CustomEvent('whatsapp-accounts-updated', { detail: accounts }));
            }
        } catch (error) {
            console.error("Error deleting WhatsApp account:", error);
            toast({ title: "Delete failed", description: "Could not unlink WhatsApp account.", variant: "destructive" });
        } finally {
            setIsDeleting(false);
            setShowDeleteAlert(false);
        }
    };

    // Format last sync status
    const formattedLastSync = new Date(lastSync).toLocaleString();
    const lastSyncDate = new Date(lastSync);
    const diffMs = Date.now() - lastSyncDate.getTime();
    const minutesAgo = Math.floor(diffMs / 60000);
    const hoursAgo = Math.floor(minutesAgo / 60);
    const daysAgo = Math.floor(hoursAgo / 24);

    let syncStatus = "";
    if (daysAgo > 0) syncStatus = `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`;
    else if (hoursAgo > 0) syncStatus = `${hoursAgo} hour${hoursAgo > 1 ? 's' : ''} ago`;
    else if (minutesAgo > 0) syncStatus = `${minutesAgo} minute${minutesAgo > 1 ? 's' : ''} ago`;
    else syncStatus = "Just now";

    return (
        <>
            <Card className="border border-border/60 hover:border-border transition-colors duration-200 max-w-sm mx-auto">
                <CardHeader className="pb-2 pt-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-medium truncate">{phoneNumber}</CardTitle>
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-200/30">
                            WhatsApp
                        </Badge>
                    </div>
                    <CardDescription className="text-xs truncate mt-1">ID: {id}</CardDescription>
                </CardHeader>
                <CardContent className="pb-2 pt-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>Last synced: <span className="font-medium text-foreground">{syncStatus}</span></span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 ml-5.5 hidden sm:block">
                        {formattedLastSync}
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between pt-1 pb-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDeleteAlert(true)}
                        disabled={isDeleting}
                        className="h-8 px-3 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                    >
                        {isDeleting ? (
                            <LoadingSpinner size={16} className="mr-1" />
                        ) : (
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                        )}
                        Unlink
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="h-8 px-3 bg-primary/90 hover:bg-primary"
                    >
                        {isSyncing ? (
                            <LoadingSpinner size={16} className="mr-1" />
                        ) : (
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Sync
                    </Button>
                </CardFooter>
            </Card>

            <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Unlink WhatsApp Account?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove this WhatsApp account connection and all associated data from your account. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="mt-0">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            {isDeleting ? <LoadingSpinner size={16} className="mr-2" /> : null}
                            Unlink Account
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
} 