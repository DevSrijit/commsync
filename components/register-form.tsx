"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useRouter } from "next/navigation"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { LoadingSpinner } from "./loading-spinner"
import { toast } from "@/components/ui/use-toast"
import { Separator } from "@/components/ui/separator"
import { GoogleLoginButton } from "@/components/login-form"
import { Suspense } from "react"

const registerFormSchema = z.object({
    name: z.string().min(2, { message: "Name must be at least 2 characters" }),
    email: z.string().email({ message: "Please enter a valid email address" }),
    password: z.string().min(8, { message: "Password must be at least 8 characters" }),
    confirmPassword: z.string().min(8, { message: "Password must be at least 8 characters" }),
}).refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
})

type RegisterFormValues = z.infer<typeof registerFormSchema>

export function RegisterForm() {
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    const form = useForm<RegisterFormValues>({
        resolver: zodResolver(registerFormSchema),
        defaultValues: {
            name: "",
            email: "",
            password: "",
            confirmPassword: "",
        },
    })

    const onSubmit = async (data: RegisterFormValues) => {
        try {
            setIsLoading(true)

            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: data.name,
                    email: data.email,
                    password: data.password,
                }),
            })

            const result = await response.json()

            if (!response.ok) {
                // Handle specific error cases with appropriate messages
                if (response.status === 409) {
                    toast({
                        title: "Account already exists",
                        description: "Please sign in with your existing account or use a different email.",
                        variant: "destructive",
                    })
                } else if (response.status === 400) {
                    toast({
                        title: "Invalid information",
                        description: result.message || "Please check your information and try again.",
                        variant: "destructive",
                    })
                } else {
                    toast({
                        title: "Registration failed",
                        description: result.message || "Please try again later.",
                        variant: "destructive",
                    })
                }
                return
            }

            // On successful registration
            toast({
                title: "Registration successful!",
                description: "Your account has been created. Please choose a subscription plan.",
            })

            // Sign in the user automatically after registration
            const signInResponse = await fetch('/api/auth/signin/credentials', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: data.email,
                    password: data.password,
                    redirect: false,
                    json: true,
                }),
            })

            // Redirect to pricing page regardless of signin result
            // This ensures users see plans right after signup
            setTimeout(() => {
                router.push('/pricing')
            }, 500)
        } catch (error: any) {
            console.error("Registration error:", error)
            toast({
                title: "Something went wrong",
                description: "We couldn't complete your registration. Please try again.",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Card className="w-full max-w-[400px] z-20 mx-4">
            <CardHeader>
                <CardTitle className="text-2xl text-center">Create an Account</CardTitle>
                <CardDescription className="text-center">Sign up for CommSync</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Your name" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
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
                                    Creating account...
                                </>
                            ) : (
                                "Register"
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
            <CardFooter className="flex justify-center flex-col gap-2">
                <div className="text-sm text-foreground">
                    Already have an account? <Link href="/login" className="underline hover:text-primary">Sign in</Link>
                </div>
                <div className="text-xs text-muted-foreground text-center">
                    By signing up, you agree to our <Link href="/privacy" className="underline hover:text-primary">Privacy Policy</Link> and <Link href="/tos" className="underline hover:text-primary">Terms of Service</Link>.
                </div>
            </CardFooter>
        </Card>
    )
} 