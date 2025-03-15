import { TestimonialsSection } from "@/components/blocks/testimonials-with-marquee"


const testimonials = [
  {
    author: {
      name: "Alex Chen",
      handle: "@alexcomms",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face"
    },
    text: "CommSync has revolutionized how I manage my communications. Having all my messages in one place is a game-changer!",
    href: "https://twitter.com/alexcomms"
  },
  {
    author: {
      name: "Sarah Johnson",
      handle: "@sarahj",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face"
    },
    text: "The grouped conversations feature in CommSync has saved me hours of switching between apps. It's incredibly intuitive!",
    href: "https://twitter.com/sarahj"
  },
  {
    author: {
      name: "Miguel Hernandez",
      handle: "@miguelh",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face"
    },
    text: "As a freelancer juggling multiple clients, CommSync has become my go-to tool for keeping all my communications organized."
  }
]

export default function Testimonials() {
  return (
    <TestimonialsSection
      title="Trusted by the best"
      description="Join thousands of people who are already using CommSync to manage their communications."
      testimonials={testimonials}
    />
  )
}