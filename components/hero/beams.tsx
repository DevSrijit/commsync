"use client";

import React, { forwardRef, useRef } from "react";

import { cn } from "@/lib/utils";
import { AnimatedBeam } from "@/components/magicui/animated-beam";
import { SiGmail, SiWhatsapp, SiTwilio, SiDiscord, SiReddit, SiInstagram, SiGraphql } from "@icons-pack/react-simple-icons"
import { Users, MessageSquareText } from "lucide-react";

const Circle = forwardRef<
    HTMLDivElement,
    { className?: string; children?: React.ReactNode }
>(({ className, children }, ref) => {
    return (
        <div
            ref={ref}
            className={cn(
                "z-10 flex size-12 items-center justify-center rounded-full border-2 border-border bg-white p-3 shadow-[0_0_20px_-12px_rgba(0,0,0,0.8)]",
                className,
            )}
        >
            {children}
        </div>
    );
});

Circle.displayName = "Circle";

export default function AnimatedBeamMultipleOutputDemo({
    className,
}: {
    className?: string;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const div1Ref = useRef<HTMLDivElement>(null);
    const div2Ref = useRef<HTMLDivElement>(null);
    const div3Ref = useRef<HTMLDivElement>(null);
    const div4Ref = useRef<HTMLDivElement>(null);
    const div5Ref = useRef<HTMLDivElement>(null);
    const div6Ref = useRef<HTMLDivElement>(null);
    const div7Ref = useRef<HTMLDivElement>(null);

    return (
        <div
            className={cn(
                "relative flex h-[500px] w-full items-center justify-center overflow-hidden p-10",
                className,
            )}
            ref={containerRef}
        >
            <div className="flex size-full max-w-lg flex-row items-stretch justify-between gap-10">
                <div className="flex flex-col justify-center gap-2">
                    <Circle ref={div1Ref}>
                        <Icons.gmail />
                    </Circle>
                    <Circle ref={div2Ref}>
                        <Icons.whatsapp />
                    </Circle>
                    <Circle ref={div3Ref}>
                        <Icons.discord />
                    </Circle>
                    <Circle ref={div4Ref}>
                        <Icons.reddit />
                    </Circle>
                    <Circle ref={div5Ref}>
                        <Icons.instagram />
                    </Circle>
                </div>
                <div className="flex flex-col justify-center">
                    <Circle ref={div6Ref} className="size-16">
                        <Icons.message />
                    </Circle>
                </div>
                <div className="flex flex-col justify-center">
                    <Circle ref={div7Ref}>
                        <Icons.user />
                    </Circle>
                </div>
            </div>

            <AnimatedBeam
                containerRef={containerRef}
                fromRef={div1Ref}
                toRef={div6Ref}
                duration={Math.random() * 3 + 4}
            />
            <AnimatedBeam
                containerRef={containerRef}
                fromRef={div2Ref}
                toRef={div6Ref}
                duration={Math.random() * 3 + 4}

            />
            <AnimatedBeam
                containerRef={containerRef}
                fromRef={div3Ref}
                toRef={div6Ref}
                duration={Math.random() * 3 + 4}
            />
            <AnimatedBeam
                containerRef={containerRef}
                fromRef={div4Ref}
                toRef={div6Ref}
                duration={Math.random() * 3 + 4}
            />
            <AnimatedBeam
                containerRef={containerRef}
                fromRef={div5Ref}
                toRef={div6Ref}
                duration={Math.random() * 3 + 4}
            />
            <AnimatedBeam
                containerRef={containerRef}
                fromRef={div6Ref}
                toRef={div7Ref}
                duration={Math.random() * 3 + 4}
            />
        </div>
    );
}

const Icons = {
    gmail: () => (
        <SiGmail color={"black"}/>
    ),
    discord: () => (
        <SiDiscord color={"black"}/>
    ),
    reddit: () => (
        <SiReddit color={"black"}/>
    ),
    whatsapp: () => (
        <SiWhatsapp color={"black"}/>
    ),
    instagram: () => (
        <SiInstagram color={"black"}/>
    ),
    message: () => (
        <MessageSquareText color={"black"}/>
    ),
    user: () => (
        <Users size={24} color={"black"}/>
    ),
};