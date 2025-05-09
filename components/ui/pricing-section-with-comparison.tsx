import { Check, Minus, MoveRight, PhoneCall } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STRIPE_PLANS } from "@/lib/stripe";

function Pricing() {
  return (
    <div className="w-full py-20 lg:py-40 bg-[#FAFAFA] dark:bg-black">
      <div className="container mx-auto">
        <div className="flex text-center justify-center items-center gap-4 flex-col">
          <Badge>Pricing</Badge>
          <div className="flex gap-2 flex-col">
            <h2 className="text-3xl md:text-5xl tracking-tighter max-w-xl text-center font-regular bg-gradient-to-r from-purple-600 to-pink-500 dark:from-purple-300 dark:to-orange-200">
              Pricing that makes sense
            </h2>
            <p className="text-lg leading-relaxed tracking-tight text-muted-foreground max-w-xl text-center">
              Streamline your business communications with CommSync's flexible plans
            </p>
          </div>
          <div className="grid text-left w-full grid-cols-4 lg:grid-cols-5 divide-x pt-20">
            <div className="col-span-4 lg:col-span-1"></div>
            <div className="px-3 py-1 md:px-6 md:py-4 gap-2 flex flex-col">
              <p className="text-2xl">{STRIPE_PLANS.lite.name}</p>
              <p className="text-sm text-muted-foreground">
                Perfect for individuals looking to centralize their communications
              </p>
              <p className="flex flex-col lg:flex-row lg:items-center gap-2 text-xl mt-8">
                <span className="text-4xl">$6</span>
                <span className="text-sm text-muted-foreground"> / month</span>
              </p>
              <Button variant="outline" className="gap-4 mt-8" onClick={() => window.open("/login", "_self")}>
                Get started <MoveRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 gap-2 flex flex-col">
              <p className="text-2xl">{STRIPE_PLANS.standard.name}</p>
              <p className="text-sm text-muted-foreground">
                For small teams that need more storage and connections
              </p>
              <p className="flex flex-col lg:flex-row lg:items-center gap-2 text-xl mt-8">
                <span className="text-4xl">$15</span>
                <span className="text-sm text-muted-foreground"> / month</span>
              </p>
              <Button className="gap-4 mt-8" onClick={() => window.open("/login", "_self")}>
                Try it now <MoveRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 gap-2 flex flex-col">
              <p className="text-2xl">{STRIPE_PLANS.business.name}</p>
              <p className="text-sm text-muted-foreground">
                For larger teams with advanced communication needs
              </p>
              <p className="flex flex-col lg:flex-row lg:items-center gap-2 text-xl mt-8">
                <span className="text-4xl">$25</span>
                <span className="text-sm text-muted-foreground"> / month</span>
              </p>
              <Button variant="outline" className="gap-4 mt-8" onClick={() => window.open("/login", "_self")}>
                Get started <MoveRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 gap-2 flex flex-col">
              <p className="text-2xl">Enterprise</p>
              <p className="text-sm text-muted-foreground">
                Tailored solutions for large organizations with complex communication needs
              </p>
              <p className="flex flex-col lg:flex-row lg:items-center gap-2 text-xl mt-8">
                <span className="text-4xl">Custom</span>
                <span className="text-sm text-muted-foreground"> pricing</span>
              </p>
              <Button variant="outline" className="gap-4 mt-8" onClick={() => window.open("/login", "_self")}>
                Contact us <PhoneCall className="w-4 h-4" />
              </Button>
            </div>
            <div className="px-3 lg:px-6 col-span-4 lg:col-span-1 py-4">
              <b>Features</b>
            </div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div className="px-3 lg:px-6 col-span-4 lg:col-span-1 py-4">Users</div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <p className="text-muted-foreground text-sm">{STRIPE_PLANS.lite.limits.maxUsers}</p>
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <p className="text-muted-foreground text-sm">{STRIPE_PLANS.standard.limits.maxUsers}</p>
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <p className="text-muted-foreground text-sm">{STRIPE_PLANS.business.limits.maxUsers}</p>
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <p className="text-muted-foreground text-sm">Custom</p>
            </div>
            <div className="px-3 lg:px-6 col-span-4 lg:col-span-1 py-4">
              Storage
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <p className="text-muted-foreground text-sm">{STRIPE_PLANS.lite.limits.maxStorage} MB</p>
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <p className="text-muted-foreground text-sm">{STRIPE_PLANS.standard.limits.maxStorage} MB</p>
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <p className="text-muted-foreground text-sm">{STRIPE_PLANS.business.limits.maxStorage} MB</p>
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <p className="text-muted-foreground text-sm">Custom</p>
            </div>
            <div className="px-3 lg:px-6 col-span-4 lg:col-span-1 py-4">
              Connections
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <p className="text-muted-foreground text-sm">{STRIPE_PLANS.lite.limits.maxConnections}</p>
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <p className="text-muted-foreground text-sm">{STRIPE_PLANS.standard.limits.maxConnections}</p>
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <p className="text-muted-foreground text-sm">{STRIPE_PLANS.business.limits.maxConnections}</p>
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <p className="text-muted-foreground text-sm">Custom</p>
            </div>
            <div className="px-3 lg:px-6 col-span-4 lg:col-span-1 py-4">
              AI Credits
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <p className="text-muted-foreground text-sm">{STRIPE_PLANS.lite.limits.totalAiCredits}</p>
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <p className="text-muted-foreground text-sm">{STRIPE_PLANS.standard.limits.totalAiCredits}</p>
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <p className="text-muted-foreground text-sm">{STRIPE_PLANS.business.limits.totalAiCredits}</p>
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <p className="text-muted-foreground text-sm">Custom</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Pricing };
