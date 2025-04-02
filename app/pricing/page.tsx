"use client";

import * as React from "react";
import { Check, Star, Clock, ChevronDown } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EnterpriseDialog } from "@/components/enterprise-dialog";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { LoadingSpinner } from "@/components/loading-spinner";
import { OrganizationAccessKey } from "@/components/organization-access-key";

interface PricingPlan {
    name: string;
    price: string;
    period: string;
    features: string[];
    description: string;
    buttonText: string;
    plan: string | null;
    isPopular?: boolean;
    isEnterprise?: boolean;
    hasTrial?: boolean;
}

interface PricingSectionProps {
    plans: PricingPlan[];
    title?: string;
    description?: string;
}

function PricingSection({
    plans,
    title = "Choose Your Plan",
    description = "Scale your communication seamlessly\nPay only for what you need, upgrade or downgrade anytime.",
}: PricingSectionProps) {
    const [isLoading, setIsLoading] = useState<string | null>(null);
    const { toast } = useToast();

    const handleCheckout = async (plan: string) => {
        try {
            setIsLoading(plan);
            const response = await fetch("/api/create-checkout-session", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ plan }),
            });

            if (!response.ok) {
                throw new Error("Failed to create checkout session");
            }

            const { url } = await response.json();
            window.location.href = url;
        } catch (error) {
            console.error("Error during checkout:", error);
            toast({
                title: "Checkout Error",
                description: "There was an error processing your request. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(null);
        }
    };

    return (
        <div className="container max-w-7xl mx-auto py-12">
            <div className="text-center space-y-4 mb-16">
                <h2 className="text-4xl font-light tracking-tight sm:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-white dark:via-gray-300 dark:to-white">
                    {title}
                </h2>
                <p className="text-muted-foreground text-lg whitespace-pre-line font-light max-w-2xl mx-auto">
                    {description}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-start">
                {plans.map((plan, index) => (
                    <Card
                        key={index}
                        className={cn(
                            "relative border-[0.5px] bg-background/50 backdrop-blur-sm flex flex-col",
                            "hover:border-primary/50 transition-all duration-300 group",
                            "before:absolute before:inset-0 before:rounded-[inherit] before:bg-gradient-to-b before:from-transparent before:to-transparent before:opacity-0 before:transition-opacity hover:before:opacity-100 before:duration-500",
                            plan.isPopular ? "border-primary border-[0.5px] z-10 shadow-lg shadow-primary/10" : "border-border",
                        )}
                    >
                        {plan.isPopular && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary px-3 py-1 rounded-full">
                                <span className="text-primary-foreground text-xs font-medium">
                                    Most Popular
                                </span>
                            </div>
                        )}
                        <div className="p-6 flex-1 flex flex-col relative">
                            <div className="mb-5">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-base font-medium text-foreground/90">
                                        {plan.name}
                                    </h3>
                                    {plan.hasTrial && (
                                        <Badge variant="outline" className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/30">
                                            <Clock className="h-3 w-3 mr-1" />
                                            7-Day Trial
                                        </Badge>
                                    )}
                                </div>
                                <div className="mt-4 flex items-baseline">
                                    <span className="text-4xl font-light tracking-tight">
                                        ${plan.price}
                                    </span>
                                    <span className="text-sm font-light text-muted-foreground ml-2">
                                        / {plan.period}
                                    </span>
                                </div>
                            </div>

                            <ul className="mt-6 space-y-3 flex-1">
                                {plan.features.map((feature, idx) => (
                                    <li key={idx} className="flex items-start gap-2">
                                        <Check className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                                        <span className="text-left text-sm text-muted-foreground">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <div className="mt-8 pt-6 border-t border-border">
                                {plan.isEnterprise ? (
                                    <EnterpriseDialog>
                                        <Button
                                            variant={plan.isPopular ? "default" : "outline"}
                                            size="lg"
                                            className={cn(
                                                "w-full font-light tracking-wide transition-all duration-300",
                                                "hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/5",
                                                "relative overflow-hidden",
                                                "before:absolute before:inset-0 before:bg-[length:200%_100%] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
                                                "before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-500"
                                            )}
                                        >
                                            {plan.buttonText}
                                        </Button>
                                    </EnterpriseDialog>
                                ) : (
                                    <Button
                                        variant={plan.isPopular ? "default" : "outline"}
                                        size="lg"
                                        className={cn(
                                            "w-full font-light tracking-wide transition-all duration-300",
                                            "hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/5",
                                            "relative overflow-hidden",
                                            "before:absolute before:inset-0 before:bg-[length:200%_100%] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
                                            "before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-500"
                                        )}
                                        onClick={() => plan.plan && handleCheckout(plan.plan)}
                                        disabled={isLoading === plan.plan}
                                    >
                                        {isLoading === plan.plan ? "Loading..." : plan.buttonText}
                                    </Button>
                                )}
                                <p className="mt-4 text-xs text-muted-foreground text-center">
                                    {plan.description}
                                </p>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}

const pricingPlans = [
    {
        name: "LITE",
        price: "6",
        period: "month",
        features: [
            "1 User",
            "6 Connected Accounts",
            "100MB Storage Limit",
            "25 AI Credits Monthly",
            "Basic Support",
        ],
        hasTrial: true,
        description: "Perfect for individual users",
        buttonText: "Get Started",
        plan: "lite",
    },
    {
        name: "STANDARD",
        price: "15",
        period: "month",
        features: [
            "Up to 3 Users",
            "10 Connected Accounts/User",
            "500MB Storage Limit/User",
            "100 AI Credits Monthly/User",
            "Priority Support",
            "Team Collaboration",
        ],
        description: "Ideal for small teams",
        buttonText: "Start Free Trial",
        plan: "standard",
        isPopular: true,
        hasTrial: true,
    },
    {
        name: "BUSINESS",
        price: "25",
        period: "month",
        hasTrial: true,
        features: [
            "Up to 8 Users",
            "20 Connected Accounts/User",
            "1GB Storage Limit/User",
            "200 AI Credits Monthly/User",
            "24/7 Priority Support",
            "Advanced Analytics",
            "Custom Integrations",
        ],
        description: "Best for growing businesses",
        buttonText: "Get Business",
        plan: "business",
    },
    {
        name: "ENTERPRISE",
        price: "Custom",
        period: "month",
        features: [
            "Unlimited Users",
            "Custom Account Limits",
            "Custom Storage Limits",
            "Custom AI Credit Allocation",
            "Dedicated Support Manager",
            "Custom Contract Terms",
            "SLA Agreement",
            "Custom Security Controls",
        ],
        description: "For large organizations",
        buttonText: "Contact Sales",
        plan: null,
        isEnterprise: true,
    },
];

export default function PricingPage() {
    const [isScrolled, setIsScrolled] = useState(false);

    // Add scroll listener to hide the chevron when user has scrolled down
    React.useEffect(() => {
        const handleScroll = () => {
            // Check if user has scrolled down enough to see the access key section
            const scrollPosition = window.scrollY;
            const windowHeight = window.innerHeight;

            // Hide chevron after scrolling about halfway down the viewport
            setIsScrolled(scrollPosition > windowHeight * 0.3);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="bg-background/80 text-foreground min-h-screen relative overflow-hidden">
            {/* Gradient orbs for Nothing-inspired design */}
            <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none animate-pulse" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-primary/3 rounded-full blur-[120px] pointer-events-none animate-pulse" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/2 rounded-full blur-[130px] pointer-events-none" />

            <PricingSection plans={pricingPlans} />

            {/* Pulsing chevron indicator to scroll down */}
            <div className={cn(
                "relative z-10 left-1/2 transform -translate-x-1/2 flex flex-col items-center transition-opacity duration-500 mb-2",
                isScrolled ? "opacity-0 pointer-events-none" : "opacity-100"
            )}>
                <div className="text-xs text-muted-foreground mb-2">Scroll for more</div>
                <div className="animate-bounce-slow">
                    <ChevronDown className="h-6 w-6 text-primary animate-pulse" />
                </div>
            </div>

            <div className="container max-w-7xl mx-auto pb-20 pt-4" id="access-key-section">
                <div className="flex flex-col items-center">
                    <OrganizationAccessKey />
                </div>
            </div>
        </div>
    );
} 