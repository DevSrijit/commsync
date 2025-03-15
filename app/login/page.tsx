import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { LoginForm } from "@/components/login-form"
import Threads from '@/components/Threads/Threads';

export default async function LoginPage() {
  const session = await getServerSession(authOptions)

  if (session) {
    redirect("/")
  }

  return (
    <div>
      <div className="w-full absolute h-full z-0">
        <Threads
          amplitude={2}
          distance={0.9}
          enableMouseInteraction={true}
        />
      </div>
      <div className="flex min-h-screen items-center justify-center bg-background z-20">
        <LoginForm />
      </div>
    </div>
  )
}