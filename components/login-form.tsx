"use client"

import { signIn } from "next-auth/react"
import { Mail } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useState } from "react"
import { LoadingSpinner } from "./loading-spinner"

// Component that uses useSearchParams
function LoginButton() {
  const [isLoading, setIsLoading] = useState(false)
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"

  const handleSignIn = async () => {
    try {
      setIsLoading(true)
      await signIn("google", { callbackUrl })
    } catch (error) {
      console.error("Sign in error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleSignIn}
      className="w-full"
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <LoadingSpinner className="mr-2 h-4 w-4" />
          Connecting...
        </>
      ) : (
        <>
          <Mail className="mr-2 h-4 w-4" />
          Sign in with Google
        </>
      )}
    </Button>
  );
}

export function LoginForm() {
  return (
    <Card className="w-[400px] z-20">
      <CardHeader>
        <CardTitle className="text-2xl text-center">CommSync</CardTitle>
        <CardDescription className="text-center">Connect with your Gmail account to get started</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Suspense fallback={
          <Button variant="outline" className="w-full" disabled>
            <LoadingSpinner className="mr-2 h-4 w-4" />
            Loading...
          </Button>
        }>
          <LoginButton />
        </Suspense>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground text-center">
        Your conversations will be stored locally and not on our servers.
      </CardFooter>
    </Card>
  )
}

