"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loading-spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  LayoutGrid,
  MessageSquare,
  Users,
  Calendar,
  Settings,
  Bell,
  BarChart3,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle,
} from "@/components/ui/resizable";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  href: string;
  active?: boolean;
  onClick?: () => void;
}

function NavItem({ icon, label, href, active, onClick }: NavItemProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push(href);
    if (onClick) onClick();
  };

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={active ? "secondary" : "ghost"}
            size="icon"
            className={cn(
              "h-12 w-12 my-1",
              active && "bg-secondary text-secondary-foreground"
            )}
            onClick={handleClick}
          >
            {icon}
            <span className="sr-only">{label}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-normal">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  isLoading?: boolean;
}

export function DashboardLayout({ children, isLoading }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarSize, setSidebarSize] = useState(15);

  const navItems = [
    { icon: <LayoutGrid size={20} />, label: "Dashboard", href: "/dashboard" },
    { icon: <MessageSquare size={20} />, label: "Messages", href: "/messages" },
    { icon: <Users size={20} />, label: "Contacts", href: "/contacts" },
    { icon: <Calendar size={20} />, label: "Calendar", href: "/calendar" },
    { icon: <BarChart3 size={20} />, label: "Analytics", href: "/analytics" },
    { icon: <Settings size={20} />, label: "Settings", href: "/settings" },
  ];

  return (
    <div className="h-screen overflow-hidden bg-background">
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
        >
          {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
        </Button>
      </div>

      <ResizablePanelGroup direction="horizontal" className="min-h-screen">
        <ResizablePanel
          defaultSize={sidebarSize}
          minSize={10}
          maxSize={20}
          className={cn(
            "bg-card border-r border-border transition-all duration-300 ease-in-out",
            !mobileNavOpen && "hidden lg:block",
            mobileNavOpen &&
              "fixed inset-y-0 left-0 z-40 w-64 lg:relative lg:w-auto"
          )}
          onResize={setSidebarSize}
        >
          <div className="flex flex-col items-center h-full py-4">
            <div className="mb-6 mt-2">
              <Avatar className="h-10 w-10">
                <AvatarImage src="/logo.png" alt="CommSync" />
                <AvatarFallback>CS</AvatarFallback>
              </Avatar>
            </div>

            <ScrollArea className="flex-1 w-full">
              <div className="flex flex-col items-center px-2">
                {navItems.map((item) => (
                  <NavItem
                    key={item.href}
                    icon={item.icon}
                    label={item.label}
                    href={item.href}
                    active={pathname === item.href}
                    onClick={() => setMobileNavOpen(false)}
                  />
                ))}
              </div>
            </ScrollArea>

            <div className="mt-auto flex flex-col items-center gap-2 px-2 pb-2">
              <NavItem
                icon={<Bell size={20} />}
                label="Notifications"
                href="/notifications"
                active={pathname === "/notifications"}
                onClick={() => setMobileNavOpen(false)}
              />
              <NavItem
                icon={<LogOut size={20} />}
                label="Logout"
                href="/logout"
                onClick={() => {
                  setMobileNavOpen(false);
                  // Handle logout logic
                }}
              />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle
          withHandle
          className="w-1.5 bg-border hover:bg-primary/20 transition-colors"
        />

        <ResizablePanel
          defaultSize={100 - sidebarSize}
          minSize={50}
          className="bg-background"
        >
          <div className="relative h-full">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
                <div className="text-center">
                  <LoadingSpinner size={40} className="mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading...</p>
                </div>
              </div>
            ) : (
              children
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
