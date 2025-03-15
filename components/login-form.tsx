"use client"

import { signIn } from "next-auth/react"
import { Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export function LoginForm() {
  return (
    <Card className="w-[400px] z-20">
      <CardHeader>
        <CardTitle className="text-2xl text-center">CommSync</CardTitle>
        <CardDescription className="text-center">Connect with your Gmail account to get started</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Button variant="outline" onClick={() => signIn("google", { callbackUrl: "/" })} className="w-full">
          <Mail className="mr-2 h-4 w-4" />
          Sign in with Google
        </Button>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground text-center">
        Your conversations will be stored locally and not on our servers.
      </CardFooter>
    </Card>
  )
}

