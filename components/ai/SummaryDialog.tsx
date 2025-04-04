import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCompletion } from '@ai-sdk/react';
import { recordAiCreditUsage, AI_CREDIT_COSTS } from '@/lib/ai-credits';
import { useToast } from '@/hooks/use-toast';

interface SummaryDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    conversationText: string;
    subscriptionId: string | null;
    userId: string | null;
}

export function SummaryDialog({
    isOpen,
    onOpenChange,
    conversationText,
    subscriptionId,
    userId
}: SummaryDialogProps) {
    const { toast } = useToast();
    const [hasRecordedUsage, setHasRecordedUsage] = useState(false);

    const {
        completion,
        isLoading,
        error,
        complete // function to trigger the API call
    } = useCompletion({
        api: '/api/ai/summarize', // Endpoint we created
        body: {
            conversationText: conversationText // Send conversation text in the request body
        },
        onFinish: async () => {
            // Record credit usage *after* the summary is successfully generated
            if (subscriptionId && userId && !hasRecordedUsage) {
                const success = await recordAiCreditUsage(
                    subscriptionId,
                    'SUMMARIZE_THREAD',
                    userId
                );
                if (success) {
                    setHasRecordedUsage(true);
                    toast({
                        title: 'AI Credit Used',
                        description: `Charged ${AI_CREDIT_COSTS.SUMMARIZE_THREAD} credit(s) for summarization.`,
                        duration: 3000,
                    });
                } else {
                    toast({
                        title: 'Credit Recording Failed',
                        description: 'Could not record AI credit usage. Please check your subscription.',
                        variant: 'destructive'
                    });
                }
            }
        },
        onError: (err) => {
            console.error('Summarization error:', err);
            toast({
                title: 'Summarization Failed',
                description: err.message || 'An error occurred while generating the summary.',
                variant: 'destructive'
            });
        }
    });

    // Effect to trigger the completion when the dialog opens and text is available
    useEffect(() => {
        if (isOpen && conversationText && !completion && !isLoading && !error) {
            console.log("Triggering summary generation...");
            complete(conversationText); // Pass conversation text again, though body might suffice
        }
    }, [isOpen, conversationText, completion, isLoading, error, complete]);

    // Reset state when dialog closes
    useEffect(() => {
        if (!isOpen) {
            setHasRecordedUsage(false);
            // Consider resetting completion/error state if useCompletion doesn't handle it
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="w-5 h-5"
                            aria-hidden="true"
                        >
                            <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-1.5 0V5.25A.75.75 0 0 1 9 4.5Zm6.75 0a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-1.5 0V5.25a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                        </svg>
                        Conversation Summary
                    </DialogTitle>
                    <DialogDescription>
                        AI-generated summary of the current conversation.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <ScrollArea className="h-[200px] w-full rounded-md border p-4 bg-muted/30">
                        {isLoading && (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <span className="ml-2 text-muted-foreground">Generating summary...</span>
                            </div>
                        )}
                        {error && (
                            <div className="flex flex-col items-center justify-center h-full text-destructive">
                                <XCircle className="h-8 w-8 mb-2" />
                                <p className="font-medium">Error Generating Summary</p>
                                <p className="text-sm text-center px-4">{error.message || 'An unexpected error occurred.'}</p>
                            </div>
                        )}
                        {!isLoading && !error && completion && (
                            <div className="whitespace-pre-wrap text-sm">
                                {completion}
                            </div>
                        )}
                        {!isLoading && !error && !completion && (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                Summary will appear here.
                            </div>
                        )}
                    </ScrollArea>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 