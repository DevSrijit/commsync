"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "@/components/ui/use-toast"
import { LoadingSpinner } from "./loading-spinner"

const resetPasswordSchema = z.object({
    password: z.string().min(8, { message: "Password must be at least 8 characters" }),
    confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
})

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

interface ResetPasswordFormProps {
    token?: string
    email?: string
}

export default function ResetPasswordForm({ token, email }: ResetPasswordFormProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [isTokenValid, setIsTokenValid] = useState(false)
    const [isChecking, setIsChecking] = useState(true)
    const [isSuccess, setIsSuccess] = useState(false)
    const router = useRouter()

    const form = useForm<ResetPasswordValues>({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: {
            password: "",
            confirmPassword: "",
        },
    })

    // Validate token when component loads
    useEffect(() => {
        const validateToken = async () => {
            try {
                if (!token || !email) {
                    setIsTokenValid(false)
                    setIsChecking(false)
                    return
                }

                const response = await fetch(`/api/auth/verify-token?token=${token}&email=${email}`)
                const result = await response.json()

                setIsTokenValid(response.ok)
            } catch (error) {
                console.error("Token validation error:", error)
                setIsTokenValid(false)
            } finally {
                setIsChecking(false)
            }
        }

        validateToken()
    }, [token, email])

    const onSubmit = async (data: ResetPasswordValues) => {
        try {
            setIsLoading(true)
            const response = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    token,
                    email,
                    password: data.password,
                }),
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || "Something went wrong")
            }

            setIsSuccess(true)

            // Redirect to login after a delay
            setTimeout(() => {
                router.push("/login")
            }, 3000)
        } catch (error) {
            console.error("Reset password error:", error)
            toast({
                title: "Password reset failed",
                description: "We couldn't reset your password. The link may have expired or is invalid.",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    if (isChecking) {
        return (
            <Card className="w-full max-w-[400px] z-20 mx-4">
                <CardHeader>
                    <CardTitle className="text-2xl text-center">Verifying...</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                    <LoadingSpinner className="h-8 w-8" />
                </CardContent>
            </Card>
        )
    }

    if (!isTokenValid) {
        return (
            <Card className="w-full max-w-[400px] z-20 mx-4">
                <CardHeader>
                    <CardTitle className="text-2xl text-center">Invalid or Expired Link</CardTitle>
                    <CardDescription className="text-center">
                        This password reset link is invalid or has expired.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                    <p className="text-sm text-muted-foreground">
                        Please request a new password reset link.
                    </p>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Link href="/forgot-password">
                        <Button>Request new link</Button>
                    </Link>
                </CardFooter>
            </Card>
        )
    }

    if (isSuccess) {
        return (
            <Card className="w-full max-w-[400px] z-20 mx-4">
                <CardHeader>
                    <CardTitle className="text-2xl text-center">Password Reset Complete</CardTitle>
                    <CardDescription className="text-center">
                        Your password has been successfully reset.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                    <p className="text-sm text-muted-foreground">
                        You'll be redirected to the login page in a moment.
                    </p>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Link href="/login">
                        <Button>Go to login</Button>
                    </Link>
                </CardFooter>
            </Card>
        )
    }

    return (
        <Card className="w-full max-w-[400px] z-20 mx-4">
            <CardHeader>
                <CardTitle className="text-2xl text-center">Reset Your Password</CardTitle>
                <CardDescription className="text-center">
                    Enter a new password for your account
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>New Password</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="••••••••" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="confirmPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Confirm Password</FormLabel>
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
                                    Resetting...
                                </>
                            ) : (
                                "Reset Password"
                            )}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
} 