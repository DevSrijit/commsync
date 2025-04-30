"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, User, Bot, RefreshCw, Check, Info } from "lucide-react";
import { useRealtimeStore, RealtimeMessage, RealtimePlatform } from "@/lib/realtime-store";
import { Button } from "@/components/ui/button";
import { MessageInput } from "@/components/message-input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, isYesterday } from "date-fns";

// Platform-specific icons
const PlatformIcon = ({ platform }: { platform: RealtimePlatform }) => {
    switch (platform) {
        case "discord":
            return (
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 71 55"
                    fill="currentColor"
                    className="text-indigo-400"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z" />
                </svg>
            );
        default:
            return <Bot className="h-4 w-4 text-primary" />;
    }
};

interface RealtimeConversationViewProps {
    channelId: string | null;
    platform: RealtimePlatform | null;
    isLoading: boolean;
    onBack?: () => void;
}

export function RealtimeConversationView({
    channelId,
    platform,
    isLoading,
    onBack,
}: RealtimeConversationViewProps) {
    const {
        channels,
        messages,
        fetchMessages,
        sendMessage,
        markMessageAsRead,
        isLoading: isStoreLoading,
    } = useRealtimeStore();

    const [isFetching, setIsFetching] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    // Get the selected channel
    const selectedChannel = channelId
        ? channels.find(c => c.id === channelId)
        : null;

    // Get messages for this channel
    const channelMessages = channelId ? messages[channelId] || [] : [];

    // Group messages by date
    const groupedMessages: { date: string; messages: RealtimeMessage[] }[] = [];
    channelMessages.forEach(message => {
        const messageDate = new Date(message.timestamp);
        let dateString: string;

        if (isToday(messageDate)) {
            dateString = "Today";
        } else if (isYesterday(messageDate)) {
            dateString = "Yesterday";
        } else {
            dateString = format(messageDate, "MMMM d, yyyy");
        }

        // Find the group or create a new one
        let group = groupedMessages.find(g => g.date === dateString);
        if (!group) {
            group = { date: dateString, messages: [] };
            groupedMessages.push(group);
        }

        group.messages.push(message);
    });

    // Sort groups by date (newest last) and messages within groups by timestamp (oldest first)
    groupedMessages.sort((a, b) => {
        if (a.date === "Today") return 1;
        if (b.date === "Today") return -1;
        if (a.date === "Yesterday") return 1;
        if (b.date === "Yesterday") return -1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    // Sort messages within each group
    groupedMessages.forEach(group => {
        group.messages.sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
    });

    // Fetch messages when channel changes
    useEffect(() => {
        const loadMessages = async () => {
            if (channelId && platform) {
                setIsFetching(true);
                try {
                    await fetchMessages(channelId);
                } catch (error) {
                    console.error("Error fetching messages:", error);
                    toast({
                        title: "Error",
                        description: "Failed to load messages",
                        variant: "destructive",
                    });
                } finally {
                    setIsFetching(false);
                }
            }
        };

        loadMessages();
    }, [channelId, platform, fetchMessages, toast]);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [channelMessages.length]);

    // Mark messages as read
    useEffect(() => {
        const markMessagesAsRead = async () => {
            if (channelId) {
                // Find unread messages
                const unreadMessages = channelMessages.filter(msg => !msg.isRead);

                // Mark each message as read
                for (const msg of unreadMessages) {
                    await markMessageAsRead(msg.id, channelId);
                }
            }
        };

        markMessagesAsRead();
    }, [channelId, channelMessages, markMessageAsRead]);

    // Handle send message
    const handleSendMessage = async (content: string, attachments: File[]) => {
        if (!channelId || !platform || !content.trim()) {
            return;
        }

        setIsSending(true);
        try {
            const success = await sendMessage(content, attachments);

            if (!success) {
                toast({
                    title: "Error",
                    description: "Failed to send message",
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error("Error sending message:", error);
            toast({
                title: "Error",
                description: "Failed to send message",
                variant: "destructive",
            });
        } finally {
            setIsSending(false);
        }
    };

    // Welcome screen for when no channel is selected
    if (!channelId || !platform || !selectedChannel) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md px-4">
                    <div className="flex items-center justify-center mb-4">
                        <div className="p-3 rounded-full bg-primary/10">
                            <MessageSquare className="h-8 w-8 text-primary" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Realtime Messengers</h2>
                    <p className="text-muted-foreground text-sm mb-6">
                        Connect your Discord and other messaging accounts to view and send messages directly from the dashboard.
                    </p>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3 p-3 rounded-lg border">
                            <div className="flex items-center justify-center h-8 w-8">
                                <PlatformIcon platform="discord" />
                            </div>
                            <div className="text-sm text-left">
                                <p className="font-medium">Discord</p>
                                <p className="text-xs text-muted-foreground">Chat with servers and direct messages</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Loading state
    if (isLoading || isStoreLoading) {
        return (
            <div className="flex flex-col h-full">
                <div className="flex items-center p-4 border-b">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="md:hidden mr-2"
                        onClick={onBack}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Skeleton className="h-6 w-32" />
                </div>

                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex gap-3">
                            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-16 w-full" />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t">
                    <Skeleton className="h-32 w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 p-3 border-b">
                <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    onClick={onBack}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-2">
                    <PlatformIcon platform={platform} />
                    <h3 className="font-semibold">
                        {selectedChannel.name || "Direct Message"}
                    </h3>
                </div>

                <div className="ml-auto flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={async () => {
                            setIsFetching(true);
                            try {
                                await fetchMessages(channelId);
                                toast({
                                    title: "Refreshed",
                                    description: "Messages updated",
                                });
                            } catch (error) {
                                console.error("Error refreshing messages:", error);
                            } finally {
                                setIsFetching(false);
                            }
                        }}
                        disabled={isFetching}
                    >
                        <RefreshCw className={cn(
                            "h-3.5 w-3.5 mr-1",
                            isFetching && "animate-spin"
                        )} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
                {channelMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <Info className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">No messages yet</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {groupedMessages.map((group, groupIndex) => (
                            <div key={groupIndex} className="space-y-3">
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t"></div>
                                    </div>
                                    <div className="relative flex justify-center">
                                        <span className="bg-background px-3 text-xs text-muted-foreground">
                                            {group.date}
                                        </span>
                                    </div>
                                </div>

                                {group.messages.map((message) => (
                                    <div key={message.id} className="flex gap-3 group">
                                        <Avatar className="h-8 w-8 flex-shrink-0">
                                            {message.author.avatar ? (
                                                <AvatarImage src={message.author.avatar} />
                                            ) : (
                                                <AvatarFallback>
                                                    {message.author.username?.charAt(0).toUpperCase() || "U"}
                                                </AvatarFallback>
                                            )}
                                        </Avatar>

                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-sm">
                                                    {message.author.username || "Unknown User"}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {format(new Date(message.timestamp), "h:mm a")}
                                                </span>
                                                {message.isRead && (
                                                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground">
                                                        <Check className="h-3 w-3" />
                                                    </span>
                                                )}
                                            </div>

                                            <div className="text-sm">
                                                {message.content}
                                            </div>

                                            {/* Attachments */}
                                            {message.attachments && message.attachments.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {message.attachments.map((attachment: any, index) => (
                                                        <div
                                                            key={index}
                                                            className="border rounded-md p-2 text-xs flex items-center gap-2 bg-muted/40"
                                                        >
                                                            <Paperclip className="h-3 w-3" />
                                                            <a
                                                                href={attachment.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-primary hover:underline truncate max-w-[150px]"
                                                            >
                                                                {attachment.filename || "Attachment"}
                                                            </a>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Embeds */}
                                            {message.embeds && message.embeds.length > 0 && (
                                                <div className="space-y-2 mt-2">
                                                    {message.embeds.map((embed: any, index) => (
                                                        <div
                                                            key={index}
                                                            className="border-l-4 border-primary/50 rounded-sm pl-3 py-2"
                                                        >
                                                            {embed.title && (
                                                                <p className="font-medium text-sm">{embed.title}</p>
                                                            )}
                                                            {embed.description && (
                                                                <p className="text-xs">{embed.description}</p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}

                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Message Input */}
            <div className="p-3 border-t">
                <MessageInput
                    onSend={handleSendMessage}
                    isLoading={isSending}
                    placeholder={`Message ${selectedChannel.name || "channel"}...`}
                    showSend={true}
                    platform={platform}
                />
            </div>
        </div>
    );
}

// Make sure to import MessageSquare and Paperclip at the top
import { MessageSquare, Paperclip } from "lucide-react"; 