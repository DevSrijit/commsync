import React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function LegalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-background">
            <header className="border-b">
                <div className="container flex h-16 items-center px-4">
                    <Link
                        href="/"
                        className="mr-6 flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Back to CommSync
                    </Link>
                    <nav className="flex items-center space-x-6 text-sm font-medium">
                        <Link
                            href="/legal/privacy"
                            className="transition-colors hover:text-primary"
                        >
                            Privacy Policy
                        </Link>
                        <Link
                            href="/legal/tos"
                            className="transition-colors hover:text-primary"
                        >
                            Terms of Service
                        </Link>
                    </nav>
                </div>
            </header>
            <main>{children}</main>
            <footer className="border-t py-6">
                <div className="container flex flex-col items-center justify-between gap-4 md:flex-row px-4">
                    <p className="text-center text-sm text-muted-foreground">
                        &copy; {new Date().getFullYear()} CommSync. All rights reserved.
                    </p>
                    <nav className="flex items-center gap-4 text-sm text-muted-foreground">
                        <Link href="/legal/privacy" className="underline underline-offset-4 hover:text-primary">
                            Privacy
                        </Link>
                        <Link href="/legal/tos" className="underline underline-offset-4 hover:text-primary">
                            Terms
                        </Link>
                    </nav>
                </div>
            </footer>
        </div>
    );
} 