import { FeatureSteps } from "@/components/blocks/feature-section"

const features = [
  { 
    step: 'Step 1', 
    title: 'Sync Emails',
    content: 'Connect your google workspace accounts or use IMAP to sync all of your emails.', 
    image: 'https://images.unsplash.com/photo-1729433272889-254303bd21a2?q=80&w=2070&auto=format&fit=crop' 
  },
  { 
    step: 'Step 2',
    title: 'Connect Socials',
    content: 'Get all of your socials connected to receive messages in CommSync',
    image: 'https://images.unsplash.com/photo-1688220019235-3408628f1ef9?q=80&w=2070&auto=format&fit=crop'
  },
  { 
    step: 'Step 3',
    title: 'Send Messages',
    content: 'Use our composer to send messages to your contacts, on any platform.',
    image: 'https://images.unsplash.com/photo-1567794947803-59c1ec40ab6c?q=80&w=2070&auto=format&fit=crop'
  },
]

export default function FeatureSection() {
  return (
    <div className="h-full">
      <FeatureSteps 
        features={features}
        title="It's easy to get started"
        autoPlayInterval={4000}
        imageHeight="h-full"
        className="h-full"
      />
    </div>
  )
}