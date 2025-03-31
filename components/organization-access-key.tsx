"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { KeyRound, ArrowRight, Loader2 } from "lucide-react";

export function OrganizationAccessKey() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [accessKey, setAccessKey] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);

        // Check if user is not logged in
        if (status === "unauthenticated") {
            toast({
                title: "Authentication required",
                description: "Please sign in to continue.",
                variant: "destructive",
            });
            router.push("/login");
            return;
        }

        if (!accessKey.trim()) {
            setError("Please enter a valid access key");
            return;
        }

        try {
            setIsSubmitting(true);
            const response = await fetch("/api/organization/join", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ accessKey }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Failed to join organization");
                return;
            }

            // Show success toast
            toast({
                title: "Success!",
                description: data.message || "Successfully joined organization",
            });

            // Redirect to dashboard if a redirect URL is provided
            if (data.redirect) {
                router.push(data.redirect);
            }
        } catch (error) {
            console.error("Error joining organization:", error);
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card className="w-full max-w-md mx-auto overflow-hidden shadow-xl rounded-xl border border-primary/10 backdrop-blur-md transition-all duration-300 hover:shadow-primary/5 hover:border-primary/20">
            <CardHeader className="pb-5 space-y-1 bg-gradient-to-b from-muted/30 to-transparent">
                <div className="flex items-center gap-2">
                    <div className="rounded-full bg-primary/10 p-2 flex-shrink-0">
                        <KeyRound className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-xl font-medium">Have an access key?</CardTitle>
                </div>
                <CardDescription className="text-sm text-muted-foreground pt-1">
                    Join your team's organization by entering your access key
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="accessKey" className="text-sm font-medium">
                            Organization Access Key
                        </Label>
                        <Input
                            id="accessKey"
                            type="text"
                            placeholder="Enter your access key"
                            value={accessKey}
                            onChange={(e) => setAccessKey(e.target.value)}
                            className="h-11 font-mono text-sm bg-background/50 border-border"
                            autoComplete="off"
                            aria-invalid={error ? "true" : "false"}
                        />
                        {error && (
                            <p className="text-xs text-destructive mt-1">{error}</p>
                        )}
                    </div>
                    <Button
                        type="submit"
                        className="w-full h-11 font-medium bg-primary text-primary-foreground transition-all"
                        disabled={isSubmitting || !accessKey.trim() || status === "loading"}
                    >
                        {isSubmitting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <KeyRound className="h-4 w-4 mr-2" />
                        )}
                        {isSubmitting
                            ? "Joining..."
                            : status === "loading"
                                ? "Loading..."
                                : "Join Organization"}
                    </Button>
                </form>
            </CardContent>
            <CardFooter className="border-t bg-muted/20 px-6 py-4 flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                    Ask your admin for an access key.
                </p>
            </CardFooter>
        </Card>
    );
} 