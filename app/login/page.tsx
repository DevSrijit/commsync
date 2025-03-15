"use client";

import { redirect } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { OrbitingCircles } from "@/components/magicui/orbiting-circles";
import { SiWhatsapp, SiTwilio, SiGmail, SiReddit, SiDiscord, SiGooglemessages } from "@icons-pack/react-simple-icons";

export default function LoginPage() {
  const { data: session } = useSession();
  
  useEffect(() => {
    if (session) {
      redirect("/");
    }
  }, [session]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-black">
      <div className="flex flex-col items-center justify-center z-10 text-center">
        {/* Main heading with gradient block */}
        <div className="flex flex-col items-center">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter">
            Make your
          </h1>
          
          {/* Gradient block for "business communication" */}
          <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-yellow-300 py-6 my-4 w-full">
            <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter">
              business communication
            </h2>
          </div>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter">
            easier
          </h1>
        </div>
        
        {/* Sign in button */}
        <Button 
          onClick={() => signIn("google", { callbackUrl: "/" })} 
          variant="outline"
          size="lg" 
          className="mt-8 bg-white text-black hover:bg-gray-100 flex items-center px-4 py-2"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
            <path d="M1 1h22v22H1z" fill="none" />
          </svg>
          Sign in with Google
        </Button>
        
        <p className="mt-4 text-sm text-muted-foreground">
          Your communications are synchronized locally and not on our servers
        </p>
      </div>
      
      {/* Orbiting icons - positioned centered */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-[600px] h-[600px]">
          <OrbitingCircles iconSize={25} radius={250}>
            <SiWhatsapp />
            <SiReddit />
            <SiTwilio />
          </OrbitingCircles>
          <OrbitingCircles iconSize={20} radius={300} reverse speed={2}>
            <SiGmail />
            <SiDiscord />
            <SiGooglemessages />
          </OrbitingCircles>
        </div>
      </div>
    </div>
  );
} 