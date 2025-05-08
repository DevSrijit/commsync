import { Book, Sunset, Trees, Zap } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { RainbowButton } from "@/components/magicui/rainbow-button";
import { JSX } from "react";

const data = {
    logo: {
        url: `${process.env.NEXT_PUBLIC_APP_URL}`,
        dark: "/branding/commsync_logotype_dark.svg",
        light: "/branding/commsync_logotype_light.svg",
        alt: "CommSync Logo",
        title: "CommSync",
    },
    menu: [
        {
            title: "Home",
            url: "/",
        },
        {
            title: "Products",
            url: "#",
            items: [
                {
                    title: "Blog",
                    description: "The latest industry news, updates, and info",
                    icon: <Book className="size-5 shrink-0" />,
                    url: "/blog",
                },
                {
                    title: "Company",
                    description: "Our mission is to innovate and empower the world",
                    icon: <Trees className="size-5 shrink-0" />,
                    url: "/company",
                },
                {
                    title: "Careers",
                    description: "Browse job listing and discover our workspace",
                    icon: <Sunset className="size-5 shrink-0" />,
                    url: "/careers",
                },
                {
                    title: "Support",
                    description:
                        "Get in touch with our support team or visit our community forums",
                    icon: <Zap className="size-5 shrink-0" />,
                    url: "/support",
                },
            ],
        },
        {
            title: "Resources",
            url: "#",
            items: [
                {
                    title: "Help Center",
                    description: "Get all the answers you need right here",
                    icon: <Zap className="size-5 shrink-0" />,
                    url: "/help",
                },
                {
                    title: "Contact Us",
                    description: "We are here to help you with any questions you have",
                    icon: <Sunset className="size-5 shrink-0" />,
                    url: "/contact",
                },
                {
                    title: "Status",
                    description: "Check the current status of our services and APIs",
                    icon: <Trees className="size-5 shrink-0" />,
                    url: "/status",
                },
                {
                    title: "Terms of Service",
                    description: "Our terms and conditions for using our services",
                    icon: <Book className="size-5 shrink-0" />,
                    url: "/terms",
                },
            ],
        },
        {
            title: "Pricing",
            url: "/pricing",
        },
        {
            title: "Blog",
            url: "/blog",
        },
    ],
    mobileExtraLinks: [
        { name: "Press", url: "/press" },
        { name: "Contact", url: "/contact" },
        { name: "Imprint", url: "/imprint" },
        { name: "Sitemap", url: "/sitemap" },
    ],
    auth: {
        signup: { text: "Get Started", url: "/login" },
    },
};

function Navbar() {
    const { theme, resolvedTheme } = useTheme();
    const [scrolled, setScrolled] = useState(false);
    const [mounted, setMounted] = useState(false);

    // After hydration, we can show the theme-dependent content
    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            const isScrolled = window.scrollY > 10;
            if (isScrolled !== scrolled) {
                setScrolled(isScrolled);
            }
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => {
            window.removeEventListener("scroll", handleScroll);
        };
    }, [scrolled]);

    // Use the resolvedTheme to handle system preference
    const currentTheme = resolvedTheme || theme;

    const navbarData = {
        ...data,
        logo: {
            ...data.logo,
            src: !mounted ? data.logo.light : currentTheme === "dark" ? data.logo.dark : data.logo.light,
        },
        scrolled
    };

    return <CustomNavbar {...navbarData} />;
}

interface MenuItem {
    title: string;
    url: string;
    description?: string;
    icon?: JSX.Element;
    items?: MenuItem[];
}

interface CustomNavbarProps {
    logo: {
        url: string;
        src: string;
        alt: string;
        title: string;
    };
    menu: MenuItem[];
    mobileExtraLinks: {
        name: string;
        url: string;
    }[];
    auth: {
        login?: {
            text: string;
            url: string;
        };
        signup: {
            text: string;
            url: string;
        };
    };
    scrolled: boolean;
}

