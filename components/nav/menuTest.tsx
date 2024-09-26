"use client";

// inspired by the Japanese way of doing stuff

import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
// import { Icons } from "@/components/icons";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

// this is for what we do:
const components: { title: string; href: string; description: string }[] = [
  {
    title: "Not Scam you",
    href: "/",
    description: "We wont scam you, all allegations are false",
  },
  {
    title: "take your money",
    href: "/",
    description:
      "wait, why do we want to take your money? you give us your money 😂😂😂",
  },
  {
    title: "hire people we like",
    href: "/",
    description:
      "if you reading this and arent hired, we dont like you enough.",
  },
];

export default function NavigationMenuDemo() {
  return (
    <NavigationMenu>
      {/* hardcoded stuff stuff for who we are: */}
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger className="hover:text-blue-600">
            Who we are
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
              {/* Note: something to play around with later */}
              {/* <li className="row-span-3">
                <NavigationMenuLink asChild>
                  <a
                    className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                    href="/"
                  >
                    <Icons.logo className="h-6 w-6" />
                    <div className="mb-2 mt-4 text-lg font-medium">
                      big card
                    </div>
                    <p className="text-sm leading-tight text-muted-foreground">
                      info
                    </p>
                  </a>
                </NavigationMenuLink>
              </li> */}
              <ListItem href="/about" title="About">
                Who we are, what we do and our services
              </ListItem>
              <ListItem href="/leadership" title="Leadership">
                great organisations have great leaders, take a look at our
                leaders who make our amazing services a everyday reality
              </ListItem>
              <ListItem href="/location" title="location">
                Want to find us? lets meet in person!
              </ListItem>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger className="hover:text-blue-600">
            What we do
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px] text-sm font-medium text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md ">
              {components.map((component) => (
                <ListItem
                  key={component.title}
                  title={component.title}
                  href={component.href}
                >
                  {component.description}
                </ListItem>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          {/* Media */}
          <NavigationMenuTrigger className="hover:text-blue-600">
            Media
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
              <ListItem href="/Instagram" title="Instagram">
                We like Instagram
              </ListItem>
              <ListItem href="/Meta" title="Meta">
                We like facebook too (cuz old people like it)
              </ListItem>
              <ListItem href="/twitter" title="twitter">
                dear lord, dont pick a fight with us
              </ListItem>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem className="hover:text-blue-600">
          <Link href="/career" legacyBehavior passHref>
            <NavigationMenuLink className={navigationMenuTriggerStyle()}>
              Careers
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

const ListItem = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a">
>(({ className, title, children, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          ref={ref}
          className={cn(
            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            className
          )}
          {...props}
        >
          <div className="text-sm font-medium leading-none">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </a>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";
