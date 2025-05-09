import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Mail, MessageSquare, Users, Calendar, LucideIcon, RefreshCw, Check, MoreHorizontal, Paperclip, Star, Clock, Sparkles, Send } from 'lucide-react'
import { ReactNode } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

export function FeaturesSketch() {
    return (
        <section className="bg-zinc-50 py-16 md:py-32 dark:bg-transparent">
            <div className="mx-auto max-w-2xl px-6 lg:max-w-5xl">
                <div className="mx-auto grid gap-4 lg:grid-cols-2">
                    <FeatureCard>
                        <CardHeader className="pb-3">
                            <CardHeading
                                icon={Mail}
                                title="Unified Inbox"
                                description="All your messages in one place. Connect Gmail, IMAP and SMS."
                            />
                        </CardHeader>

                        <div className="relative mb-6 border-t border-dashed sm:mb-0">
                            <div className="absolute inset-0 [background:radial-gradient(125%_125%_at_50%_0%,transparent_40%,hsl(var(--muted)),white_125%)]"></div>
                            <div className="aspect-[76/59] px-6 py-4">
                                <UnifiedInboxPreview />
                            </div>
                        </div>
                    </FeatureCard>

                    <FeatureCard>
                        <CardHeader className="pb-3">
                            <CardHeading
                                icon={MessageSquare}
                                title="Multi-Platform Messaging"
                                description="Send emails and SMS from one interface. Seamless communication."
                            />
                        </CardHeader>

                        <CardContent>
                            <div className="relative mb-6 sm:mb-0">
                                <div className="absolute -inset-6 [background:radial-gradient(50%_50%_at_75%_50%,transparent,hsl(var(--background))_100%)]"></div>
                                <div className="aspect-[76/59]">
                                    <MessageComposerPreview />
                                </div>
                            </div>
                        </CardContent>
                    </FeatureCard>

                    <FeatureCard className="p-6 lg:col-span-2">
                        <p className="mx-auto my-6 max-w-md text-balance text-center text-2xl font-semibold">
                            Intelligent communication with AI-powered tools and analytics.
                        </p>

                        <div className="flex justify-center gap-6 overflow-hidden">
                            <CircularUI
                                label="Connect"
                                circles={[{ pattern: 'border' }, { pattern: 'border' }]}
                            />

                            <CircularUI
                                label="Sync"
                                circles={[{ pattern: 'none' }, { pattern: 'primary' }]}
                            />

                            <CircularUI
                                label="Engage"
                                circles={[{ pattern: 'blue' }, { pattern: 'none' }]}
                            />

                            <CircularUI
                                label="Analyze"
                                circles={[{ pattern: 'primary' }, { pattern: 'none' }]}
                                className="hidden sm:block"
                            />
                        </div>
                    </FeatureCard>

                    <FeatureCard>
                        <CardHeader className="pb-3">
                            <CardHeading
                                icon={Users}
                                title="Group Management"
                                description="Create and manage contact groups for streamlined team communication."
                            />
                        </CardHeader>

                        <div className="relative mb-6 border-t border-dashed sm:mb-0">
                            <div className="absolute inset-0 [background:radial-gradient(125%_125%_at_50%_0%,transparent_40%,hsl(var(--muted)),white_125%)]"></div>
                            <div className="aspect-[76/59] px-6 py-4">
                                <ContactGroupsPreview />
                            </div>
                        </div>
                    </FeatureCard>

                    <FeatureCard>
                        <CardHeader className="pb-3">
                            <CardHeading
                                icon={RefreshCw}
                                title="Real-time Sync"
                                description="Automatic synchronization across all your connected accounts and devices."
                            />
                        </CardHeader>

                        <CardContent>
                            <div className="relative mb-6 sm:mb-0">
                                <div className="absolute -inset-6 [background:radial-gradient(50%_50%_at_75%_50%,transparent,hsl(var(--background))_100%)]"></div>
                                <div className="aspect-[76/59]">
                                    <SyncStatusPreview />
                                </div>
                            </div>
                        </CardContent>
                    </FeatureCard>
                </div>
            </div>
        </section>
    )
}

