import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { LoginForm } from "@/components/login-form"

export default async function LoginPage() {
  const session = await getServerSession(authOptions)

  if (session) {
    redirect("/")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <LoginForm />
    </div>
  )
}

