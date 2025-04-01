import React from "react";
import { cn } from "@/lib/utils";
import createGlobe from "cobe";
import { useEffect, useRef } from "react";
import { Meteors } from "../magicui/meteors";
import { AuroraText } from "../magicui/aurora-text";
import { Particles } from "../magicui/particles";
import { EvervaultCard } from "../ui/evervault-card";
import { ThemeProvider } from "../theme-provider";
import { useTheme } from "next-themes";
import { InteractiveGridPattern } from "../magicui/interactive-grid-pattern";

export function FeaturesSectionWithBentoGrid() {
  const features = [
    {
      title: "Simplify your business",
      description:
        "Track and manage contacts effectively across multiple platforms in one unified interface.",
      skeleton: <SkeletonOne />,
      className:
        "col-span-1 md:col-span-4 lg:col-span-4 border-b md:border-r dark:border-neutral-800",
    },
    {
      title: "Reply & Manage in One Place",
      description:
        "Our composer lets you send messages to your contacts on any platform - WhatsApp, Slack, Instagram, and more - all from a single interface.",
      skeleton: (
        <SkeletonTwo />
      ),
      className: "col-span-1 md:col-span-2 lg:col-span-2 border-b dark:border-neutral-800 relative",
    },
    {
      title: "Contact Unification",
      description:
        "Automatically merge contacts across platforms to create a single view of each person, regardless of which channel they use to communicate.",
      skeleton: <SkeletonThree />,
      className:
        "col-span-1 md:col-span-3 lg:col-span-3 border-b md:border-r dark:border-neutral-800",
    },
    {
      title: "Accelerate your business",
      description:
        "Accelerate your business with our tailored solutions.",
      skeleton: <SkeletonFour />,
      className: "col-span-1 md:col-span-3 lg:col-span-3 border-b md:border-none",
    },
  ];
  return (
    <div className="relative z-20 py-10 lg:py-40 max-w-7xl mx-auto">
      <div className="px-8">
        <h1 className="text-3xl lg:text-5xl lg:leading-tight max-w-5xl mx-auto text-center tracking-tight font-medium">
          CommSync {typeof window !== 'undefined' && !navigator.userAgent.includes('Safari') ? (
            <AuroraText speed={1.5}>offers a lot</AuroraText>
          ) : (
            <span>offers a lot</span>
          )}
        </h1>

        <p className="text-sm lg:text-base max-w-2xl my-4 mx-auto text-neutral-500 text-center font-normal dark:text-neutral-300">
          Sync all of your messages from multiple platforms into one place.
          Create groups of contacts to see all of their messages into one place.
        </p>
      </div>

      <div className="relative">
        <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-6 mt-12 xl:border rounded-md dark:border-neutral-800">
          {features.map((feature) => (
            <FeatureCard key={feature.title} className={feature.className}>
              <FeatureTitle>{feature.title}</FeatureTitle>
              <FeatureDescription>{feature.description}</FeatureDescription>
              <div className="h-full w-full">{feature.skeleton}</div>
            </FeatureCard>
          ))}
        </div>
      </div>
    </div>
  );
}

const FeatureCard = ({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn(`p-4 sm:p-8 relative overflow-hidden`, className)}>
      {children}
    </div>
  );
};

const FeatureTitle = ({ children }: { children?: React.ReactNode }) => {
  return (
    <p className="max-w-5xl mx-auto text-left tracking-tight text-black dark:text-white text-xl md:text-2xl md:leading-snug">
      {children}
    </p>
  );
};

const FeatureDescription = ({ children }: { children?: React.ReactNode }) => {
  return (
    <p
      className={cn(
        "text-sm md:text-base max-w-4xl text-left mx-auto",
        "text-neutral-500 text-center font-normal dark:text-neutral-300",
        "text-left max-w-sm mx-0 md:text-sm my-2"
      )}
    >
      {children}
    </p>
  );
};

export const SkeletonOne = () => {
  const { theme } = useTheme();
  return (
    <Particles
      className="absolute inset-0 z-0"
      quantity={200}
      ease={100}
      refresh
      color={theme === "dark" ? "#ffffff" : "#000000"}
    />
  );
};

