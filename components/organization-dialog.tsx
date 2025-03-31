"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Clipboard, Copy, MoreHorizontal, Trash, User, UserPlus, UsersRound } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatTierName, formatStorage } from "@/lib/subscription";
import { useToast } from "@/components/ui/use-toast";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface OrganizationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface OrganizationMember {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    isAdmin: boolean;
}

interface OrganizationSubscription {
    status: string;
    plan: string;
    maxUsers: number;
    usedStorage: number;
    totalStorage: number;
    usedConnections: number;
    totalConnections: number;
    usedAiCredits: number;
    totalAiCredits: number;
}

interface Organization {
    id: string;
    name: string;
    accessKey: string;
    members: OrganizationMember[];
    subscription: OrganizationSubscription | null;
    isAdmin: boolean;
}

export function OrganizationDialog({ open, onOpenChange }: OrganizationDialogProps) {
    const { data: session } = useSession();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

    // Use a ref to track if we should update loading state
    const isInitialLoadRef = useRef(true);
    // Use a ref to store the polling interval ID
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    // Track if the dialog was previously open
    const wasOpenRef = useRef(false);

    // Define fetchOrganization as a useCallback to prevent unnecessary re-creation
    const fetchOrganization = useCallback(async (showLoading = true) => {
        if (!session?.user) return null;

        try {
            // Only show loading indicator on initial load or explicit request
            if (showLoading) {
                setIsLoading(true);
            }

            const response = await fetch("/api/organization");

            if (response.ok) {
                const data = await response.json();

                // Only update state if the data has changed
                setOrganization(prevOrg => {
                    // Compare relevant data to see if we need to update
                    if (!prevOrg) return data.organization;

                    const prevSub = prevOrg.subscription;
                    const newSub = data.organization.subscription;

                    // Compare subscription usage data
                    const usageChanged = prevSub && newSub && (
                        prevSub.usedStorage !== newSub.usedStorage ||
                        prevSub.usedConnections !== newSub.usedConnections ||
                        prevSub.usedAiCredits !== newSub.usedAiCredits ||
                        prevOrg.members.length !== data.organization.members.length
                    );

                    // Return new data if anything important changed
                    return usageChanged || !prevSub ? data.organization : prevOrg;
                });

                return data.organization;
            } else {
                if (showLoading) {
                    // Only show error toast on initial load or explicit errors
                    toast({
                        title: "Error",
                        description: "Failed to fetch organization details",
                        variant: "destructive",
                    });
                }
                return null;
            }
        } catch (error) {
            console.error("Error fetching organization:", error);
            return null;
        } finally {
            if (showLoading) {
                setIsLoading(false);
                isInitialLoadRef.current = false;
            }
        }
    }, [session?.user, toast]);

    // Setup polling only once when dialog opens
    useEffect(() => {
        // Only run initial fetch when dialog first opens
        if (open && !wasOpenRef.current) {
            wasOpenRef.current = true;
            isInitialLoadRef.current = true;
            fetchOrganization(true);
        } else if (!open) {
            // Reset when dialog closes
            wasOpenRef.current = false;
        }
    }, [open, fetchOrganization]);

    // Separate effect for polling to avoid re-establishing on every render
    useEffect(() => {
        // Only setup/teardown polling based on open state
        if (open && !pollingIntervalRef.current) {
            // Set up polling for background updates (every 10 seconds)
            pollingIntervalRef.current = setInterval(() => {
                fetchOrganization(false);
            }, 10000);
        } else if (!open && pollingIntervalRef.current) {
            // Clean up polling when dialog closes
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }

        // Cleanup interval when component unmounts
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        };
    }, [open, fetchOrganization]);

    const handleCopyAccessKey = () => {
        if (!organization) return;

        // Copy to clipboard
        navigator.clipboard.writeText(organization.accessKey)
            .then(() => {
                // Show success toast
                toast({
                    title: "Access key copied",
                    description: "Organization access key has been copied to clipboard",
                });
            })
            .catch((error) => {
                console.error("Failed to copy:", error);
                toast({
                    title: "Copy failed",
                    description: "Could not copy access key to clipboard",
                    variant: "destructive",
                });
            });
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!organization || !organization.isAdmin) return;

        try {
            setRemovingMemberId(memberId);
            const response = await fetch("/api/organization/members", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    memberId,
                    organizationId: organization.id,
                }),
            });

            if (response.ok) {
                toast({
                    title: "Member removed",
                    description: "Organization member has been removed successfully",
                });

                // Update the local state
                setOrganization(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        members: prev.members.filter(member => member.id !== memberId),
                    };
                });
            } else {
                const data = await response.json();
                toast({
                    title: "Error",
                    description: data.error || "Failed to remove member",
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error("Error removing member:", error);
            toast({
                title: "Error",
                description: "Failed to remove member",
                variant: "destructive",
            });
        } finally {
            setRemovingMemberId(null);
        }
    };

    const renderSubscriptionDetails = () => {
        if (!organization?.subscription) return null;

        const sub = organization.subscription;
        const storagePercentage = Math.min(100, (sub.usedStorage / sub.totalStorage) * 100);
        const connectionsPercentage = Math.min(100, (sub.usedConnections / sub.totalConnections) * 100);
        const aiCreditsPercentage = Math.min(100, (sub.usedAiCredits / sub.totalAiCredits) * 100);
        const membersPercentage = Math.min(100, (organization.members.length / sub.maxUsers) * 100);

        return (
            <div className="space-y-4 mb-6">
                <div>
                    <h3 className="text-sm font-medium mb-1">Subscription Plan</h3>
                    <div className="flex items-center">
                        <Badge variant="default" className="mr-2">
                            {formatTierName(sub.plan)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                            {sub.status === "active" ? "Active" : sub.status}
                        </span>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Storage</span>
                            <span className="font-medium">
                                {formatStorage(sub.usedStorage)}/{formatStorage(sub.totalStorage)}
                            </span>
                        </div>
                        <Progress
                            value={storagePercentage}
                            className={cn(
                                "h-1.5 rounded-sm",
                                storagePercentage > 90
                                    ? "bg-destructive/20"
                                    : storagePercentage > 70
                                        ? "bg-warning/20"
                                        : "bg-primary/20"
                            )}
                        />
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Connections</span>
                            <span className="font-medium">
                                {sub.usedConnections}/{sub.totalConnections}
                            </span>
                        </div>
                        <Progress
                            value={connectionsPercentage}
                            className={cn(
                                "h-1.5 rounded-sm",
                                connectionsPercentage > 90
                                    ? "bg-destructive/20"
                                    : connectionsPercentage > 70
                                        ? "bg-warning/20"
                                        : "bg-primary/20"
                            )}
                        />
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">AI Credits</span>
                            <span className="font-medium">
                                {sub.usedAiCredits}/{sub.totalAiCredits}
                            </span>
                        </div>
                        <Progress
                            value={aiCreditsPercentage}
                            className={cn(
                                "h-1.5 rounded-sm",
                                aiCreditsPercentage > 90
                                    ? "bg-destructive/20"
                                    : aiCreditsPercentage > 70
                                        ? "bg-warning/20"
                                        : "bg-primary/20"
                            )}
                        />
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Team Members</span>
                            <span className="font-medium">
                                {organization.members.length}/{sub.maxUsers}
                            </span>
                        </div>
                        <Progress
                            value={membersPercentage}
                            className={cn(
                                "h-1.5 rounded-sm",
                                membersPercentage > 90
                                    ? "bg-destructive/20"
                                    : membersPercentage > 70
                                        ? "bg-warning/20"
                                        : "bg-primary/20"
                            )}
                        />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg rounded-xl border-border/40 backdrop-blur-sm">
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold">Organization Details</DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                        View and manage your organization settings
                    </DialogDescription>
                </DialogHeader>

                {isLoading && isInitialLoadRef.current ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : !organization ? (
                    <div className="flex flex-col items-center justify-center h-64">
                        <AlertCircle className="h-10 w-10 text-muted-foreground mb-4" />
                        <p className="text-sm font-medium">No organization found</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            You are not a member of any organization
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-sm font-medium mb-1">Organization</h3>
                                <p className="text-base font-semibold">{organization.name}</p>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-sm font-medium">Access Key</h3>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={handleCopyAccessKey}
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                                <Alert className="bg-muted/50 border border-border/50">
                                    <AlertDescription className="text-xs font-mono overflow-auto p-1">
                                        {organization.accessKey}
                                    </AlertDescription>
                                </Alert>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Share this access key to invite team members to your organization
                                </p>
                            </div>

                            {renderSubscriptionDetails()}

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-medium">Team Members</h3>
                                    <Badge variant="outline">
                                        {organization.members.length}/{organization.subscription?.maxUsers || "∞"}
                                    </Badge>
                                </div>

                                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                    {organization.members.map((member) => (
                                        <div
                                            key={member.id}
                                            className="flex items-center justify-between p-2 rounded-md border border-border/50 bg-card"
                                        >
                                            <div className="flex items-center space-x-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage
                                                        src={member.image || `https://api.dicebear.com/7.x/micah/svg?seed=${member.email}`}
                                                        alt={member.name || "User"}
                                                    />
                                                    <AvatarFallback>{member.name?.[0] || "U"}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm font-medium">{member.name || member.email}</p>
                                                    <p className="text-xs text-muted-foreground">{member.email}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center">
                                                {member.isAdmin && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Badge variant="outline" className="mr-2 bg-primary/10">
                                                                    Admin
                                                                </Badge>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p className="text-xs">Organization Admin</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}

                                                {organization.isAdmin && !member.isAdmin && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7"
                                                            >
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-36">
                                                            <DropdownMenuItem
                                                                className="text-destructive focus:text-destructive cursor-pointer"
                                                                onClick={() => handleRemoveMember(member.id)}
                                                                disabled={!!removingMemberId}
                                                            >
                                                                {removingMemberId === member.id ? (
                                                                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                                                ) : (
                                                                    <Trash className="mr-2 h-4 w-4" />
                                                                )}
                                                                <span>Remove</span>
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="flex justify-between items-center mt-6">
                            <div className="flex items-center text-xs text-muted-foreground">
                                <UsersRound className="h-3.5 w-3.5 mr-1" />
                                <span>Shared organization resources</span>
                            </div>
                            <Button onClick={() => onOpenChange(false)}>Close</Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
} 