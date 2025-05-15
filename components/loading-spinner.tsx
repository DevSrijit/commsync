"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

interface LoadingSpinnerProps {
    size?: number;
    className?: string;
    variant?: "default" | "primary" | "secondary" | "muted";
}

export function LoadingSpinner({
    size = 24,
    className,
    variant = "default"
}: LoadingSpinnerProps) {
    const { theme } = useTheme();
    const isDark = theme === "dark";

    const variantStyles = {
        default: "text-foreground",
        primary: "text-primary",
        secondary: "text-secondary-foreground",
        muted: "text-muted-foreground"
    };

    return (
        <div className="inline-flex items-center justify-center">
            <Loader2
                className={cn(
                    "animate-spin",
                    variantStyles[variant],
                    isDark ? "opacity-90" : "opacity-75",
                    className
                )}
                size={size}
                strokeWidth={2.5}
            />
        </div>
    );
}
