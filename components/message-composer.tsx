"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { MessageInput } from "@/components/message-input";
import { X } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useEmailStore } from "@/lib/email-store";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useSendMessage } from "@/lib/messaging";
import { Switch } from "@/components/ui/switch";
import { htmlToSmsText } from "@/lib/utils";

// Define updated message platform types
export type MessagePlatform = "gmail" | "imap" | "twilio" | "justcall" | "bulkvs" | "whatsapp";

interface MessageComposerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSend?: (recipients: string, subject: string, content: string, attachments: File[]) => Promise<void>;
}

export function MessageComposer({ open, onOpenChange, onSend }: MessageComposerProps) {
    const { data: session } = useSession();
    const { toast } = useToast();
    const { addEmail, imapAccounts, twilioAccounts, justcallAccounts, bulkvsAccounts } = useEmailStore();

    const [recipients, setRecipients] = useState("");
    const [subject, setSubject] = useState("");
    const [platform, setPlatform] = useState<MessagePlatform>("gmail");
    const [messageContent, setMessageContent] = useState("");
    const [attachments, setAttachments] = useState<File[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>("");
    const [restrictOnce, setRestrictOnce] = useState<boolean>(false);

    const { sendMessage, status } = useSendMessage();
    const isSubmitting = status.sending;

    // Update selected account when platform changes
    useEffect(() => {
        // Reset selected account when platform changes
        setSelectedAccountId("");

        // Auto-select first account if there's only one for the platform
        if (platform === "imap" && imapAccounts.length === 1 && imapAccounts[0].id) {
            setSelectedAccountId(imapAccounts[0].id);
        } else if (platform === "twilio" && twilioAccounts.length === 1 && twilioAccounts[0].id) {
            setSelectedAccountId(twilioAccounts[0].id);
        } else if (platform === "justcall" && justcallAccounts.length === 1 && justcallAccounts[0].id) {
            setSelectedAccountId(justcallAccounts[0].id);
        } else if (platform === "bulkvs" && bulkvsAccounts.length === 1 && bulkvsAccounts[0].id) {
            setSelectedAccountId(bulkvsAccounts[0].id);
        }
    }, [platform, imapAccounts, twilioAccounts, justcallAccounts, bulkvsAccounts]);

    const handleMessageInputSave = (content: string, uploadedAttachments: File[]) => {
        setMessageContent(content);
        setAttachments(uploadedAttachments);
    };

    const handleSubmit = async (currentContent?: string, currentAttachments?: File[]): Promise<boolean> => {
        if (!recipients.trim()) {
            toast({
                title: "Recipient required",
                description: "Please enter at least one recipient",
                variant: "destructive",
            });
            return false;
        }

        // Validate account selection for platforms that need it
        if ((platform === "imap" || platform === "twilio" || platform === "justcall" || platform === "bulkvs") && !selectedAccountId) {
            toast({
                title: "Account required",
                description: `Please select a ${platform.toUpperCase()} account`,
                variant: "destructive",
            });
            return false;
        }

        // Use current content if provided, otherwise fall back to state
        const contentToSend = currentContent || messageContent;
        const attachmentsToSend = currentAttachments || attachments;

        // Check for actual content, not just messageContent state
        if (!contentToSend || contentToSend === '<p></p>') {
            toast({
                title: "Message content required",
                description: "Please enter a message",
                variant: "destructive",
            });
            return false;
        }

        try {
            // Support batch sending - split recipients by comma, semicolon, or space
            const recipientList = recipients.split(/[,;\s]+/).filter(r => r.trim().length > 0);

            if (recipientList.length === 0) {
                toast({
                    title: "Invalid recipients",
                    description: "Please enter valid recipients",
                    variant: "destructive",
                });
                return false;
            }

            // Convert HTML to SMS text for SMS platforms
            const formattedContent = htmlToSmsText(contentToSend);

            // For twilio, justcall, and bulkvs, send individual messages
            if (platform === "twilio" || platform === "justcall" || platform === "bulkvs") {
                // Send messages sequentially
                for (const recipient of recipientList) {
                    // Get account details for specific platforms
                    let justcallNumber = undefined;
                    let bulkvsNumber = undefined;
                    let restrictOnceValue = undefined;

                    if (platform === "justcall") {
                        const account = justcallAccounts.find(a => a.id === selectedAccountId);
                        justcallNumber = account?.accountIdentifier || undefined;

                        // Convert boolean to "Yes"/"No" string for JustCall API
                        restrictOnceValue = restrictOnce ? "Yes" as const : "No" as const;
                    } else if (platform === "bulkvs") {
                        const account = bulkvsAccounts.find(a => a.id === selectedAccountId);
                        bulkvsNumber = account?.accountIdentifier || undefined;

                        // For BulkVS, validate that recipient has a country code
                        const recipientNumber = recipient.trim();
                        if (!recipientNumber.startsWith('+')) {
                            toast({
                                title: "Invalid phone number format",
                                description: "BulkVS requires phone numbers to include the country code (e.g., +1XXXXXXXXXX)",
                                variant: "destructive",
                            });
                            return false;
                        }
                    }

                    await sendMessage({
                        platform,
                        recipients: recipient.trim(),
                        subject,
                        content: formattedContent,
                        attachments: attachmentsToSend,
                        accountId: selectedAccountId,
                        justcallNumber: justcallNumber,
                        bulkvsNumber: bulkvsNumber,
                        restrictOnce: restrictOnceValue
                    }, {
                        accessToken: session?.user?.accessToken,
                        onSuccess: (newMessage) => {
                            if (newMessage) {
                                addEmail(newMessage);
                            }
                        }
                    });
                }
            } else if (platform === "whatsapp") {
                // Send via WhatsApp API
                try {
                    await fetch('/api/whatsapp/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chatId: recipientList[0].trim(), text: formattedContent }),
                    });
                    // Optionally add to store or refresh
                } catch (error) {
                    console.error('Error sending WhatsApp message:', error);
                    return false;
                }
            } else {
                // For email (gmail or imap), send a single message with multiple recipients
                await sendMessage({
                    platform,
                    recipients: recipientList.join(", "),
                    subject,
                    content: contentToSend,
                    attachments: attachmentsToSend,
                    accountId: selectedAccountId
                }, {
                    accessToken: session?.user?.accessToken,
                    onSuccess: (newEmail) => {
                        if (newEmail) {
                            addEmail(newEmail);
                        }
                    }
                });
            }

            // Reset form and close dialog
            setRecipients("");
            setSubject("");
            setMessageContent("");
            setAttachments([]);
            setSelectedAccountId("");
            onOpenChange(false);

            // Trigger a sync of all platforms to fetch the latest messages
            setTimeout(() => {
                useEmailStore.getState().syncAllPlatforms(session?.user?.accessToken || null);
            }, 1000); // Small delay to ensure message delivery is processed

            return true;
        } catch (error) {
            console.error("Message sending failed:", error);
            return false;
        }
    };

    // Render account selector for platforms that need account selection
    const renderAccountSelector = () => {
        if (platform === "gmail") {
            return null; // Gmail uses the user's Google account
        }

        let accounts: { id: string; label: string }[] = [];
        let placeholder = "Select account";

        if (platform === "imap") {
            accounts = imapAccounts
                .filter(account => !!account.id)
                .map(account => ({
                    id: account.id as string,
                    label: account.label || account.username || account.host || "IMAP Account"
                }));
            placeholder = "Select IMAP account";
        } else if (platform === "twilio") {
            accounts = twilioAccounts
                .filter(account => !!account.id)
                .map(account => ({
                    id: account.id as string,
                    label: account.label || account.phoneNumber || "Twilio Account"
                }));
            placeholder = "Select Twilio account";
        } else if (platform === "justcall") {
            accounts = justcallAccounts
                .filter(account => !!account.id)
                .map(account => ({
                    id: account.id as string,
                    label: account.accountIdentifier || "JustCall Account"
                }));
            placeholder = "Select JustCall account";
        } else if (platform === "bulkvs") {
            accounts = bulkvsAccounts
                .filter(account => !!account.id)
                .map(account => ({
                    id: account.id as string,
                    label: account.label || account.accountIdentifier || "BulkVS Account"
                }));
            placeholder = "Select BulkVS account";
        }

        if (accounts.length === 0) {
            return (
                <div className="text-sm text-muted-foreground px-4 py-2">
                    No {platform} accounts available. Please add an account first.
                </div>
            );
        }

        // Add JustCall specific options
        if (platform === "justcall") {
            return (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 px-4 py-2">
                        <Label htmlFor="account" className="w-20 text-sm font-medium">Account:</Label>
                        <Select
                            value={selectedAccountId}
                            onValueChange={setSelectedAccountId}
                        >
                            <SelectTrigger className="flex-1">
                                <SelectValue placeholder={placeholder} />
                            </SelectTrigger>
                            <SelectContent>
                                {accounts.map(account => (
                                    <SelectItem key={account.id} value={account.id}>
                                        {account.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2">
                        <Label htmlFor="restrict-once" className="text-sm font-medium">
                            Prevent duplicate messages (24h)
                        </Label>
                        <Switch
                            id="restrict-once"
                            checked={restrictOnce}
                            onCheckedChange={setRestrictOnce}
                        />
                    </div>
                </div>
            );
        }

        // Regular account selector for other platforms
        return (
            <div className="flex items-center gap-2 px-4 py-2">
                <Label htmlFor="account" className="w-20 text-sm font-medium">Account:</Label>
                <Select
                    value={selectedAccountId}
                    onValueChange={setSelectedAccountId}
                >
                    <SelectTrigger className="flex-1">
                        <SelectValue placeholder={placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                        {accounts.map(account => (
                            <SelectItem key={account.id} value={account.id}>
                                {account.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        );
    };

    // Function to render different recipient fields based on platform
    const renderRecipientField = () => {
        // For email platforms, show subject field
        const showSubjectField = platform === "gmail" || platform === "imap";

        // Get placeholder text based on platform
        let recipientPlaceholder = "Email address(es)";
        if (platform === "twilio" || platform === "justcall") {
            recipientPlaceholder = "Phone number(s) with country code";
        } else if (platform === "bulkvs") {
            recipientPlaceholder = "Phone number with country code (e.g., +1XXXXXXXXXX)";
        }

        return (
            <>
                <div className="flex items-center gap-2">
                    <Label htmlFor="recipients" className="w-20 text-sm font-medium">To:</Label>
                    <Input
                        id="recipients"
                        placeholder={recipientPlaceholder}
                        value={recipients}
                        onChange={(e) => setRecipients(e.target.value)}
                        className="flex-1 border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-sm"
                    />
                </div>
                {showSubjectField && (
                    <div className="flex items-center gap-2">
                        <Label htmlFor="subject" className="w-20 text-sm font-medium">Subject:</Label>
                        <Input
                            id="subject"
                            placeholder="Message subject"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="flex-1 border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-sm"
                        />
                    </div>
                )}
            </>
        );
    };

    return (
        <Dialog open={open} onOpenChange={(newOpen) => {
            if (!isSubmitting) {
                onOpenChange(newOpen);
            }
        }}>
            <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col p-2">
                <DialogHeader className="px-4 py-3 border-b flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <DialogTitle className="text-lg font-medium">New Message</DialogTitle>
                        <Select
                            value={platform}
                            onValueChange={(value) => setPlatform(value as MessagePlatform)}
                        >
                            <SelectTrigger className="w-[150px] h-8 text-xs">
                                <SelectValue placeholder="Platform" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="gmail">Gmail</SelectItem>
                                <SelectItem value="imap">IMAP</SelectItem>
                                <SelectItem value="twilio">Twilio</SelectItem>
                                <SelectItem value="justcall">JustCall</SelectItem>
                                <SelectItem value="bulkvs">BulkVS</SelectItem>
                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogClose asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => !isSubmitting && onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </DialogClose>
                </DialogHeader>

                <div className="flex flex-col flex-1 overflow-hidden space-y-10">
                    <div className="px-4 py-3 border-b space-y-3">
                        {renderAccountSelector()}
                        {renderRecipientField()}
                    </div>

                    <div className="relative flex-1 min-h-0">
                        <MessageInput
                            onSend={handleMessageInputSave}
                            isLoading={isSubmitting}
                            placeholder="Write your message here..."
                            showSend={true}
                            customSend={handleSubmit}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}