// Custom component previews
const UnifiedInboxPreview = () => {
    return (
        <div className="rounded-md border bg-card shadow-sm overflow-hidden h-full">
            <div className="flex items-center justify-between border-b px-3 py-2">
                <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Inbox</span>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">Gmail</Badge>
                    <Badge variant="outline" className="text-xs">Twilio</Badge>
                    <Badge variant="outline" className="text-xs">IMAP</Badge>
                </div>
            </div>
            <div className="divide-y">
                {[
                    { unread: true, name: "Alex Johnson", subject: "Project Update", preview: "I've completed the first draft of the proposal...", time: "10:30 AM", type: "email" },
                    { unread: false, name: "Marketing Team", subject: "Campaign Results", preview: "The Q2 marketing campaign exceeded expectations...", time: "Yesterday", type: "email" },
                    { unread: true, name: "+1 (555) 123-4567", subject: "", preview: "Are we still meeting at 3pm today?", time: "12:15 PM", type: "sms" },
                    { unread: false, name: "Sarah Miller", subject: "Client Feedback", preview: "Just got off a call with the client and they loved...", time: "Wed", type: "email" },
                ].map((message, i) => (
                    <div key={i} className={cn("px-4 py-3 flex gap-3 items-center hover:bg-muted/50", message.unread && "bg-muted/30")}>
                        <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarFallback className={message.type === "sms" ? "bg-blue-100 text-blue-600" : ""}>{message.name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between mb-0.5">
                                <span className={cn("text-sm truncate", message.unread && "font-medium")}>{message.name}</span>
                                <span className="text-xs text-muted-foreground">{message.time}</span>
                            </div>
                            {message.type === "email" ? (
                                <div className="text-xs text-muted-foreground truncate">{message.subject} - {message.preview}</div>
                            ) : (
                                <div className="text-xs text-blue-600 truncate">
                                    <MessageSquare className="h-3 w-3 inline-block mr-1" />
                                    {message.preview}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {message.unread && <div className="h-2 w-2 rounded-full bg-blue-500" />}
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

const MessageComposerPreview = () => {
    return (
        <div className="rounded-md border bg-card shadow-sm overflow-hidden h-full flex flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="text-lg font-medium">New Message</div>
                <Tabs defaultValue="email" className="w-[200px]">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="email">Email</TabsTrigger>
                        <TabsTrigger value="sms">SMS</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>
            <div className="p-4 space-y-4 flex-1">
                <div className="flex items-center gap-3">
                    <Label htmlFor="to" className="w-12 text-sm">To:</Label>
                    <Input id="to" placeholder="Email address(es)" className="flex-1 h-8" />
                </div>
                <div className="flex items-center gap-3">
                    <Label htmlFor="subject" className="w-12 text-sm">Subject:</Label>
                    <Input id="subject" placeholder="Message subject" className="flex-1 h-8" />
                </div>
                <div className="border rounded-md flex-1 p-3 min-h-[100px] text-sm text-muted-foreground">
                    <p>Write your message here...</p>
                </div>
            </div>
            <div className="border-t px-4 py-2 flex justify-between items-center">
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Paperclip className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Sparkles className="h-4 w-4" />
                    </Button>
                </div>
                <Button size="sm" className="rounded-full">
                    <Send className="h-4 w-4 mr-1" />
                    Send
                </Button>
            </div>
        </div>
    )
}

const ContactGroupsPreview = () => {
    return (
        <div className="rounded-md border bg-card shadow-sm overflow-hidden h-full">
            <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="text-base font-medium">Contact Groups</div>
                <Button size="sm" variant="outline" className="h-8">
                    <Users className="h-3.5 w-3.5 mr-1" />
                    New Group
                </Button>
            </div>
            <div className="divide-y">
                {[
                    { name: "Marketing Team", count: 8, icon: "M" },
                    { name: "Client Support", count: 5, icon: "C" },
                    { name: "Development", count: 12, icon: "D" },
                    { name: "Sales", count: 6, icon: "S" },
                ].map((group, i) => (
                    <div key={i} className="px-4 py-3 flex gap-3 items-center hover:bg-muted/50">
                        <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center font-medium">
                            {group.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{group.name}</span>
                                <Badge variant="outline" className="text-xs">{group.count} contacts</Badge>
                            </div>
                            <div className="flex -space-x-2 mt-1">
                                {Array(Math.min(group.count, 4)).fill(0).map((_, j) => (
                                    <Avatar key={j} className="h-5 w-5 ring-2 ring-background">
                                        <AvatarFallback className="text-[10px]">
                                            {String.fromCharCode(65 + (i * 4 + j) % 26)}
                                        </AvatarFallback>
                                    </Avatar>
                                ))}
                                {group.count > 4 && (
                                    <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] ring-2 ring-background">
                                        +{group.count - 4}
                                    </div>
                                )}
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    )
}

const SyncStatusPreview = () => {
    return (
        <div className="rounded-md border bg-card shadow-sm overflow-hidden h-full">
            <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="text-base font-medium">Account Sync Status</div>
                <Button size="sm" variant="ghost" className="h-8">
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Sync All
                </Button>
            </div>
            <div className="divide-y">
                {[
                    { name: "Gmail", status: "Connected", lastSync: "2 min ago", icon: Mail, color: "text-red-500" },
                    { name: "Office 365", status: "Connected", lastSync: "5 min ago", icon: Mail, color: "text-blue-500" },
                    { name: "Twilio SMS", status: "Connected", lastSync: "Just now", icon: MessageSquare, color: "text-purple-500" },
                    { name: "JustCall", status: "Syncing...", lastSync: "In progress", icon: MessageSquare, color: "text-green-500" },
                ].map((account, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                            <div className={cn("h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center", account.color)}>
                                <account.icon className="h-4 w-4" />
                            </div>
                            <div>
                                <div className="text-sm font-medium">{account.name}</div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    {account.status === "Syncing..." ? (
                                        <>
                                            <RefreshCw className="h-3 w-3 animate-spin" />
                                            {account.status}
                                        </>
                                    ) : (
                                        <>
                                            <Check className="h-3 w-3" />
                                            {account.status}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-xs text-muted-foreground">
                                <Clock className="h-3 w-3 inline mr-1" />
                                {account.lastSync}
                            </div>
                            <div className="flex items-center">
                                <Switch id={`account-${i}`} defaultChecked />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

interface FeatureCardProps {
    children: ReactNode
    className?: string
}

const FeatureCard = ({ children, className }: FeatureCardProps) => (
    <Card className={cn('group relative rounded-none shadow-zinc-950/5', className)}>
        <CardDecorator />
        {children}
    </Card>
)

const CardDecorator = () => (
    <>
        <span className="border-primary absolute -left-px -top-px block size-2 border-l-2 border-t-2"></span>
        <span className="border-primary absolute -right-px -top-px block size-2 border-r-2 border-t-2"></span>
        <span className="border-primary absolute -bottom-px -left-px block size-2 border-b-2 border-l-2"></span>
        <span className="border-primary absolute -bottom-px -right-px block size-2 border-b-2 border-r-2"></span>
    </>
)

interface CardHeadingProps {
    icon: LucideIcon
    title: string
    description: string
}

const CardHeading = ({ icon: Icon, title, description }: CardHeadingProps) => (
    <div className="p-6">
        <span className="text-muted-foreground flex items-center gap-2">
            <Icon className="size-4" />
            {title}
        </span>
        <p className="mt-8 text-2xl font-semibold">{description}</p>
    </div>
)

interface CircleConfig {
    pattern: 'none' | 'border' | 'primary' | 'blue'
}

interface CircularUIProps {
    label: string
    circles: CircleConfig[]
    className?: string
}

const CircularUI = ({ label, circles, className }: CircularUIProps) => (
    <div className={className}>
        <div className="bg-gradient-to-b from-border size-fit rounded-2xl to-transparent p-px">
            <div className="bg-gradient-to-b from-background to-muted/25 relative flex aspect-square w-fit items-center -space-x-4 rounded-[15px] p-4">
                {circles.map((circle, i) => (
                    <div
                        key={i}
                        className={cn('size-7 rounded-full border sm:size-8', {
                            'border-primary': circle.pattern === 'none',
                            'border-primary bg-[repeating-linear-gradient(-45deg,hsl(var(--border)),hsl(var(--border))_1px,transparent_1px,transparent_4px)]': circle.pattern === 'border',
                            'border-primary bg-background bg-[repeating-linear-gradient(-45deg,hsl(var(--primary)),hsl(var(--primary))_1px,transparent_1px,transparent_4px)]': circle.pattern === 'primary',
                            'bg-background z-1 border-blue-500 bg-[repeating-linear-gradient(-45deg,theme(colors.blue.500),theme(colors.blue.500)_1px,transparent_1px,transparent_4px)]': circle.pattern === 'blue',
                        })}></div>
                ))}
            </div>
        </div>
        <span className="text-muted-foreground mt-1.5 block text-center text-sm">{label}</span>
    </div>
)
