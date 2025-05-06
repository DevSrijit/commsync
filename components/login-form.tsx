"use client"

import { signIn } from "next-auth/react"
import { Mail, User } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useState } from "react"
import { LoadingSpinner } from "./loading-spinner"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/components/ui/use-toast"
import { SiGoogle } from "@icons-pack/react-simple-icons"

const loginFormSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
})

type LoginFormValues = z.infer<typeof loginFormSchema>

// OAuth login button component
export function GoogleLoginButton() {
  const [isLoading, setIsLoading] = useState(false)
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true)
      await signIn("google", { callbackUrl })
    } catch (error) {
      console.error("Google sign in error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleGoogleSignIn}
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
          <SiGoogle className="mr-2 h-4 w-4" />
          Sign in with Google
        </>
      )}
    </Button>
  );
}

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false)
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"
  
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const onSubmit = async (data: LoginFormValues) => {
    try {
      setIsLoading(true)
      const response = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (response?.error) {
        toast({
          title: "Login failed",
          description: "Invalid email or password. Please try again.",
          variant: "destructive",
        })
        return
      }

      window.location.href = callbackUrl
    } catch (error) {
      console.error("Sign in error:", error)
      toast({
        title: "Something went wrong",
        description: "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-[400px] z-20">
      <CardHeader>
        <CardTitle className="text-2xl text-center">CommSync</CardTitle>
        <CardDescription className="text-center">Sign in to your account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="name@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <LoadingSpinner className="mr-2 h-4 w-4" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </Form>
        
        <div className="flex items-center space-x-2">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">OR</span>
          <Separator className="flex-1" />
        </div>
        
        <Suspense fallback={
          <Button variant="outline" className="w-full" disabled>
            <LoadingSpinner className="mr-2 h-4 w-4" />
            Loading...
          </Button>
        }>
          <GoogleLoginButton />
        </Suspense>
      </CardContent>
      <CardFooter className="flex flex-col space-y-2">
        <div className="text-xs text-muted-foreground text-center">
          Don't have an account? <Link href="/register" className="underline hover:text-primary">Sign up</Link>
        </div>
      </CardFooter>
    </Card>
  )
}

