"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
//import { LoadingSpinner } from "@/components/loading-spinner";
import Landing from "@/components/hero/landing";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {    
    // If user is authenticated, send them to the dashboard
    if (status === "authenticated") {
      router.replace("/dashboard");
      return;
    }
  }, [status, router]);

  // Show Landing page if user is not logged in
  return (
    <Landing />
  );
}

