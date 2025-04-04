import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { Providers } from "@/components/providers"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "CommSync",
  description: "One platform for all your business communications.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="scroll-smooth">
      <body className={`${inter.className} scroll-smooth`} suppressHydrationWarning={true}>
        <Providers>
          <main className="scroll-smooth">
            {children}
          </main>
        </Providers>
        <Toaster />
      </body>
    </html>
  )
}
