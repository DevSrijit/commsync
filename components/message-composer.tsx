"use client";

import { useState } from "react";
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
import { useSendMessage, MessagePlatform } from "@/lib/messaging";

interface MessageComposerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSend?: (recipients: string, subject: string, content: string, attachments: File[]) => Promise<void>;
}

export function MessageComposer({ open, onOpenChange, onSend }: MessageComposerProps) {
    const { data: session } = useSession();
    const { toast } = useToast();
    const { addEmail } = useEmailStore();

    const [recipients, setRecipients] = useState("");
    const [subject, setSubject] = useState("");
    const [platform, setPlatform] = useState<MessagePlatform>("email");
    const [messageContent, setMessageContent] = useState("");
    const [attachments, setAttachments] = useState<File[]>([]);

    const { sendMessage, status } = useSendMessage();
    const isSubmitting = status.sending;

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
            const result = await sendMessage({
                platform,
                recipients,
                subject,
                content: contentToSend,
                attachments: attachmentsToSend,
            }, {
                accessToken: session?.user?.accessToken,
                onSuccess: (newEmail) => {
                    if (platform === "email") {
                        addEmail(newEmail);
                    }
                }
            });

            // Reset form and close dialog
            setRecipients("");
            setSubject("");
            setMessageContent("");
            setAttachments([]);
            onOpenChange(false);

            return true;
        } catch (error) {
            console.error("Message sending failed:", error);
            return false;
        }
    };

    // Function to render different recipient fields based on platform
    const renderRecipientField = () => {
        switch (platform) {
            case "email":
                return (
                    <>
                        <div className="flex items-center gap-2">
                            <Label htmlFor="recipients" className="w-20 text-sm font-medium">To:</Label>
                            <Input
                                id="recipients"
                                placeholder="recipient@example.com"
                                value={recipients}
                                onChange={(e) => setRecipients(e.target.value)}
                                className="flex-1 border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-sm"
                            />
                        </div>
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
                    </>
                );
            case "whatsapp":
                return (
                    <div className="flex items-center gap-2">
                        <Label htmlFor="recipients" className="w-20 text-sm font-medium">To:</Label>
                        <Input
                            id="recipients"
                            placeholder="Phone number with country code"
                            value={recipients}
                            onChange={(e) => setRecipients(e.target.value)}
                            className="flex-1 border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-sm"
                        />
                    </div>
                );
            default:
                return (
                    <div className="flex items-center gap-2">
                        <Label htmlFor="recipients" className="w-20 text-sm font-medium">To:</Label>
                        <Input
                            id="recipients"
                            placeholder="Recipient"
                            value={recipients}
                            onChange={(e) => setRecipients(e.target.value)}
                            className="flex-1 border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-sm"
                        />
                    </div>
                );
        }
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
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="whatsapp" disabled>WhatsApp (Coming Soon)</SelectItem>
                                <SelectItem value="twilio" disabled>Twilio (Coming Soon)</SelectItem>
                                <SelectItem value="slack" disabled>Slack (Coming Soon)</SelectItem>
                                <SelectItem value="reddit" disabled>Reddit (Coming Soon)</SelectItem>
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

                <div className="flex flex-col flex-1 overflow-hidden">
                    <div className="px-4 py-3 border-b space-y-3">
                        {renderRecipientField()}
                    </div>

                    <div className="flex-1 min-h-0">
                        <MessageInput
                            onSend={handleMessageInputSave}
                            isLoading={isSubmitting}
                            placeholder="Write your message here..."
                            showSend={true}
                            customSend={handleSubmit}
                        />
                    </div>

                    {/* <DialogFooter className="px-4 py-3 border-t">
                        <Button
                            type="submit"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="ml-auto"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4 mr-2" />
                                    Send Message
                                </>
                            )}
                        </Button>
                    </DialogFooter> */}
                </div>
            </DialogContent>
        </Dialog>
    );
}