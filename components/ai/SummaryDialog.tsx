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
import { Loader2, CheckCircle, XCircle, CreditCard, AlertTriangle } from 'lucide-react';
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
    const [isCreditRecordingFailed, setIsCreditRecordingFailed] = useState(false);

    const {
        completion,
        isLoading,
        error,
        complete, // function to trigger the API call
        stop // function to stop generation
    } = useCompletion({
        api: '/api/ai/summarize', // Endpoint we created
        body: {
            conversationText: conversationText // Send conversation text in the request body
        },
        onFinish: async () => {
            // Record credit usage *after* the summary is successfully generated
            if (subscriptionId && userId && !hasRecordedUsage) {
                try {
                    const success = await recordAiCreditUsage(
                        subscriptionId,
                        'SUMMARIZE_THREAD',
                        userId
                    );

                    if (success) {
                        setHasRecordedUsage(true);
                        setIsCreditRecordingFailed(false);
                        toast({
                            title: 'AI Credit Used',
                            description: `Charged ${AI_CREDIT_COSTS.SUMMARIZE_THREAD} credit(s) for summarization.`,
                            duration: 3000,
                        });
                    } else {
                        setIsCreditRecordingFailed(true);
                        toast({
                            title: 'Credit Recording Failed',
                            description: 'Could not record AI credit usage. The summary was generated but usage tracking failed.',
                            variant: 'destructive'
                        });
                    }
                } catch (err) {
                    console.error('Error recording AI credit usage:', err);
                    setIsCreditRecordingFailed(true);
                    toast({
                        title: 'Credit Recording Error',
                        description: 'An unexpected error occurred while recording credit usage.',
                        variant: 'destructive'
                    });
                }
            } else if (!subscriptionId || !userId) {
                // Handle case where we don't have subscription info
                console.warn('Summary generated but no subscription ID or user ID provided for credit recording');
                setIsCreditRecordingFailed(true);
            }
        },
        onError: (err) => {
            console.error('Summarization error:', err);

            // Provide user-friendly error message based on error type
            let errorMessage = 'An error occurred while generating the summary.';

            if (err.message) {
                if (err.message.includes('API key')) {
                    errorMessage = 'OpenAI API key error. Please check your configuration.';
                } else if (err.message.includes('rate limit')) {
                    errorMessage = 'Rate limit reached. Please try again later.';
                } else if (err.message.includes('configuration')) {
                    errorMessage = 'Missing API configuration. Please check server settings.';
                } else {
                    // Use the actual error message if it's not one of the specific cases
                    errorMessage = err.message;
                }
            }

            toast({
                title: 'Summarization Failed',
                description: errorMessage,
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

        // Cleanup on unmount - stop any active generations
        return () => {
            if (isLoading) {
                stop();
            }
        };
    }, [isOpen, conversationText, completion, isLoading, error, complete, stop]);

    // Reset state when dialog closes
    useEffect(() => {
        if (!isOpen) {
            setHasRecordedUsage(false);
            setIsCreditRecordingFailed(false);
        }
    }, [isOpen]);

    // Custom handler for open change to prevent closing while loading
    const handleOpenChange = (open: boolean) => {
        // If trying to close (open=false) and still loading, prevent closing
        if (!open && isLoading) {
            toast({
                title: "Generation in Progress",
                description: "Please wait for the summary to complete or use the Close button.",
                duration: 3000,
            });
            return; // Don't call onOpenChange, preventing dialog from closing
        }

        // Otherwise, allow the change
        onOpenChange(open);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
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
                                <span className="ml-2 text-muted-foreground">
                                    Generating summary...
                                    <span className="block text-xs mt-1 opacity-70">Please don't close this dialog until complete</span>
                                </span>
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

                                {/* Credit recording failure warning */}
                                {isCreditRecordingFailed && (
                                    <div className="mt-4 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                                        <div className="flex items-start gap-2">
                                            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                                            <div className="text-xs text-yellow-800 dark:text-yellow-400">
                                                Credit usage recording failed. You may not have been charged for this summary.
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {!isLoading && !error && !completion && (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                Summary will appear here.
                            </div>
                        )}
                    </ScrollArea>
                </div>
                <DialogFooter className="flex items-center justify-between gap-2">
                    {/* Credit info */}
                    {!error && completion && hasRecordedUsage && (
                        <div className="text-xs flex items-center text-muted-foreground">
                            <CreditCard className="h-3 w-3 mr-1" />
                            {AI_CREDIT_COSTS.SUMMARIZE_THREAD} credit(s) used
                        </div>
                    )}
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        // If still loading, show a different label to indicate forced close
                        className={isLoading ? "bg-red-50 hover:bg-red-100 border-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:border-red-800" : ""}
                    >
                        {isLoading ? "Force Close" : "Close"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 