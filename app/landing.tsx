"use client";
import React, { useEffect, useState } from "react";
import { HeroSection } from "@/components/blocks/hero-section-dark";

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
    </>
  );
};

export default Landing;
