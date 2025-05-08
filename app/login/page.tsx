import { LoginForm } from "@/components/login-form"
import Threads from '@/components/Threads/Threads';
import { Suspense } from "react";
import { LoadingSpinner } from "@/components/loading-spinner";

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
        <Suspense fallback={
          <div className="flex justify-center items-center">
            <LoadingSpinner className="h-10 w-10" />
          </div>
        }>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}