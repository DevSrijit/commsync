"use client"
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import WaitlistDialog from '@/components/waitlist-dialog'
import axios from 'axios'
import { useState, useEffect } from 'react'

export default function Home() {
  const [waitlistCount, setWaitlistCount] = useState(0)

  useEffect(() => {
    async function fetchWaitlistCount() {
      try {
        const res = await axios.get("/api/waitlist-count")
        setWaitlistCount(res.data.count)
      } catch (error) {
        console.error("Failed to fetch waitlist count:", error)
      }
    }

    fetchWaitlistCount()
  }, [])

  return (
    <main className="min-h-screen text-[#111] bg-white font-sans antialiased selection:bg-gray-100 selection:text-black">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-lg z-50 border-b border-[#eaeaea]">
        <div className="container max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <span className="font-semibold tracking-tight">CommSync</span>
          </div>
          <WaitlistDialog>
            <Button className="rounded-md bg-black text-white hover:bg-gray-800 transition-colors border border-transparent px-4 py-2 text-sm font-medium">
              Join Waitlist
            </Button>
          </WaitlistDialog>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-40 pb-12 md:pb-24 relative">
        <div className="container max-w-5xl mx-auto px-6">
          {/* Text content centered */}
          <div className="text-center mx-auto max-w-3xl mb-16">
            <div className="inline-flex items-center h-6 rounded-full bg-gray-100 px-3 mb-8">
              <span className="text-xs font-medium text-gray-700">Public Beta Access</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-medium tracking-tight leading-[1.1] mb-6">
              All your messages.<br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-gray-700 to-black">One unified inbox.</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-8">
              Stop switching between apps. CommSync brings your emails, SMS, and social messages into one seamless experience.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
              <WaitlistDialog>
                <Button className="w-full sm:w-auto h-12 px-8 rounded-md bg-black text-white hover:bg-gray-800 transition-all border border-transparent font-medium">
                  Get Early Access
                </Button>
              </WaitlistDialog>
            </div>

            <div className="border-t border-gray-100 pt-6 flex justify-center flex-col items-center">
              <p className="text-sm text-gray-500 mb-3 mr-4">Already trusted by teams at:</p>
              <div className="flex flex-wrap gap-6 items-center">
                <div className="text-gray-500 font-medium">Vercel</div>
                <div className="text-gray-500 font-medium">Stripe</div>
                <div className="text-gray-500 font-medium">Notion</div>
                <div className="text-gray-500 font-medium">Linear</div>
              </div>
            </div>
          </div>

          {/* Dashboard image with glow effect */}
          <div className="relative mx-auto max-w-5xl">
            <div className="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-yellow-600 to-pink-600 opacity-20 blur-2xl"></div>
            <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 opacity-20 blur-3xl"></div>
            <div className="relative w-full overflow-hidden border border-[#eaeaea] shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-lg">
              <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-gray-700 to-black"></div>
              <div className="w-full">
                <Image
                  src="/dashboard-light.png"
                  alt="CommSync Dashboard"
                  width={1200}
                  height={800}
                  priority
                  quality={100}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Features Section */}
      <section className="py-24 border-t border-[#eaeaea]">
        <div className="container max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-medium mb-4">Everything you need in one place</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              CommSync brings all your business communications together, helping you stay organized and efficient.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 grid-rows-5 md:grid-rows-3 gap-4 h-auto md:h-[700px]">
            {/* Main Feature */}
            <div className="col-span-1 md:col-span-2 row-span-2 p-8 bg-white rounded-lg border border-[#eaeaea] shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.1)] transition-all overflow-hidden relative group">
              <div className="flex gap-4 h-full">
                <div className="space-y-4 max-w-xs">
                  <div className="h-12 w-12 rounded-md bg-black/5 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-black">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="3" y1="9" x2="21" y2="9"></line>
                      <line x1="9" y1="21" x2="9" y2="9"></line>
                    </svg>
                  </div>
                  <h3 className="text-xl font-medium">Unified Inbox</h3>
                  <p className="text-gray-600">
                    Connect all your communication channels in one place. Email, Twilio, Justcall, IMAP, and more, all in a single, organized inbox that puts you in control.
                  </p>
                </div>
                <div className="hidden md:block relative flex-1">
                  <div className="absolute right-0 bottom-0 transform translate-x-16 translate-y-16 opacity-30 group-hover:opacity-40 transition-opacity">
                    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" className="text-black">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="3" y1="9" x2="21" y2="9"></line>
                      <line x1="9" y1="21" x2="9" y2="9"></line>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Feature */}
            <div className="col-span-1 row-span-2 p-6 bg-white rounded-lg border border-[#eaeaea] shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.1)] transition-all overflow-hidden relative">
              <div className="h-10 w-10 rounded-md bg-black/5 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-black">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">AI Assistant</h3>
              <p className="text-gray-600 text-sm">
                Smart, context-aware AI that helps you manage emails, craft responses, and summarize long threads for quick understanding.
              </p>
              <div className="absolute bottom-6 right-6 opacity-10">
                <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" className="text-black">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
            </div>

            {/* Real-time Sync */}
            <div className="col-span-1 row-span-1 p-6 bg-white rounded-lg border border-[#eaeaea] shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.1)] transition-all relative overflow-hidden">
              <div className="h-8 w-8 rounded-md bg-black/5 flex items-center justify-center mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-black">
                  <polyline points="17 1 21 5 17 9"></polyline>
                  <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                  <polyline points="7 23 3 19 7 15"></polyline>
                  <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-1">Real-time Sync</h3>
              <p className="text-gray-600 text-sm">
                Messages sync instantly across all devices.
              </p>
            </div>

            {/* Search */}
            <div className="col-span-1 row-span-1 p-6 bg-white rounded-lg border border-[#eaeaea] shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.1)] transition-all relative overflow-hidden">
              <div className="h-8 w-8 rounded-md bg-black/5 flex items-center justify-center mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-black">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-1">Universal Search</h3>
              <p className="text-gray-600 text-sm">
                Find messages across all your channels in seconds.
              </p>
            </div>

            {/* Security */}
            <div className="col-span-1 row-span-1 p-6 bg-white rounded-lg border border-[#eaeaea] shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.1)] transition-all relative overflow-hidden">
              <div className="h-8 w-8 rounded-md bg-black/5 flex items-center justify-center mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-black">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-1">Stored on our servers</h3>
              <p className="text-gray-600 text-sm">
                Your data is stored on our servers. We do not sell your data to third parties.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-gray-50 mix-blend-multiply filter blur-3xl opacity-70"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-gray-50 mix-blend-multiply filter blur-3xl opacity-70"></div>
        </div>

        <div className="container max-w-5xl mx-auto px-6 relative z-10">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-medium mb-6">Be among the first to experience CommSync</h2>
            <p className="text-lg text-gray-600 mb-8">
              Limited spots are available for our private beta. Join now to claim your spot and receive exclusive early access benefits.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <WaitlistDialog>
                <Button className="w-full sm:w-auto h-12 px-8 rounded-md bg-black text-white hover:bg-gray-800 transition-all border border-transparent font-medium">
                  Join the Waitlist
                </Button>
              </WaitlistDialog>
              <p className="text-sm text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block mr-1">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <span>We&apos;ll notify you when it&apos;s ready</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="relative h-[50vh] w-full overflow-hidden bg-gradient-to-b from-background to-[#f5f5f5]">
        {/** a wide 0.5vw separator */}
        <div className="absolute inset-0 w-[80%] h-1 bg-gray-200 mx-auto"></div>
        {/* Large watermark text positioned absolutely with translucent effect - More similar to Firecrawl */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <h2 className="text-[min(15vw,25rem)] font-bold text-[#f0f0f0] uppercase tracking-tighter leading-none select-none whitespace-nowrap -mb-[35vh]">
            CommSync
          </h2>
        </div>

        <div className="container max-w-5xl mx-auto px-6 relative z-10 h-full flex flex-col justify-center">
          <div className="text-center">
            <h2 className="text-3xl md:text-5xl font-medium mb-4">Everything you need in one place</h2>
            <p className="text-lg text-gray-600 max-w-xl mx-auto mb-10">
              CommSync brings all your business communications together in one unified inbox
            </p>

            <div className="mt-12 text-sm text-gray-500">
              <p>© 2025 CommSync. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
