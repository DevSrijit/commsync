import { FeatureSteps } from "@/components/blocks/feature-section"

const features = [
  { 
    step: 'Step 1', 
    title: 'Sync Emails',
    content: 'Connect your google workspace accounts or use IMAP to sync all of your emails.', 
    image: 'https://images.unsplash.com/photo-1723958929247-ef054b525153?q=80&w=2070&auto=format&fit=crop' 
  },
  { 
    step: 'Step 2',
    title: 'Connect Socials',
    content: 'Get all of your socials connected to receive messages in CommSync',
    image: 'https://images.unsplash.com/photo-1723931464622-b7df7c71e380?q=80&w=2070&auto=format&fit=crop'
  },
  { 
    step: 'Step 3',
    title: 'Send Messages',
    content: 'Use our composer to send messages to your contacts, on any platform.',
    image: 'https://images.unsplash.com/photo-1725961476494-efa87ae3106a?q=80&w=2070&auto=format&fit=crop'
  },
]

export default function FeatureSection() {
  return (
      <FeatureSteps 
        features={features}
        title="Your Journey Starts Here"
        autoPlayInterval={4000}
        imageHeight="h-[500px]"
      />
  )
}