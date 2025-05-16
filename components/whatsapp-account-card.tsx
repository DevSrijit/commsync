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

interface WhatsAppAccountCardProps {
    id: string;
    label: string;
    lastSync: string;
}

export function WhatsAppAccountCard({ id, label, lastSync }: WhatsAppAccountCardProps) {
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
            <Card className="mb-4">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base truncate">{label}</CardTitle>
                    </div>
                    <CardDescription className="text-xs truncate">ID: {id}</CardDescription>
                </CardHeader>
                <CardContent className="pb-2 text-xs">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="h-3 w-3" />
                        <span>Last synced: {syncStatus}</span>
                        <span className="hidden sm:inline text-xs text-muted-foreground">{formattedLastSync}</span>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between pt-2">
                    <Button variant="outline" size="sm" onClick={() => setShowDeleteAlert(true)} disabled={isDeleting}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button variant="default" size="sm" onClick={handleSync} disabled={isSyncing}>
                        {isSyncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                        Sync
                    </Button>
                </CardFooter>
            </Card>
            <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Unlink WhatsApp Account?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove this WhatsApp account and all associated data.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Confirm</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
} 