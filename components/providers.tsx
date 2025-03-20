"use client"

import { useEffect } from "react"
import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "@/components/theme-provider"
import { runMigrations } from "@/lib/migrations"

export function Providers({ children }: { children: React.ReactNode }) {
  // Run migrations when the app starts
  useEffect(() => {
    runMigrations()
      .catch(error => console.error("Failed to run migrations:", error));
  }, []);
  
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </SessionProvider>
  )
}