"use client";

import {
  BookText,
  ChevronRight,
  Home,
  NotebookPen,
  Settings,
  Users,
  FileText,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
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
} from "@/components/ui/collapsible";
import Image from "next/image";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PERMISSIONS, type Permission } from "@/lib/permissions";

type NavSubItem = {
  title: string;
  url: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Permission required to see this item. If unset, item is always visible. */
  requires?: Permission;
};

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  requires?: Permission;
  items?: NavSubItem[];
};

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        url: "/",
        icon: Home,
        requires: PERMISSIONS.DASHBOARD_READ,
      },
      {
        title: "PV Register",
        url: "/pv-register",
        icon: BookText,
        requires: PERMISSIONS.PV_READ,
      },
    ],
  },
  {
    label: "Vouchers",
    items: [
      {
        title: "Create PV",
        url: "/create",
        icon: NotebookPen,
        requires: PERMISSIONS.PV_CREATE,
      },
    ],
  },
  {
    label: "Configure",
    items: [
      {
        title: "Settings",
        url: "#",
        icon: Settings,
        items: [
          {
            title: "Staff",
            url: "/settings/staff",
            icon: Users,
            requires: PERMISSIONS.STAFF_READ,
          },
          {
            title: "Roles",
            url: "/settings/roles",
            icon: ShieldCheck,
            requires: PERMISSIONS.ROLES_MANAGE,
          },
          {
            title: "Templates",
            url: "/settings/templates",
            icon: FileText,
          },
        ],
      },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;
  const userPermissions = session?.permissions ?? [];
  const initials = (user?.name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("") || "?";

  const isActive = (url: string) => {
    if (url === "/") return pathname === "/";
    return pathname === url || pathname.startsWith(url + "/");
  };

  const isParentActive = (item: NavItem) =>
    item.items?.some((sub) => isActive(sub.url)) ?? false;

  const hasPermission = (perm?: Permission) =>
    !perm || userPermissions.includes(perm);

  // Filter nav: hide items the user can't access. For collapsible parent
  // items (Settings), show the parent only if at least one child is visible.
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items
        .map((item) => {
          if (item.items) {
            const visibleSub = item.items.filter((sub) =>
              hasPermission(sub.requires),
            );
            if (visibleSub.length === 0) return null;
            return { ...item, items: visibleSub };
          }
          return hasPermission(item.requires) ? item : null;
        })
        .filter((item): item is NavItem => item !== null),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="border-b">
        <Link
          href="/"
          className="mx-2 my-2 flex items-center gap-3 rounded-md px-2 py-2 transition hover:bg-muted"
        >
          <div className="flex size-9 items-center justify-center rounded-md border bg-card">
            <Image
              src="/logo.png"
              className="size-6 object-contain"
              width={32}
              height={32}
              alt="Logo"
            />
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold tracking-tight">
              Arusheefee Bandeyri
            </span>
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Budget Portal
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-1 px-1 pt-3">
        {visibleGroups.map((group) => (
          <SidebarGroup key={group.label} className="px-2">
            <SidebarGroupLabel className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) =>
                  item.items ? (
                    <Collapsible
                      key={item.title}
                      asChild
                      defaultOpen={isParentActive(item)}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            tooltip={item.title}
                            className="h-9 gap-2.5 rounded-md text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground data-[state=open]:text-foreground"
                          >
                            <item.icon className="size-4" />
                            <span>{item.title}</span>
                            <ChevronRight className="ml-auto size-3.5 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub className="ml-3.5 mt-1 gap-0.5 border-l pl-3">
                            {item.items.map((subItem) => {
                              const active = isActive(subItem.url);
                              return (
                                <SidebarMenuSubItem key={subItem.title}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={active}
                                    className={`h-8 rounded-md text-[12.5px] font-medium transition ${
                                      active
                                        ? "bg-muted text-foreground"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    }`}
                                  >
                                    <Link
                                      href={subItem.url}
                                      className="flex items-center gap-2"
                                    >
                                      {subItem.icon && (
                                        <subItem.icon className="size-3.5" />
                                      )}
                                      <span>{subItem.title}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  ) : (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        tooltip={item.title}
                        asChild
                        isActive={isActive(item.url)}
                        className={`relative h-9 gap-2.5 rounded-md text-[13px] font-medium transition ${
                          isActive(item.url)
                            ? "bg-muted text-foreground before:absolute before:left-0 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-r-full before:bg-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <Link href={item.url}>
                          <item.icon className="size-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t">
        {user ? (
          <div className="flex items-center gap-2 px-3 py-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{user.name}</div>
              <div className="truncate text-[10px] text-muted-foreground">
                {user.email}
              </div>
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              aria-label="Sign out"
              title="Sign out"
              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-3 py-3">
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Not signed in
              </span>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
