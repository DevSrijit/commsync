"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Zap, RotateCw, ChevronLeft, PanelLeft, Bot, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRealtimeStore, RealtimeChannel, RealtimePlatform } from "@/lib/realtime-store";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";

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

// Channel Item Component
const ChannelItem = ({
    channel,
    isSelected,
    onClick,
}: {
    channel: RealtimeChannel;
    isSelected: boolean;
    onClick: () => void;
}) => {
    // Format recipients for display
    const displayName = channel.name ||
        (channel.recipients && channel.recipients.length > 0
            ? channel.recipients.map((r: any) => r.username || r.name || "User").join(", ")
            : "Unknown Channel");

    return (
        <div
            className={cn(
                "p-3 cursor-pointer hover:bg-accent/50 rounded-lg border",
                isSelected && "bg-accent border-primary/30"
            )}
            onClick={onClick}
        >
            <div className="flex justify-between items-start mb-1">
                <div className="flex items-center">
                    <PlatformIcon platform={channel.platform} />
                    <h3 className="font-medium ml-2 text-sm">{displayName}</h3>
                </div>

                {channel.unreadCount && channel.unreadCount > 0 ? (
                    <Badge variant="default" className="ml-auto">
                        {channel.unreadCount}
                    </Badge>
                ) : null}
            </div>

            <div className="text-xs text-muted-foreground mt-1">
                <div className="flex items-center gap-1">
                    <span className="capitalize">{channel.type.replace('_', ' ')}</span>
                    <span>•</span>
                    <span>{channel.platform}</span>
                </div>
            </div>
        </div>
    );
};

interface RealtimeChannelListProps {
    isLoading: boolean;
    selectedChannelId: string | null;
    onSelectChannel: (channelId: string, platform: RealtimePlatform) => void;
    className?: string;
}

export function RealtimeChannelList({
    isLoading,
    selectedChannelId,
    onSelectChannel,
    className,
}: RealtimeChannelListProps) {
    const { channels, fetchChannels, syncDiscordChannels, isLoading: isStoreLoading } = useRealtimeStore();
    const [searchQuery, setSearchQuery] = useState("");
    const [isSyncing, setIsSyncing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const { data: session } = useSession();
    const { toast } = useToast();
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchPopup, setShowSearchPopup] = useState(false);
    const [searchInput, setSearchInput] = useState("");
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Mobile responsive states
    const [isMobileView, setIsMobileView] = useState(false);

    // Handle window resize
    useEffect(() => {
        const handleResize = () => {
            setIsMobileView(window.innerWidth < 768);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Initial fetch of channels
    useEffect(() => {
        if (channels.length === 0 && !isStoreLoading) {
            fetchChannels();
        }
    }, [channels.length, fetchChannels, isStoreLoading]);

    // Memoize the search input handler
    const handleSearchInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchInput(value);
        if (value.trim()) {
            setShowSearchPopup(true);
        } else {
            setShowSearchPopup(false);
            setSearchQuery("");
        }
    }, []);

    // Add clear search function
    const clearSearch = useCallback(() => {
        setSearchInput("");
        setSearchQuery("");
        setShowSearchPopup(false);
    }, []);

    // Handle search submission
    const handleSearchSubmit = useCallback(() => {
        if (!searchInput.trim()) {
            setShowSearchPopup(false);
            return;
        }

        setSearchQuery(searchInput);
        setIsSearching(true);
        setShowSearchPopup(false);

        // Simple client-side search for now
        // Could be replaced with a more sophisticated search in the future

        setIsSearching(false);
    }, [searchInput]);

    // Handle key press
    const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSearchSubmit();
        } else if (e.key === 'Escape') {
            setShowSearchPopup(false);
            setSearchInput("");
        }
    }, [handleSearchSubmit]);

    // Filter channels based on search query
    const filteredChannels = searchQuery
        ? channels.filter(channel =>
            channel.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            channel.recipients?.some((r: any) =>
                (r.username || r.name || "").toLowerCase().includes(searchQuery.toLowerCase())
            )
        )
        : channels;

    // Sync all channels
    const handleSync = async () => {
        try {
            setIsSyncing(true);
            toast({
                title: "Syncing channels...",
                description: "Fetching your latest messages from all platforms",
            });

            await syncDiscordChannels();
            await fetchChannels();

            toast({
                title: "Sync Complete",
                description: "Your channels are up to date",
            });
        } catch (error) {
            console.error("Error syncing channels:", error);
            toast({
                title: "Sync Failed",
                description: "Could not sync your channels",
                variant: "destructive",
            });
        } finally {
            setIsSyncing(false);
        }
    };

    if (isLoading) {
        return (
            <div className={cn("flex flex-col h-full p-4", className)}>
                <div className="px-2 py-4">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search channels..."
                            className="h-9 pl-8"
                            disabled={true}
                        />
                    </div>
                </div>
                <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-3 w-4/5" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div
            className={cn(
                "flex flex-col h-full overflow-hidden",
                className
            )}
            ref={containerRef}
        >
            {/* Search Header - Made sticky and mobile friendly */}
            <div className="sticky top-0 z-10 px-4 py-3 bg-background/95 backdrop-blur-sm border-b">
                <div className="flex items-center gap-2">
                    {/* Sidebar Trigger Button - Apple Style */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 md:hidden rounded-full flex items-center justify-center"
                        onClick={() => {
                            // Dispatch a custom event to toggle the sidebar
                            const event = new CustomEvent('toggle-sidebar', { bubbles: true });
                            document.dispatchEvent(event);
                        }}
                        aria-label="Menu"
                    >
                        <PanelLeft className="h-4 w-4" />
                    </Button>

                    <div className="relative group flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                        <Input
                            ref={searchInputRef}
                            placeholder="Search channels..."
                            className="h-10 pl-9 pr-9 bg-muted/50 focus:bg-background transition-colors"
                            value={searchInput}
                            onChange={handleSearchInputChange}
                            onKeyDown={handleKeyPress}
                            disabled={isSearching}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                            {searchInput && !isSearching && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 rounded-full hover:bg-accent/80 transition-all duration-200"
                                    onClick={clearSearch}
                                    aria-label="Clear search"
                                >
                                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground transition-colors" />
                                </Button>
                            )}
                            {isSearching && (
                                <RotateCw className="h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                        </div>
                    </div>

                    {/* Sync button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-full flex items-center justify-center"
                        onClick={handleSync}
                        disabled={isSyncing}
                        aria-label="Sync"
                    >
                        <Zap className={cn(
                            "h-4 w-4",
                            isSyncing && "animate-pulse text-primary"
                        )} />
                    </Button>
                </div>

                <AnimatePresence>
                    {showSearchPopup && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="absolute left-0 right-0 mt-2 mx-2 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg overflow-hidden z-20"
                        >
                            <div className="p-4">
                                <div className="flex items-center justify-between text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <Search className="h-4 w-4" />
                                        <span>Press Enter to search</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="flex-1 overflow-y-auto">
                {filteredChannels.length === 0 ? (
                    <div className="text-center p-6 text-muted-foreground">
                        {searchQuery ? (
                            <p>No channels found matching "{searchQuery}"</p>
                        ) : (
                            <p>No channels found.</p>
                        )}
                    </div>
                ) : (
                    <div className="p-3 space-y-2">
                        {filteredChannels.map((channel) => (
                            <ChannelItem
                                key={channel.id}
                                channel={channel}
                                isSelected={selectedChannelId === channel.id}
                                onClick={() => onSelectChannel(channel.id, channel.platform)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
} 