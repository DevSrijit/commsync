"use client";
import React, { useEffect, useState } from "react";
import { HeroSection } from "@/components/blocks/hero-section-dark";
import { Marquee } from "@/components/ui/marquee"
import { FeaturesSectionWithBentoGrid } from "@/components/blocks/feature-section-with-bento-grid";


const Landing = () => {
  return (
    <>
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
          light: "/dashboard.png",
          dark: "/dashboard.png",
        }}
      />
      <div className="space-y-8">
        <Marquee text="Messages made easier" duration={15} suppressHydrationWarning={true} />
      </div>
      <div className="min-h-screen w-full">
        <div className="relative w-full">
          <FeaturesSectionWithBentoGrid />
        </div>
      </div>
    </>
  );
};

export default Landing;
