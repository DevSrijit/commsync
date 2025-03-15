import { Check, Minus, MoveRight, PhoneCall } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function Pricing() {
  return (
    <div className="w-full py-20 lg:py-40">
      <div className="container mx-auto">
        <div className="flex text-center justify-center items-center gap-4 flex-col">
          <Badge>Pricing</Badge>
          <div className="flex gap-2 flex-col  text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500 dark:from-purple-300 dark:to-orange-200">
            <h2 className="text-3xl md:text-5xl tracking-tighter max-w-xl text-center font-regular">
              Sync your communications effortlessly
            </h2>
            <p className="text-lg leading-relaxed tracking-tight text-muted-foreground max-w-xl text-center">
              Streamline your business communications with CommSync's flexible plans
            </p>
          </div>
          <div className="grid text-left w-full grid-cols-3 lg:grid-cols-4 divide-x pt-20">
            <div className="col-span-3 lg:col-span-1"></div>
            <div className="px-3 py-1 md:px-6 md:py-4  gap-2 flex flex-col">
              <p className="text-2xl">Basic</p>
              <p className="text-sm text-muted-foreground">
                Perfect for small businesses just starting to centralize their communications
              </p>
              <p className="flex flex-col lg:flex-row lg:items-center gap-2 text-xl mt-8">
                <span className="text-4xl">$29</span>
                <span className="text-sm text-muted-foreground"> / month</span>
              </p>
              <Button variant="outline" className="gap-4 mt-8" onClick={() => window.open("/login", "_self")}>
                Get started <MoveRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 gap-2 flex flex-col">
              <p className="text-2xl">Pro</p>
              <p className="text-sm text-muted-foreground">
                For growing businesses that need advanced features and integrations
              </p>
              <p className="flex flex-col lg:flex-row lg:items-center gap-2 text-xl mt-8">
                <span className="text-4xl">$79</span>
                <span className="text-sm text-muted-foreground"> / month</span>
              </p>
              <Button className="gap-4 mt-8" onClick={() => window.open("/login", "_self")}>
                Try it now <MoveRight className="w-4 h-4" />
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
            <div className="px-3 lg:px-6 col-span-3 lg:col-span-1  py-4">
              <b>Features</b>
            </div>
            <div></div>
            <div></div>
            <div></div>
            <div className="px-3 lg:px-6 col-span-3 lg:col-span-1 py-4">Unified Inbox</div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <Check className="w-4 h-4 text-primary" />
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <Check className="w-4 h-4 text-primary" />
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <Check className="w-4 h-4 text-primary" />
            </div>
            <div className="px-3 lg:px-6 col-span-3 lg:col-span-1 py-4">
              AI-Powered Insights
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <Minus className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <Check className="w-4 h-4 text-primary" />
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <Check className="w-4 h-4 text-primary" />
            </div>
            <div className="px-3 lg:px-6 col-span-3 lg:col-span-1 py-4">
              Multi-Platform Integration
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <p className="text-muted-foreground text-sm">3 platforms</p>
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <p className="text-muted-foreground text-sm">10 platforms</p>
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <p className="text-muted-foreground text-sm">Unlimited</p>
            </div>
            <div className="px-3 lg:px-6 col-span-3 lg:col-span-1 py-4">
              Instant Support
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <Minus className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <Check className="w-4 h-4 text-primary" />
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <Check className="w-4 h-4 text-primary" />
            </div>
            {/* <div className="px-3 lg:px-6 col-span-3 lg:col-span-1 py-4">
              Advanced Analytics
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <Minus className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <Check className="w-4 h-4 text-primary" />
            </div>
            <div className="px-3 py-1 md:px-6 md:py-4 flex justify-center">
              <Check className="w-4 h-4 text-primary" />
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
}

export { Pricing };
