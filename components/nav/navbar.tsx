import React from "react";
import { Button } from "../ui/button";
import MenuTest from "@/components/nav/menuTest";
import { Avatar, AvatarFallback } from "../ui/avatar";

import { Search } from "lucide-react";
import { AvatarImage } from "@radix-ui/react-avatar";

export default function navbar() {
  return (
    <>
      {/* added shadow to differentiate the section */}
      <nav className="mt-4 shadow-md p-5">
        <div className="flex items-center justify-center sm:justify-center flex-wrap gap-5">
          <div>
            <Avatar>
              {/* <AvatarImage src="/public/logo.png" alt="the logo" /> */}
              <AvatarFallback>Logo</AvatarFallback>
            </Avatar>
          </div>
          {/* complex menu item */}
          <div>
            <MenuTest />
          </div>
          <div className="flex items-center justify-center flex-row gap-2">
            <Search />
            <Button className="rounded-full bg-[#012D61]">Contact</Button>
          </div>
        </div>
      </nav>
    </>
  );
}

// code that supposed to work...but idek why it doesnt work

// import React from "react";
// import { Button } from "../ui/button";
// import { Avatar, AvatarFallback } from "../ui/avatar";
// import { Search } from "lucide-react";
// import Link from "next/link";
// import {
//   NavigationMenu,
//   NavigationMenuContent,
//   NavigationMenuItem,
//   NavigationMenuLink,
//   NavigationMenuList,
//   NavigationMenuTrigger,
// } from "@/components/ui/navigation-menu";

// export default function Navbar() {
//   return (
//     <nav className="bg-white shadow-md">
//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//         <div className="flex justify-between h-16">
//           <div className="flex items-center">
//             <Avatar>
//               <AvatarFallback>Logo</AvatarFallback>
//             </Avatar>
//           </div>

//           <NavigationMenu className="hidden md:flex">
//             <NavigationMenuList className="flex space-x-4">
//               <NavItem
//                 trigger="WHO WE ARE"
//                 items={[
//                   { title: "ABOUT", href: "/about" },
//                   { title: "LEADERSHIP", href: "/leadership" },
//                   { title: "LOCATION", href: "/location" },
//                 ]}
//               />
//               <NavItem
//                 trigger="WHAT WE DO"
//                 items={[
//                   { title: "Service 1", href: "/" },
//                   { title: "Service 2", href: "/" },
//                   { title: "Service 3", href: "/" },
//                 ]}
//               />
//               <NavItem
//                 trigger="MEDIA"
//                 items={[
//                   { title: "Instagram", href: "/instagram" },
//                   { title: "Meta", href: "/meta" },
//                   { title: "Twitter", href: "/twitter" },
//                 ]}
//               />
//               <NavigationMenuItem>
//                 <Link href="/careers" legacyBehavior passHref>
//                   <NavigationMenuLink className="text-sm font-medium text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md">
//                     CAREERS
//                   </NavigationMenuLink>
//                 </Link>
//               </NavigationMenuItem>
//             </NavigationMenuList>
//           </NavigationMenu>

//           <div className="flex items-center">
//             <Search className="h-5 w-5 text-gray-400 mr-4" />
//             <Button className="rounded-full bg-[#012D61]">CONTACT</Button>
//           </div>
//         </div>
//       </div>
//     </nav>
//   );
// }

// function NavItem({ trigger, items }) {
//   return (
//     <NavigationMenuItem>
//       <NavigationMenuTrigger className="text-sm font-medium text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md">
//         {trigger}
//       </NavigationMenuTrigger>
//       <NavigationMenuContent>
//         <div className="absolute left-0 right-0 mt-2 bg-gray-100 shadow-lg">
//           <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
//             <ul className="grid grid-cols-3 gap-4">
//               {items.map((item) => (
//                 <li key={item.title}>
//                   <Link
//                     href={item.href}
//                     className="text-sm font-medium text-gray-700 hover:text-blue-600"
//                   >
//                     {item.title}
//                   </Link>
//                 </li>
//               ))}
//             </ul>
//           </div>
//         </div>
//       </NavigationMenuContent>
//     </NavigationMenuItem>
//   );
// }
