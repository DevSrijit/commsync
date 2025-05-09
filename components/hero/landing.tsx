"use client";
import React from "react";
import { Marquee } from "@/components/ui/marquee"
import { TextReveal } from "@/components/magicui/text-reveal";
import { Pricing } from "@/components/ui/pricing-section-with-comparison"
import PreFooter from "@/components/hero/pre-footer";
import FooterSection from "@/components/hero/footer";
import AiLines from "@/components/hero/ai-lines";
import { HeroSection } from "@/components/blocks/hero";
import { FeaturesSlim } from "@/components/blocks/features-7";
import { FeaturesSketch } from "../blocks/features-10";
import TestimonialsV2 from "@/components/hero/testimonials-v2";
import { CTASection } from "@/components/blocks/cta-with-rectangle"

const Landing = () => {
  return (
    <>
      <div className="bg-[#FAFAFA] dark:bg-black ">
        <HeroSection />
        <div className="space-y-8" suppressHydrationWarning={true}>
          <Marquee text="Messages made easier" duration={15} suppressHydrationWarning={true} />
        </div>
        <FeaturesSlim />
        <FeaturesSketch />
        <TestimonialsV2 />
        <TextReveal>We handle the sync. You handle the rest. Deal?</TextReveal>
        <div className="mt-0">
          <AiLines />
        </div>
        <div className="w-full">
          <Pricing
          />
        </div>
        <CTASection
          badge={{
            text: "Get started"
          }}
          title="Start using CommSync"
          description="Get started with CommSync and declutter your inbox in no time."
          action={{
            text: "Get Started",
            href: "/register",
            variant: "default"
          }}
          className="mt-12 size-full"
        />
        <FooterSection />
      </div>
    </>
  );
};

export default Landing;
