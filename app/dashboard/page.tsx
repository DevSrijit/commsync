"use client";

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
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

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
          router.push("/pricing");
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
        if (response.status === 401 && isInitialLoad) {
          // On initial load, if we get a 401, wait a bit and retry once
          setIsInitialLoad(false);
          setTimeout(checkSubscription, 1000);
          return;
        }
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
        router.push("/pricing");
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error checking subscription:", error);
      if (isInitialLoad) {
        // On initial load, if we get an error, wait a bit and retry once
        setIsInitialLoad(false);
        setTimeout(checkSubscription, 1000);
        return;
      }
      setVerificationError("Failed to verify subscription status. Please try again later.");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkSubscription();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (verificationError) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-500 mb-4">{verificationError}</p>
          <Button onClick={checkSubscription}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return <EmailDashboard />;
} 