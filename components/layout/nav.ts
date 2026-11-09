import type React from "react";
import {
  BookText,
  ListTree,
  Home,
  Inbox,
  NotebookPen,
  Settings,
  Users,
  FileText,
  ShieldCheck,
  Wallet,
  Coins,
  Package,
  PackagePlus,
  ClipboardList,
  FilePlus,
  ClipboardCheck,
  FilePlus2,
  Scale,
  ShoppingBag,
  SlidersHorizontal,
  FileStack,
  Landmark,
} from "lucide-react";
import { PERMISSIONS, type Permission } from "@/lib/permissions";

// The app's pages, shared by the sidebar and the global search's "Go to".

export type NavSubItem = {
  title: string;
  url: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Permission required to see this item. If unset, item is always visible. */
  requires?: Permission;
};

export type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  requires?: Permission;
  /** Visible when the user holds any one of these (instead of `requires`). */
  requiresAny?: Permission[];
  items?: NavSubItem[];
  /**
   * Renders a numeric badge in the row driven by a tRPC query. Kept as
   * a discriminator (not a number) so the sidebar doesn't fetch
   * unrelated data unconditionally — each badge owns its own query.
   */
  badge?: "pending-approvals";
};

export type NavGroup = { label: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
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
        title: "Pending Approvals",
        url: "/pending-approvals",
        icon: Inbox,
        // Same gate as the page itself (/pending-approvals/page.tsx).
        requiresAny: [
          PERMISSIONS.PV_READ,
          PERMISSIONS.PETTYCASH_READ,
          PERMISSIONS.PRICEEVAL_READ,
          PERMISSIONS.ASSETCREATION_READ,
          PERMISSIONS.GSR_READ,
          PERMISSIONS.PCRECON_READ,
        ],
        badge: "pending-approvals",
      },
    ],
  },
  {
    label: "Vouchers",
    items: [
      {
        title: "PV Register",
        url: "/pv-register",
        icon: BookText,
        requires: PERMISSIONS.PV_READ,
      },
      {
        title: "Create PV",
        url: "/create",
        icon: NotebookPen,
        requires: PERMISSIONS.PV_CREATE,
      },
    ],
  },
  {
    label: "Petty Cash",
    items: [
      {
        title: "Petty Cash Register",
        url: "/petty-cash-register",
        icon: Wallet,
        requires: PERMISSIONS.PETTYCASH_READ,
      },
      {
        title: "Create Petty Cash",
        url: "/petty-cash/create",
        icon: Coins,
        requires: PERMISSIONS.PETTYCASH_CREATE,
      },
      {
        title: "Reconciliation Register",
        url: "/pc-reconciliation-register",
        icon: ClipboardCheck,
        requires: PERMISSIONS.PCRECON_READ,
      },
      {
        title: "Create Reconciliation",
        url: "/pc-reconciliation/create",
        icon: FilePlus2,
        requires: PERMISSIONS.PCRECON_CREATE,
      },
    ],
  },
  {
    label: "Assets",
    items: [
      {
        title: "Asset Register",
        url: "/asset-register",
        icon: Package,
        requires: PERMISSIONS.ASSET_READ,
      },
      {
        title: "Create Asset",
        url: "/asset/create",
        icon: PackagePlus,
        requires: PERMISSIONS.ASSET_CREATE,
      },
    ],
  },
  {
    label: "GSR Forms",
    items: [
      {
        title: "GSR Register",
        url: "/gsr-register",
        icon: ClipboardList,
        requires: PERMISSIONS.GSR_READ,
      },
      {
        title: "Create GSR",
        url: "/gsr/create",
        icon: FilePlus,
        requires: PERMISSIONS.GSR_CREATE,
      },
    ],
  },
  {
    label: "Procurement",
    items: [
      {
        title: "Procurements",
        url: "/procurement-register",
        icon: ShoppingBag,
        requires: PERMISSIONS.PROCUREMENT_READ,
      },
      {
        title: "Price Evaluations",
        url: "/price-evaluation-register",
        icon: Scale,
        requires: PERMISSIONS.PRICEEVAL_READ,
      },
      {
        title: "Asset Creation Forms",
        url: "/asset-creation-register",
        icon: FileStack,
        requires: PERMISSIONS.ASSETCREATION_READ,
      },
      {
        title: "CEA Forms",
        url: "/cea-register",
        icon: Landmark,
        requires: PERMISSIONS.CEA_READ,
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
            requires: PERMISSIONS.PV_CREATE,
          },
          {
            title: "GL Accounts",
            url: "/settings/gl-accounts",
            icon: ListTree,
            requires: PERMISSIONS.GLACCOUNT_READ,
          },
          {
            title: "General",
            url: "/settings/general",
            icon: SlidersHorizontal,
            requires: PERMISSIONS.SETTINGS_MANAGE,
          },
        ],
      },
    ],
  },
];

/**
 * The nav the user may see: items they lack permission for are dropped, a
 * collapsible parent (Settings) shows only if a child is visible, and empty
 * groups go.
 */
export function visibleNavGroups(userPermissions: readonly string[]): NavGroup[] {
  const allowed = (perm?: Permission) => !perm || userPermissions.includes(perm);
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items
        .map((item) => {
          if (item.items) {
            const visibleSub = item.items.filter((sub) => allowed(sub.requires));
            if (visibleSub.length === 0) return null;
            return { ...item, items: visibleSub };
          }
          if (item.requiresAny) {
            return item.requiresAny.some((p) => userPermissions.includes(p))
              ? item
              : null;
          }
          return allowed(item.requires) ? item : null;
        })
        .filter((item): item is NavItem => item !== null),
    }))
    .filter((group) => group.items.length > 0);
}
