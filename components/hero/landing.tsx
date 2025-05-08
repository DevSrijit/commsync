"use client";
import React from "react";
import { HeroSection } from "@/components/blocks/hero-section-dark";
import { Marquee } from "@/components/ui/marquee"
import { FeaturesSectionWithBentoGrid } from "@/components/blocks/feature-section-with-bento-grid";
import { TextReveal } from "@/components/magicui/text-reveal";
import Testimonials from "@/components/hero/marquee";
import { Pricing } from "@/components/ui/pricing-section-with-comparison"
import PreFooter from "@/components/hero/pre-footer";
import FooterSection from "@/components/hero/footer";
import FeatureSection from "@/components/hero/feature";
import AiLines from "@/components/hero/ai-lines";

const Landing = () => {
  return (
    <div className="bg-white dark:bg-black w-full min-w-full">
      <HeroSection
        title="Welcome to CommSync"
        subtitle={{
          regular: "Sync all of your messages ",
          gradient: "into grouped conversations",
        }}
        description="Tired of switching between apps to keep up with your messages? CommSync brings all of your messages into one place, grouped by the sender."
        ctaText="Get Started"
        ctaHref="/login"
        bottomImage={{
          light: "/dashboard-light.png",
          dark: "/dashboard-dark.png",
        }}
      />
      <div className="space-y-8" suppressHydrationWarning={true}>
        <Marquee text="Messages made easier" duration={15} suppressHydrationWarning={true} />
      </div>
      <div className="min-h-screen w-full bg-white dark:bg-black">
        <div className="relative w-full">
          <FeaturesSectionWithBentoGrid />
        </div>
      </div>
      <FeatureSection />
      <TextReveal>We handle the sync. You handle the rest. Deal?</TextReveal>
      <div className="mt-0">
        <AiLines />
      </div>
      <Testimonials />
      <div className="w-full">
        <Pricing />
      </div>
      <PreFooter />
      <FooterSection />
    </div>
  );
};

export default Landing;