export const SkeletonTwo = () => {
  return (
    <div className="relative inset-0 z-10 pt-10">
      <div className="h-full w-full rounded-[24px] overflow-hidden 
               bg-gradient-to-br from-white/90 to-white/50 
               dark:from-neutral-900/90 dark:to-neutral-800/50 
               backdrop-blur-xl p-[1px] shadow-lg
               transition-colors duration-700">
        <div className="relative h-full w-full rounded-[22px] 
                 bg-white/90 dark:bg-black/90 
                 backdrop-blur-md flex items-center justify-center overflow-hidden group
                 transition-all duration-700">
          {/* Abstract Background Shapes */}
          <div className="absolute inset-0 opacity-30 group-hover:opacity-60 transition-all duration-700">
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full 
                     bg-gradient-to-br from-purple-400/40 to-blue-500/40 dark:from-purple-500/40 dark:to-blue-600/40 
                     blur-2xl animate-float-slow transition-colors duration-700" />
            <div className="absolute bottom-[-30%] right-[-20%] w-[80%] h-[80%] rounded-full 
                     bg-gradient-to-tr from-indigo-400/40 to-pink-500/40 dark:from-indigo-500/40 dark:to-pink-600/40 
                     blur-2xl animate-float-slow-reverse transition-colors duration-700" />
            <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] rounded-full 
                     bg-gradient-to-bl from-sky-400/40 to-emerald-500/40 dark:from-sky-500/40 dark:to-emerald-600/40 
                     blur-2xl animate-pulse-slow transition-colors duration-700" />
          </div>

          {/* Floating Dots */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute w-2 h-2 rounded-full 
                     bg-purple-500/40 dark:bg-purple-400/40 
                     top-[20%] left-[30%] animate-float-slow transition-colors duration-700" />
            <div className="absolute w-3 h-3 rounded-full 
                     bg-blue-500/40 dark:bg-blue-400/40 
                     bottom-[30%] right-[20%] animate-float-slow-reverse transition-colors duration-700" />
            <div className="absolute w-2 h-2 rounded-full 
                     bg-pink-500/40 dark:bg-pink-400/40 
                     top-[40%] right-[40%] animate-pulse-slow transition-colors duration-700" />
          </div>

          {/* Content */}
          <div className="relative z-10 text-center p-6 transform transition-all duration-500 group-hover:scale-105">
            <div className="flex flex-col items-center space-y-4">
              {/* Abstract Icon */}
              <div className="relative w-12 h-12 mb-2">
                <div className="absolute inset-0 
                         bg-gradient-to-tr from-purple-500/80 to-blue-500/80 
                         dark:from-purple-400/80 dark:to-blue-400/80 
                         rounded-xl rotate-45 transform transition-all duration-500 group-hover:rotate-90" />
                <div className="absolute inset-2 
                         bg-white dark:bg-black 
                         rounded-lg transition-colors duration-700" />
                <div className="absolute inset-4 
                         bg-gradient-to-br from-indigo-500/80 to-pink-500/80 
                         dark:from-indigo-400/80 dark:to-pink-400/80 
                         rounded-md transform transition-all duration-500 group-hover:-rotate-45" />
              </div>

              {/* Text Content */}
              <p className="text-base font-medium 
                     text-neutral-800 dark:text-neutral-200 
                     tracking-wide transition-colors duration-700">
                Unified Messaging
              </p>

              {/* Platform Pills */}
              <div className="flex flex-wrap justify-center gap-2">
                {["Messages", "Email", "Social"].map((platform) => (
                  <span
                    key={platform}
                    className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full 
                                 bg-gradient-to-r from-neutral-100/90 to-neutral-50/90 
                                 dark:from-neutral-800/90 dark:to-neutral-700/90 
                                 text-neutral-700 dark:text-neutral-200
                                 backdrop-blur-sm shadow-sm
                                 transition-all duration-300 hover:scale-105
                                 border border-neutral-200/50 dark:border-neutral-700/50"
                  >
                    {platform}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SkeletonThree = () => {
  return (
    <Meteors number={50} className="opacity-50 blur-xs" />
  );
};

export const SkeletonFour = () => {
  return (
    <div className="h-60 md:h-60 flex flex-col items-center relative bg-transparent dark:bg-transparent mt-10">
      <Globe className="absolute -right-10 md:-right-10 -bottom-80 md:-bottom-72" />
    </div>
  );
};

export const Globe = ({ className }: { className?: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let phi = 0;

    if (!canvasRef.current) return;

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: 600 * 2,
      height: 600 * 2,
      phi: 0,
      theta: 0,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.3, 0.3, 0.3],
      markerColor: [0.1, 0.8, 1],
      glowColor: [1, 1, 1],
      markers: [
        { location: [37.7595, -122.4367], size: 0.03 },
        { location: [40.7128, -74.006], size: 0.1 },
      ],
      onRender: (state) => {
        state.phi = phi;
        phi += 0.01;
      },
    });

    return () => {
      globe.destroy();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: 600, height: 600, maxWidth: "100%", aspectRatio: 1 }}
      className={className}
    />
  );
};