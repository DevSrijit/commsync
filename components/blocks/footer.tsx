"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

interface SocialLink {
  name: string;
  href: string;
}

interface FooterLink {
  name: string;
  Icon: LucideIcon | React.FC<React.SVGProps<SVGSVGElement>>;
  href?: string;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

interface FooterProps extends React.HTMLAttributes<HTMLDivElement> {
  brand: {
    name: string;
    description: string;
  };
  socialLinks: SocialLink[];
  columns: FooterColumn[];
  copyright?: string;
}

export const Footer = React.forwardRef<HTMLDivElement, FooterProps>(
  ({ className, brand, socialLinks, columns, copyright, ...props }, ref) => {
    const { setTheme, theme } = useTheme();

    return (
      <div
        ref={ref}
        className={cn("pt-24", className)}
        {...props}
      >
        <div className="px-4 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <div className="flex items-center justify-between lg:justify-start gap-4">
                <a href="#" className="text-xl font-semibold">
                  {brand.name}
                </a>
                
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className={cn(
                    "relative overflow-hidden rounded-full p-[1px]",
                    "bg-gradient-to-b from-neutral-200 to-neutral-100 dark:from-neutral-800 dark:to-neutral-900",
                    "transition-all duration-300",
                    "hover:from-neutral-300 hover:to-neutral-200 dark:hover:from-neutral-700 dark:hover:to-neutral-800",
                    "group"
                  )}
                >
                  <div className={cn(
                    "relative flex h-8 w-14 items-center rounded-full px-1",
                    "bg-white dark:bg-black",
                    "transition-colors duration-300"
                  )}>
                    <div className={cn(
                      "absolute h-6 w-6 rounded-full",
                      "bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900",
                      "shadow-lg backdrop-blur-md",
                      "transition-all duration-500",
                      "flex items-center justify-center",
                      theme === "dark" ? "translate-x-[1.55rem]" : "translate-x-0"
                    )}>
                      <Sun className={cn(
                        "h-3.5 w-3.5 rotate-0 scale-100 transition-all duration-300",
                        "stroke-neutral-600 dark:stroke-neutral-400",
                        theme === "dark" ? "rotate-90 scale-0" : "rotate-0 scale-100",
                      )} />
                      <Moon className={cn(
                        "absolute h-3.5 w-3.5 rotate-90 scale-0 transition-all duration-300",
                        "stroke-neutral-600 dark:stroke-neutral-400",
                        theme === "dark" ? "rotate-0 scale-100" : "rotate-90 scale-0",
                      )} />
                    </div>
                  </div>
                </button>
              </div>
              <p className="text-sm text-foreground/60 mt-2">
                {brand.description}
              </p>

              <p className="text-sm font-light text-foreground/55 mt-3.5">
                {socialLinks.map((link, index) => (
                  <React.Fragment key={link.name}>
                    <a
                      className="hover:text-foreground/90"
                      target="_blank"
                      href={link.href}
                      rel="noopener noreferrer"
                    >
                      {link.name}
                    </a>
                    {index < socialLinks.length - 1 && " • "}
                  </React.Fragment>
                ))}
              </p>
            </div>

            <div className="grid grid-cols-2 mt-16 md:grid-cols-3 lg:col-span-8 lg:justify-items-end lg:mt-0">
              {columns.map(({ title, links }) => (
                <div key={title} className="last:mt-12 md:last:mt-0">
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <ul className="mt-4 space-y-2.5">
                    {links.map(({ name, Icon, href }) => (
                      <li key={name}>
                        <a
                          href={href || "#"}
                          className="text-sm transition-all text-foreground/60 hover:text-foreground/90 group"
                        >
                          <Icon className="inline stroke-2 h-4 mr-1.5 transition-all stroke-foreground/60 group-hover:stroke-foreground/90" />
                          {name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {copyright && (
            <div className="mt-20 border-t pt-6 pb-8">
              <p className="text-xs text-foreground/55">{copyright}</p>
            </div>
          )}
        </div>
      </div>
    );
  }
);

Footer.displayName = "Footer";