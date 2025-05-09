import { Cpu, Lock, Sparkles, Zap } from 'lucide-react'

export function FeaturesSlim() {
    return (
        <section className="overflow-hidden py-16 md:py-32">
            <div className="mx-auto max-w-screen-xl space-y-8 px-6 md:space-y-12">
                <div className="relative z-10 max-w-2xl">
                    <h2 className="text-4xl font-semibold lg:text-5xl">Built with all of your messaging needs in mind</h2>
                    <p className="mt-6 text-lg">Empower your team with a unified messaging platform.</p>
                </div>
                <div className="relative -mx-4 rounded-3xl p-3 md:-mx-12 lg:col-span-3">
                    <div className="[perspective:800px]">
                        <div className="[transform:skewY(-2deg)skewX(-2deg)rotateX(6deg)]">
                            <div className="aspect-[88/36] relative">
                                <div className="[background-image:radial-gradient(var(--tw-gradient-stops,at_75%_25%))] dark:to-[#000000] light:to-[#000000] z-1 -inset-[4.25rem] absolute from-transparent to-75%"></div>
                                <img src="/dashboard-dark.png" className="hidden dark:block" alt="payments illustration dark" width={2797} height={1137} />
                                <img src="/dashboard-light.png" className="dark:hidden" alt="payments illustration light" width={2797} height={1137} />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="relative mx-auto grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-8 lg:grid-cols-4">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Zap className="size-4" />
                            <h3 className="text-sm font-medium">Unified</h3>
                        </div>
                        <p className="text-muted-foreground text-sm">Merge contacts across platforms to create a single view of each person, regardless of which channel they use to communicate.</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Cpu className="size-4" />
                            <h3 className="text-sm font-medium">Powerful</h3>
                        </div>
                        <p className="text-muted-foreground text-sm">Send messages to your contacts on any platform - WhatsApp, X, LinkedIn, Instagram, and more - all from a single interface.</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Lock className="size-4" />
                            <h3 className="text-sm font-medium">Security</h3>
                        </div>
                        <p className="text-muted-foreground text-sm">All of your messages are encrypted and stored securely.</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Sparkles className="size-4" />

                            <h3 className="text-sm font-medium">AI Powered</h3>
                        </div>
                        <p className="text-muted-foreground text-sm">Our AI powered composer helps you write messages faster and more accurately.</p>
                    </div>
                </div>
            </div>
        </section>
    )
}
