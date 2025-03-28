"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmailDashboard } from "@/components/dashboard";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { 
  getStoredSubscriptionData, 
  hasStoredActiveSubscription, 
  updateSubscriptionDataInBackground 
} from "@/lib/subscription";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Background subscription check
  const checkSubscriptionInBackground = async () => {
    try {
      const updated = await updateSubscriptionDataInBackground();
      
      // If update failed or no active subscription, show warning and redirect
      if (!updated || !hasStoredActiveSubscription()) {
        // Only redirect if we don't have an active subscription
        if (!hasStoredActiveSubscription()) {
          toast({
            title: "Subscription Required",
            description: "Please select a subscription plan to continue.",
            variant: "destructive",
          });
          router.replace("/pricing");
        }
      }
    } catch (error) {
      console.error("Failed to check subscription status:", error);
      // We don't redirect or show error UI in case of background check failure
      // Just log it and let the user continue
    }
  };

  // Regular subscription check with fallback for first load
  const checkSubscription = async () => {
    setVerificationError(null);
    
    try {
      // First check if we have cached data
      if (hasStoredActiveSubscription()) {
        setIsLoading(false);
        // Update in background without blocking UI
        checkSubscriptionInBackground();
        return;
      }
      
      const response = await fetch("/api/auth/check-subscription", {
        method: "GET",
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to verify subscription");
      }
      
      const data = await response.json();
      console.log("Subscription check response:", data);
      
      // Store subscription data for future use
      if (data.subscription) {
        // The updateSubscriptionDataInBackground function will store the data
        await updateSubscriptionDataInBackground();
      }
      
      // If no active subscription, redirect to pricing page
      if (!data.hasActiveSubscription) {
        // Check if there are organizations at all
        if (data.organizations && data.organizations.length > 0) {
          const hasPendingSubscription = data.organizations.some(
            (org: { subscription?: { status: string } }) => 
              org.subscription?.status === 'incomplete' || 
              org.subscription?.status === 'incomplete_expired'
          );
          
          if (hasPendingSubscription) {
            toast({
              title: "Payment Processing",
              description: "Your payment is still being processed. Please wait a moment and refresh the page.",
              duration: 10000,
            });
            setVerificationError("Your payment is still being processed. Please wait a moment and try again.");
            setIsLoading(false);
            return;
          }
        }
        
        toast({
          title: "Subscription Required",
          description: "Please select a subscription plan to continue.",
          variant: "destructive",
        });
        router.replace("/pricing");
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Failed to check subscription status:", error);
      toast({
        title: "Verification Error",
        description: "There was an issue verifying your subscription. Some features may be limited.",
        variant: "destructive",
      });
      setVerificationError("There was an issue verifying your subscription. Please try again or contact support.");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // If the user is not logged in, redirect to login
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    
    // If the user is logged in, check subscription
    if (status === "authenticated" && session) {
      checkSubscription();
    } else if (status !== "loading") {
      setIsLoading(false);
    }
  }, [session, status, router]);

  // Show loading state while checking session
  if (status === "loading" || isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <LoadingSpinner className="h-8 w-8" />
          <p className="text-muted-foreground">
            Loading your dashboard...
          </p>
        </div>
      </div>
    );
  }

  // Show error state if subscription verification failed
  if (verificationError) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md p-6 border rounded-lg shadow-md">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <h2 className="text-xl font-semibold">Subscription Verification Failed</h2>
          <p className="text-center text-muted-foreground">{verificationError}</p>
          <div className="flex gap-4 mt-2">
            <Button 
              onClick={checkSubscription}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry Verification
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/pricing")}
            >
              View Plans
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show dashboard for authenticated users
  if (status === "authenticated") {
    return <EmailDashboard />;
  }

  // This will rarely be visible as the useEffect will redirect
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
} 