import {
  BookText,
  ChevronRight,
  Home,
  NotebookPen,
  Settings,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"  
import Image from "next/image";
import React from "react";
import Link from "next/link";

// Menu items.
const items = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "PV Register",
    url: "/pv-register",
    icon: BookText,
  },
  {
    title: "Create PV",
    url: "/create",
    icon: NotebookPen,
  },
  {
    title: "Settings",
    url: "#",
    icon: Settings,
    items: [
      { title: "Manage Staff", url: "/settings/staff" },
      { title: "Templates", url: "/settings/templates" },
    ],
  },
];

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarContent>
        <div className="mx-4 mt-6 mb-2 flex gap-2 place-items-center">
          <Image
            src={"/logo.png"}
            className={`w-9 h-fit justify-center`}
            width={50}
            height={50}
            alt="Logo"
          />
          <h1 className="text-sm font-semibold">Arusheefee Bandeyri</h1>
        </div>
        <SidebarGroup>
          {/* <SidebarGroupLabel>
            Arusheefee Bandeyri
          </SidebarGroupLabel> */}
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {items.map((item) => (
                <div key={item.title}>
                  {item.items ? (
                    <Collapsible
                      key={item.title}
                      asChild
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton tooltip={item.title}>
                            {item.icon && <item.icon />}
                            <span>{item.title}</span>
                            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub className="gap-2 mt-2">
                            {item.items?.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton asChild>
                                  <Link
                                    href={subItem.url}
                                    className="text-[0.79rem]"
                                  >
                                    <span>{subItem.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  ) : (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton tooltip={item.title} asChild>
                        <a href={item.url}>
                          {item.icon && <item.icon />}
                          <span>{item.title}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </div>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
