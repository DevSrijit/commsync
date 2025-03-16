import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { EmailDashboard } from "@/components/dashboard"
import Landing from "@/components/hero/landing"

export default async function Home() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return <Landing />
  }

  return <EmailDashboard />
}

