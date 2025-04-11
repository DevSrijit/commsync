import { Book } from "@/components/ui/book";
import Link from "next/link";
import { Metadata } from "next";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
    title: "Legal Documents | CommSync",
    description: "CommSync legal documents - Privacy Policy and Terms of Service",
};

export default function LegalPage() {
    return (
        <div className="container max-w-5xl mx-auto py-16 px-4 sm:px-6">
            <div className="flex flex-col items-center mb-12">
                <h1 className="text-3xl font-semibold tracking-tight mb-2">Legal Documents</h1>
                <p className="text-muted-foreground text-center max-w-2xl">
                    Important information about how we protect your privacy and the terms governing your use of CommSync
                </p>
                <Separator className="mt-6 mb-10 w-1/3" />
            </div>

            <div className="flex flex-col sm:flex-row justify-center items-center gap-12 sm:gap-24">
                <Link href="/legal/privacy" className="transform transition-transform hover:scale-105">
                    <Book
                        color="#147efb"
                        textColor="#ffffff"
                        depth={8}
                        width={220}
                        texture={true}
                    >
                        <div className="p-6 grid gap-2">
                            <h2 className="text-xl font-medium">Privacy Policy</h2>
                            <p className="text-sm opacity-90 mt-1">
                                How we collect, use, and protect your personal information
                            </p>
                            <div className="mt-4 flex items-center text-xs">
                                <span className="opacity-75">Last updated: April 10, 2025</span>
                            </div>
                        </div>
                    </Book>
                </Link>

                <Link href="/legal/tos" className="transform transition-transform hover:scale-105">
                    <Book
                        color="#ff2d55"
                        textColor="#ffffff"
                        depth={8}
                        width={220}
                        texture={true}
                    >
                        <div className="p-6 grid gap-2">
                            <h2 className="text-xl font-medium">Terms of Service</h2>
                            <p className="text-sm opacity-90 mt-1">
                                The rules and guidelines for using CommSync services
                            </p>
                            <div className="mt-4 flex items-center text-xs">
                                <span className="opacity-75">Last updated: April 10, 2025</span>
                            </div>
                        </div>
                    </Book>
                </Link>
            </div>
        </div>
    );
} 