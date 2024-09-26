import React from "react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
} from "@/components/ui/navigation-menu";

export default function menu() {
  return (
    <>
      <NavigationMenu>
        {/* item: who we are */}
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger className="hover:text-blue-600">
              Who we are
            </NavigationMenuTrigger>
            <NavigationMenuContent className="bg-blue-300 rounded-br-lg rounded-bl-lg w-[40rem] flex items-center justify-center">
              <NavigationMenuLink>
                <ul className="flex items-center justify-center gap-5">
                  <li className="p-2">Item1</li>
                  <li className="p-2">Item2</li>
                  <li className="p-2">Item3</li>
                </ul>
              </NavigationMenuLink>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
        {/* item: What we do */}
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>What we do</NavigationMenuTrigger>
            <NavigationMenuContent className="bg-blue-300 rounded-br-lg rounded-bl-lg w-[30rem] h-[2rem] flex items-center justify-center">
              <NavigationMenuLink>
                <ul className="flex items-center justify-center gap-5">
                  <li className="p-2">Item1</li>
                  <li className="p-2">Item2</li>
                  <li className="p-2">Item3</li>
                </ul>
              </NavigationMenuLink>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
        {/* item: Media */}
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Media</NavigationMenuTrigger>
            <NavigationMenuContent className="bg-blue-300 rounded-br-lg rounded-bl-lg w-[40rem] flex items-center justify-center">
              <NavigationMenuLink>
                <ul className="flex items-center justify-center gap-5">
                  <li className="p-2">Item1</li>
                  <li className="p-2">Item2</li>
                  <li className="p-2">Item3</li>
                </ul>
              </NavigationMenuLink>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
        {/* item: Career */}
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Career</NavigationMenuTrigger>
            <NavigationMenuContent className="bg-blue-300 rounded-br-lg rounded-bl-lg w-[40rem] flex items-center justify-center">
              <NavigationMenuLink>
                <ul className="flex items-center justify-center gap-5">
                  <li className="p-2">Item1</li>
                  <li className="p-2">Item2</li>
                  <li className="p-2">Item3</li>
                </ul>
              </NavigationMenuLink>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </>
  );
}
