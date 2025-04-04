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
import { Loader2, CheckCircle, XCircle, CreditCard, AlertTriangle, Copy } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCompletion } from '@ai-sdk/react';
import { recordAiCreditUsage, AI_CREDIT_COSTS, hasEnoughCreditsForFeature } from '@/lib/ai-credits';
import { useToast } from '@/hooks/use-toast';
import { unstable_noStore as noStore } from 'next/cache';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface GenerateMessageDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    conversationContext: string;
    contactName: string;
    platform: string;
    subscriptionId: string | null;
    userId: string | null;
    onMessageGenerated?: (message: string) => void;
}

export function GenerateMessageDialog({
    isOpen,
    onOpenChange,
    conversationContext,
    contactName,
    platform,
    subscriptionId: initialSubscriptionId,
    userId: initialUserId,
    onMessageGenerated
}: GenerateMessageDialogProps) {
    noStore();
    const { toast } = useToast();
    const [hasRecordedUsage, setHasRecordedUsage] = useState(false);
    const [isCreditRecordingFailed, setIsCreditRecordingFailed] = useState(false);
    const [copied, setCopied] = useState(false);
    const [customInstructions, setCustomInstructions] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isCheckingSubscription, setIsCheckingSubscription] = useState(false);
    const [subscriptionId, setSubscriptionId] = useState<string | null>(initialSubscriptionId);
    const [userId, setUserId] = useState<string | null>(initialUserId);
    const [canGenerate, setCanGenerate] = useState(true);

    // Determine if we're generating for SMS or email
    const isSms = platform === 'twilio' || platform === 'justcall';
    const platformLabel = isSms ? 'SMS' : 'Email';

    const {
        completion,
        isLoading,
        error,
        complete,
        stop
    } = useCompletion({
        api: '/api/ai/generate',
        body: {
            conversationContext,
            contactName,
            platform, // Pass the platform to optimize for SMS or email
            customInstructions, // Pass custom instructions to the API
        },
        onFinish: async () => {
            // Record credit usage after the message is successfully generated
            if (subscriptionId && userId && !hasRecordedUsage) {
                try {
                    const success = await recordAiCreditUsage(
                        subscriptionId,
                        'GENERATE_RESPONSE',
                        userId
                    );

                    if (success) {
                        setHasRecordedUsage(true);
                        setIsCreditRecordingFailed(false);
                        toast({
                            title: 'AI Credit Used',
                            description: `Charged ${AI_CREDIT_COSTS.GENERATE_RESPONSE} credit(s) for message generation.`,
                            duration: 3000,
                        });
                    } else {
                        setIsCreditRecordingFailed(true);
                        toast({
                            title: 'Credit Recording Failed',
                            description: 'Could not record AI credit usage. The message was generated but usage tracking failed.',
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
                console.warn('Message generated but no subscription ID or user ID provided for credit recording');
                setIsCreditRecordingFailed(true);
            }
            
            setIsGenerating(false);
        },
        onError: (err) => {
            console.error('Message generation error:', err);

            // Provide user-friendly error message based on error type
            let errorMessage = 'An error occurred while generating the message.';

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
                title: 'Message Generation Failed',
                description: errorMessage,
                variant: 'destructive'
            });
            
            setIsGenerating(false);
        }
    });

    // Check subscription in the background once the dialog is open
    useEffect(() => {
        const checkSubscription = async () => {
            if (!subscriptionId || !userId) {
                setIsCheckingSubscription(true);
                try {
                    // Quick attempt to get subscription data
                    const response = await fetch('/api/subscription');
                    if (!response.ok) throw new Error("Subscription check failed");
                    
                    const data = await response.json();
                    if (data.subscription) {
                        setSubscriptionId(data.subscription.id);
                        setUserId(data.subscription.userId || initialUserId);
                        
                        // Check if we have enough credits
                        const hasCredits = await hasEnoughCreditsForFeature(
                            data.subscription,
                            'GENERATE_RESPONSE'
                        );
                        
                        if (!hasCredits) {
                            setCanGenerate(false);
                            toast({
                                title: "Insufficient AI Credits",
                                description: `You need ${AI_CREDIT_COSTS.GENERATE_RESPONSE} credits to generate a message. Please upgrade or check your usage.`,
                                variant: "destructive",
                            });
                        } else {
                            setCanGenerate(true);
                        }
                    } else {
                        // No subscription found
                        setCanGenerate(false);
                        toast({
                            title: "Subscription Required",
                            description: "You need an active subscription to use AI features.",
                            variant: "destructive",
                        });
                    }
                } catch (error) {
                    console.warn("Subscription check failed:", error);
                    // Let the user try anyway
                    setCanGenerate(true);
                } finally {
                    setIsCheckingSubscription(false);
                }
            }
        };
        
        if (isOpen) {
            checkSubscription();
        }
    }, [isOpen, initialSubscriptionId, initialUserId, toast]);

    // Handler for generating the message with custom instructions
    const handleGenerate = () => {
        if (!canGenerate) {
            toast({
                title: "Cannot Generate Message",
                description: "You don't have enough AI credits for this operation.",
                variant: "destructive",
            });
            return;
        }
        
        setIsGenerating(true);
        complete({
            conversationContext,
            contactName,
            platform,
            customInstructions
        });
    };

    // Reset state when dialog closes
    useEffect(() => {
        if (!isOpen) {
            setHasRecordedUsage(false);
            setIsCreditRecordingFailed(false);
            setCopied(false);
            setCustomInstructions('');
            setIsGenerating(false);
        }
    }, [isOpen]);

    // Handler for applying the generated message
    const handleApplyMessage = () => {
        if (completion && onMessageGenerated) {
            onMessageGenerated(completion);
            onOpenChange(false);
        }
    };

    // Handler for copying to clipboard
    const handleCopy = () => {
        if (completion) {
            navigator.clipboard.writeText(completion)
                .then(() => {
                    setCopied(true);
                    toast({
                        title: "Copied to clipboard",
                        description: "Message copied to clipboard successfully",
                        duration: 2000,
                    });
                    
                    // Reset copied state after 2 seconds
                    setTimeout(() => setCopied(false), 2000);
                })
                .catch(err => {
                    console.error("Failed to copy: ", err);
                    toast({
                        title: "Copy failed",
                        description: "Could not copy to clipboard",
                        variant: "destructive",
                    });
                });
        }
    };

    // Custom handler for open change to prevent closing while loading
    const handleOpenChange = (open: boolean) => {
        // If trying to close (open=false) and still loading, prevent closing
        if (!open && isLoading) {
            toast({
                title: "Generation in Progress",
                description: "Please wait for the message to complete or use the Close button.",
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
                            <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
                            <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
                        </svg>
                        Generate {platformLabel} Message
                    </DialogTitle>
                    <DialogDescription>
                        AI-generated message for {contactName || 'this conversation'}.
                    </DialogDescription>
                </DialogHeader>
                
                {/* Custom Instructions Input */}
                <div className="py-2">
                    <Label htmlFor="custom-instructions">Custom Instructions (Optional)</Label>
                    <Textarea 
                        id="custom-instructions"
                        placeholder={`Add specific instructions for your ${platformLabel} message...`}
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                        className="mt-1.5 max-h-24"
                        disabled={isLoading || isGenerating}
                    />
                </div>
                
                {!completion && !isLoading && !isGenerating && (
                    <div className="flex justify-end py-2">
                        <Button 
                            onClick={handleGenerate}
                            disabled={isCheckingSubscription || !canGenerate}
                            className="gap-2"
                        >
                            {isCheckingSubscription ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Checking...
                                </>
                            ) : (
                                'Generate Message'
                            )}
                        </Button>
                    </div>
                )}
                
                <div className="py-2">
                    <ScrollArea className="h-[200px] w-full rounded-md border p-4 bg-muted/30">
                        {(isLoading || isGenerating) && (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <span className="ml-2 text-muted-foreground">
                                    Generating message...
                                    <span className="block text-xs mt-1 opacity-70">Please don't close this dialog until complete</span>
                                </span>
                            </div>
                        )}
                        {error && (
                            <div className="flex flex-col items-center justify-center h-full text-destructive">
                                <XCircle className="h-8 w-8 mb-2" />
                                <p className="font-medium">Error Generating Message</p>
                                <p className="text-sm text-center px-4">{error.message || 'An unexpected error occurred.'}</p>
                            </div>
                        )}
                        {!isLoading && !isGenerating && !error && completion && (
                            <div className="whitespace-pre-wrap text-sm">
                                {completion}

                                {/* Credit recording failure warning */}
                                {isCreditRecordingFailed && (
                                    <div className="mt-4 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                                        <div className="flex items-start gap-2">
                                            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                                            <div className="text-xs text-yellow-800 dark:text-yellow-400">
                                                Credit usage recording failed. You may not have been charged for this message.
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {!isLoading && !isGenerating && !error && !completion && (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                Generated message will appear here.
                            </div>
                        )}
                    </ScrollArea>
                </div>
                <DialogFooter className="flex items-center justify-between gap-2">
                    {/* Credit info */}
                    {!error && completion && hasRecordedUsage && (
                        <div className="text-xs flex items-center text-muted-foreground">
                            <CreditCard className="h-3 w-3 mr-1" />
                            {AI_CREDIT_COSTS.GENERATE_RESPONSE} credit(s) used
                        </div>
                    )}
                    <div className="flex gap-2 ml-auto">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            // If still loading, show a different label to indicate forced close
                            className={isLoading || isGenerating ? "bg-red-50 hover:bg-red-100 border-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:border-red-800" : ""}
                        >
                            {isLoading || isGenerating ? "Force Close" : "Close"}
                        </Button>
                        {!isLoading && !isGenerating && !error && completion && (
                            <>
                                <Button 
                                    variant="outline" 
                                    onClick={handleCopy}
                                    className="gap-1"
                                >
                                    <Copy className="h-4 w-4 mr-1" />
                                    {copied ? "Copied" : "Copy"}
                                </Button>
                                <Button onClick={handleApplyMessage}>
                                    Apply
                                </Button>
                            </>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 