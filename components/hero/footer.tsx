"use client";

import {
  Blocks,
  CodeXml,
  CreditCard,
  Handshake,
  Scale,
  Webhook,
  User
} from "lucide-react";
import { Footer } from "@/components/blocks/footer";

export default function FooterSection() {
  return (
    <Footer
      className="mt-20 w-full max-w-screen-2xl mx-auto"
      brand={{
        name: "CommSync",
        description: "Making your business communications easier.",
      }}
      socialLinks={[
        {
          name: "Twitter",
          href: "#",
        },
        {
          name: "Github",
          href: "#",
        },
        {
          name: "Discord",
          href: "#",
        },
      ]}
      columns={[
        {
          title: "Product",
          links: [
            {
              name: "Features",
              Icon: Blocks,
              href: "#features",
            },
            {
              name: "Pricing",
              Icon: CreditCard,
              href: "#pricing",
            },
            {
              name: "Integrations",
              Icon: Webhook,
              href: "#integrations",
            },
            {
              name: "About Us",
              Icon: User,
              href: "#about-us",
            },
          ],
        },
        {
          title: "Legal",
          links: [
            {
              name: "Privacy Policy",
              Icon: Scale,
              href: "/privacy",
            },
            {
              name: "Terms of Service",
              Icon: Handshake,
              href: "/tos",
            },
          ],
        },
      ]}
      copyright="CommSync © 2025"
    />
  );
}