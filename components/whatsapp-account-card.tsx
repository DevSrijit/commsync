"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
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

interface WhatsAppAccountCardProps {
    id: string;
    phoneNumber: string;
    label?: string;
    lastSync?: string | Date;
}

export function WhatsAppAccountCard({
    id,
    phoneNumber,
    label = "WhatsApp",
    lastSync,
}: WhatsAppAccountCardProps) {
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const response = await fetch(`/api/unipile/account?id=${id}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                throw new Error("Failed to delete account");
            }

            toast({
                title: "Account deleted",
                description: "WhatsApp account has been disconnected",
            });

            // Dispatch an event to update the accounts list
            const event = new CustomEvent("whatsapp-accounts-updated");
            window.dispatchEvent(event);
        } catch (error) {
            console.error("Error deleting account:", error);
            toast({
                title: "Error",
                description: "Failed to delete account",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const formatPhoneNumber = (phone: string) => {
        // Format the phone number if it's a valid number
        if (!phone) return "Unknown";

        // If it's already a formatted phone number, return as is
        if (phone.includes("+") || phone.includes(" ") || phone.includes("-")) {
            return phone;
        }

        // Simple formatting for numeric strings
        if (/^\d+$/.test(phone)) {
            return phone.replace(/(\d{3})(\d{3})(\d{4})/, "+$1 $2 $3");
        }

        return phone;
    };

    return (
        <>
            <div className="bg-card rounded-lg border p-4">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5 text-green-500"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                            >
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            <h3 className="font-medium">{label}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            {formatPhoneNumber(phoneNumber)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Last sync:{" "}
                            {lastSync
                                ? formatDistanceToNow(new Date(lastSync), { addSuffix: true })
                                : "Never"}
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={isDeleting}
                    >
                        {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Trash className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </div>

            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect WhatsApp Account</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to disconnect this WhatsApp account? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Disconnecting...
                                </>
                            ) : (
                                "Disconnect"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
} 