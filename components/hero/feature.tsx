import { FeatureSteps } from "@/components/blocks/feature-section"
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Mail, MessageSquare, Users, Link2, RefreshCw, LucideIcon, ArrowRight } from 'lucide-react'
import { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const features = [
  {
    step: 'Step 1',
    title: 'Sync Emails',
    content: 'Connect your google workspace accounts or use IMAP to sync all of your emails.',
    icon: Mail,
    color: 'bg-blue-500/10 text-blue-500'
  },
  {
    step: 'Step 2',
    title: 'Connect Socials',
    content: 'Get all of your socials connected to receive messages in CommSync',
    icon: Link2,
    color: 'bg-purple-500/10 text-purple-500'
  },
  {
    step: 'Step 3',
    title: 'Send Messages',
    content: 'Use our composer to send messages to your contacts, on any platform.',
    icon: MessageSquare,
    color: 'bg-green-500/10 text-green-500'
  },
]

export default function StepperGuide() {
  return (
    <section className="py-16 md:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-semibold lg:text-5xl">It's easy to get started</h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Follow these simple steps to unify your communications with CommSync
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              step={feature.step}
              title={feature.title}
              content={feature.content}
              icon={feature.icon}
              color={feature.color}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

interface FeatureCardProps {
  step: string;
  title: string;
  content: string;
  icon: LucideIcon;
  color: string;
  index: number;
}

const FeatureCard = ({ step, title, content, icon: Icon, color, index }: FeatureCardProps) => (
  <Card className="group relative rounded-none shadow-zinc-950/5 hover:shadow-md transition-shadow duration-300">
    <CardDecorator />
    <CardHeader className="pb-3">
      <div className="flex items-center gap-2 mb-1">
        <Badge variant="outline" className="text-xs font-medium">{step}</Badge>
        <div className="h-px flex-1 bg-muted"></div>
      </div>
      <h3 className="text-xl font-semibold">{title}</h3>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground mb-6">{content}</p>

      <div className="relative mb-6 border-t border-dashed py-6">
        <div className="absolute inset-0 [background:radial-gradient(125%_125%_at_50%_0%,transparent_40%,hsl(var(--muted)),white_125%)]"></div>
        <FeatureVisual icon={Icon} color={color} index={index} />
      </div>

      {index < 2 && (
        <div className="absolute -right-3 top-1/2 transform -translate-y-1/2 md:block hidden">
          <div className="bg-background rounded-full p-2 shadow-md">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      )}
    </CardContent>
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

interface FeatureVisualProps {
  icon: LucideIcon;
  color: string;
  index: number;
}

const FeatureVisual = ({ icon: Icon, color, index }: FeatureVisualProps) => {
  // Create different visualization based on step index
  if (index === 0) {
    return <EmailSyncVisual Icon={Icon} color={color} />
  } else if (index === 1) {
    return <ConnectSocialsVisual Icon={Icon} color={color} />
  } else {
    return <SendMessagesVisual Icon={Icon} color={color} />
  }
}

// Custom visualizations for each step
const EmailSyncVisual = ({ Icon, color }: { Icon: LucideIcon, color: string }) => (
  <div className="flex flex-col items-center">
    <div className={`w-16 h-16 rounded-full ${color} flex items-center justify-center mb-4`}>
      <Icon className="h-8 w-8" />
    </div>
    <div className="grid grid-cols-3 gap-3 w-full max-w-[250px] mx-auto">
      {[1, 2, 3].map((i) => (
        <div key={i} className="aspect-[1/1] rounded-lg shadow-sm border bg-card flex flex-col items-center justify-center p-2">
          <div className="w-full h-2 bg-muted/70 rounded mb-2"></div>
          <div className="w-3/4 h-2 bg-muted/70 rounded mb-1"></div>
          <div className="w-1/2 h-2 bg-muted/70 rounded"></div>
        </div>
      ))}
    </div>
    <div className="mt-4 w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
      <RefreshCw className="h-6 w-6 text-primary animate-spin [animation-duration:3s]" />
    </div>
  </div>
)

const ConnectSocialsVisual = ({ Icon, color }: { Icon: LucideIcon, color: string }) => (
  <div className="flex flex-col items-center">
    <div className={`w-16 h-16 rounded-full ${color} flex items-center justify-center mb-4`}>
      <Icon className="h-8 w-8" />
    </div>
    <div className="flex gap-2 justify-center mb-4">
      {['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-green-500'].map((bgColor, i) => (
        <div key={i} className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center shadow-sm`}>
          <div className="w-5 h-5 bg-white/90 rounded-sm"></div>
        </div>
      ))}
    </div>
    <div className="w-full max-w-[250px] mx-auto border rounded-xl shadow-sm bg-card p-3">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-muted/70"></div>
        <div className="flex-1">
          <div className="w-3/4 h-2 bg-muted/70 rounded mb-1"></div>
          <div className="w-1/2 h-2 bg-muted/70 rounded"></div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="h-6">
          <span className="text-xs">Connect</span>
        </Button>
      </div>
    </div>
  </div>
)

const SendMessagesVisual = ({ Icon, color }: { Icon: LucideIcon, color: string }) => (
  <div className="flex flex-col items-center">
    <div className={`w-16 h-16 rounded-full ${color} flex items-center justify-center mb-4`}>
      <Icon className="h-8 w-8" />
    </div>
    <div className="w-full max-w-[250px] mx-auto border rounded-xl shadow-sm bg-card overflow-hidden">
      <div className="border-b p-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-muted/70"></div>
          <div className="w-20 h-2 bg-muted/70 rounded"></div>
        </div>
        <div className="flex">
          <Badge variant="outline" className="text-[10px]">Email</Badge>
          <Badge variant="outline" className="text-[10px] ml-1">SMS</Badge>
        </div>
      </div>
      <div className="p-3">
        <div className="w-full h-20 bg-muted/30 rounded mb-3 flex items-center justify-center">
          <span className="text-xs text-muted-foreground">Message content...</span>
        </div>
        <div className="flex justify-between items-center">
          <div className="w-6 h-6 rounded-full bg-muted/50"></div>
          <Button size="sm" className="h-7 rounded-full">
            <span className="text-xs">Send</span>
          </Button>
        </div>
      </div>
    </div>
  </div>
)