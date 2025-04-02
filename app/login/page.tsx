import { LoginForm } from "@/components/login-form"
import Threads from '@/components/Threads/Threads';

export default function LoginPage() {
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