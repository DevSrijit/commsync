"use client";
import React from "react";
import { Marquee } from "@/components/ui/marquee"
import { FeaturesSectionWithBentoGrid } from "@/components/blocks/feature-section-with-bento-grid";
import { TextReveal } from "@/components/magicui/text-reveal";
import Testimonials from "@/components/hero/marquee";
import { Pricing } from "@/components/ui/pricing-section-with-comparison"
import PreFooter from "@/components/hero/pre-footer";
import FooterSection from "@/components/hero/footer";
import FeatureSection from "@/components/hero/feature";
import AiLines from "@/components/hero/ai-lines";
import { HeroSection } from "@/components/blocks/hero";
import { FeaturesSlim } from "@/components/blocks/features-7";
import { FeaturesSketch } from "../blocks/features-10";

const Landing = () => {
  return (
    <div className="bg-[#FAFAFA] dark:bg-black ">
      <HeroSection />
      <div className="space-y-8" suppressHydrationWarning={true}>
        <Marquee text="Messages made easier" duration={15} suppressHydrationWarning={true} />
      </div>
      <FeaturesSlim />
      <FeatureSection />
      <FeaturesSketch />
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
