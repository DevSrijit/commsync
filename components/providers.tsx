"use client"

import { useEffect } from "react"
import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "@/components/theme-provider"
//import { runMigrations } from "@/lib/migrations"
import { GoogleAnalytics } from "@/components/google-analytics";


export function Providers({ children }: { children: React.ReactNode }) {
  // Run migrations when the app starts
  /*useEffect(() => {
    runMigrations()
      .catch(error => console.error("Failed to run migrations:", error));
  }, []);*/

  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <GoogleAnalytics measurementId="G-8Z3952H6H3" />
      </ThemeProvider>
    </SessionProvider>
  )
}