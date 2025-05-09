"use client";
import { useScroll, useTransform, motion, useSpring } from "framer-motion";
import React, { useEffect } from "react";
import { GoogleGeminiEffect } from "@/components/ui/google-gemini-effect";

export default function AiLines() {
    const ref = React.useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start center", "end center"]
    });

    // Create a spring animation for smoother progress
    const smoothProgress = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001
    });

    // Map the smooth progress to path lengths
    const pathLengthFirst = useTransform(smoothProgress, [0.25, 0.8], [0.1, 1]);
    const pathLengthSecond = useTransform(smoothProgress, [0.25, 0.8], [0.05, 1]);
    const pathLengthThird = useTransform(smoothProgress, [0.25, 0.8], [0.03, 1]);
    const pathLengthFourth = useTransform(smoothProgress, [0.25, 0.8], [0.02, 1]);
    const pathLengthFifth = useTransform(smoothProgress, [0.25, 0.8], [0, 1]);

    // Add scroll snap behavior when component is in view
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        (entry.target as HTMLElement).style.scrollSnapAlign = "center";
                        document.documentElement.style.scrollBehavior = "smooth";
                    } else {
                        (entry.target as HTMLElement).style.scrollSnapAlign = "none";
                        document.documentElement.style.scrollBehavior = "auto";
                    }
                });
            },
            { threshold: 0.5 }
        );

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => {
            if (ref.current) {
                observer.unobserve(ref.current);
            }
            document.documentElement.style.scrollBehavior = "auto";
        };
    }, []);

    return (
        <section className="relative w-full bg-[#FAFAFA] dark:bg-black mt-0">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white to-white dark:via-black dark:to-black" />

            {/* Content container - with scroll-snap container */}
            <div
                className="h-screen w-full relative flex items-center justify-center overflow-hidden scroll-snap-type-y mandatory "
                ref={ref}
            >
                <GoogleGeminiEffect
                    pathLengths={[
                        pathLengthFirst,
                        pathLengthSecond,
                        pathLengthThird,
                        pathLengthFourth,
                        pathLengthFifth,
                    ]}
                    className="w-full max-w-screen-2xl mx-auto px-4 "
                />
            </div>

            {/* Bottom fade gradient */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white dark:from-black to-transparent z-10" />
        </section>
    );
}