const CustomNavbar = ({
    logo,
    menu,
    mobileExtraLinks,
    auth,
    scrolled,
}: CustomNavbarProps) => {
    return (
        <section className={`fixed top-0 left-0 right-0 py-3 z-50 w-full px-4 transition-all duration-300 ${scrolled ? 'bg-white/80 dark:bg-black/80 backdrop-blur-md shadow-sm' : 'bg-transparent'}`}>
            <div className="container mx-auto max-w-7xl">
                <nav className="hidden justify-between items-center lg:flex">
                    <div className="flex items-center gap-8">
                        <a href={logo.url} className="flex items-center gap-2">
                            <img src={logo.src} className="h-8" alt={logo.alt} />
                        </a>
                        <div className="flex items-center">
                            <NavigationMenu>
                                <NavigationMenuList>
                                    {menu.map((item) => renderMenuItem(item))}
                                </NavigationMenuList>
                            </NavigationMenu>
                        </div>
                    </div>
                    <div className="flex z-10">
                        <RainbowButton>
                            <a href={auth.signup.url} className="inline-flex items-center justify-center px-6 py-2 text-sm font-medium transition-all">
                                {auth.signup.text}
                            </a>
                        </RainbowButton>
                    </div>
                </nav>
                <div className="flex lg:hidden">
                    <div className="flex items-center justify-between w-full">
                        <a href={logo.url} className="flex items-center gap-2">
                            <img src={logo.src} className="h-6" alt={logo.alt} />
                        </a>
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="outline" size="icon" className="ml-auto">
                                    <Menu className="size-4" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent className="overflow-y-auto">
                                <SheetHeader>
                                    <SheetTitle>
                                        <a href={logo.url} className="flex items-center gap-2">
                                            <img src={logo.src} className="h-6" alt={logo.alt} />
                                        </a>
                                    </SheetTitle>
                                </SheetHeader>
                                <div className="my-6 flex flex-col gap-6">
                                    <Accordion
                                        type="single"
                                        collapsible
                                        className="flex w-full flex-col gap-4"
                                    >
                                        {menu.map((item) => renderMobileMenuItem(item))}
                                    </Accordion>
                                    <div className="border-t py-4">
                                        <div className="grid grid-cols-2 justify-start">
                                            {mobileExtraLinks.map((link, idx) => (
                                                <a
                                                    key={idx}
                                                    className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-accent-foreground"
                                                    href={link.url}
                                                >
                                                    {link.name}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        {auth.login && (
                                            <Button asChild variant="outline">
                                                <a href={auth.login.url}>{auth.login.text}</a>
                                            </Button>
                                        )}
                                        <RainbowButton className="w-full">
                                            <a href={auth.signup.url} className="w-full text-center">
                                                {auth.signup.text}
                                            </a>
                                        </RainbowButton>
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
            </div>
        </section>
    );
};

const renderMenuItem = (item: MenuItem) => {
    if (item.items) {
        return (
            <NavigationMenuItem key={item.title} className="text-muted-foreground">
                <NavigationMenuTrigger className="bg-transparent hover:bg-muted/50 data-[state=open]:bg-muted/50">
                    {item.title}
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                    <ul className="w-80 p-3">
                        <NavigationMenuLink>
                            {item.items.map((subItem) => (
                                <li key={subItem.title}>
                                    <a
                                        className="flex select-none gap-4 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-muted hover:text-accent-foreground"
                                        href={subItem.url}
                                    >
                                        {subItem.icon}
                                        <div>
                                            <div className="text-sm font-semibold">
                                                {subItem.title}
                                            </div>
                                            {subItem.description && (
                                                <p className="text-sm leading-snug text-muted-foreground">
                                                    {subItem.description}
                                                </p>
                                            )}
                                        </div>
                                    </a>
                                </li>
                            ))}
                        </NavigationMenuLink>
                    </ul>
                </NavigationMenuContent>
            </NavigationMenuItem>
        );
    }

    return (
        <a
            key={item.title}
            className="group inline-flex h-10 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-accent-foreground bg-transparent"
            href={item.url}
        >
            {item.title}
        </a>
    );
};

const renderMobileMenuItem = (item: MenuItem) => {
    if (item.items) {
        return (
            <AccordionItem key={item.title} value={item.title} className="border-b-0">
                <AccordionTrigger className="py-0 font-semibold hover:no-underline">
                    {item.title}
                </AccordionTrigger>
                <AccordionContent className="mt-2">
                    {item.items.map((subItem) => (
                        <a
                            key={subItem.title}
                            className="flex select-none gap-4 rounded-md p-3 leading-none outline-none transition-colors hover:bg-muted hover:text-accent-foreground"
                            href={subItem.url}
                        >
                            {subItem.icon}
                            <div>
                                <div className="text-sm font-semibold">{subItem.title}</div>
                                {subItem.description && (
                                    <p className="text-sm leading-snug text-muted-foreground">
                                        {subItem.description}
                                    </p>
                                )}
                            </div>
                        </a>
                    ))}
                </AccordionContent>
            </AccordionItem>
        );
    }

    return (
        <a key={item.title} href={item.url} className="font-semibold py-2 block">
            {item.title}
        </a>
    );
};

export { Navbar };
