"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadingSpinner } from "@/components/loading-spinner";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // If the user is not logged in, redirect to login
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    
    // If user is authenticated, send them to the dashboard
    if (status === "authenticated") {
      router.replace("/dashboard");
      return;
    }
  }, [status, router]);

  // Show loading state while checking session
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <LoadingSpinner className="h-8 w-8" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

