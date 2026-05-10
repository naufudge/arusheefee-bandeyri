/**
 * RBAC permission catalog.
 *
 * Permissions are app-defined (here), assigned to user-defined Roles via
 * the Settings UI. The strings here are the only valid keys for a Role's
 * `permissions` array — code only enforces what's in this file.
 *
 * Naming convention: `category:action`.
 *
 * To add a permission:
 *   1. Add it to PERMISSIONS below
 *   2. Add it to the appropriate group in PERMISSION_GROUPS
 *   3. Add `requirePermission(session, "...")` calls at the gating points
 */

import { TRPCError } from "@trpc/server";
import type { Session } from "next-auth";

export const PERMISSIONS = {
  DASHBOARD_READ: "dashboard:read",

  PV_READ: "pv:read",
  PV_CREATE: "pv:create",
  PV_UPDATE: "pv:update",
  PV_DELETE: "pv:delete",
  PV_EXPORT: "pv:export",
  PV_IMPORT: "pv:import",

  STAFF_READ: "staff:read",
  STAFF_CREATE: "staff:create",
  STAFF_UPDATE: "staff:update",
  STAFF_DELETE: "staff:delete",
  STAFF_SYNC: "staff:sync",

  ROLES_MANAGE: "roles:manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Every defined permission, useful for "grant all" (e.g. Administrator role seed). */
export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS);

/** Type guard — useful when validating user-supplied permission strings. */
export function isValidPermission(value: string): value is Permission {
  return ALL_PERMISSIONS.includes(value as Permission);
}

/**
 * UI grouping for the role-edit dialog. Each group renders as a section
 * with a header; permissions inside are checkboxes.
 */
export const PERMISSION_GROUPS: {
  label: string;
  permissions: { key: Permission; label: string; description: string }[];
}[] = [
  {
    label: "Dashboard",
    permissions: [
      {
        key: PERMISSIONS.DASHBOARD_READ,
        label: "View dashboard",
        description: "See the home page with KPIs and recent vouchers.",
      },
    ],
  },
  {
    label: "Payment Vouchers",
    permissions: [
      {
        key: PERMISSIONS.PV_READ,
        label: "View vouchers",
        description: "Browse the PV register and view individual vouchers.",
      },
      {
        key: PERMISSIONS.PV_CREATE,
        label: "Create voucher",
        description: "Add a new payment voucher.",
      },
      {
        key: PERMISSIONS.PV_UPDATE,
        label: "Edit voucher",
        description: "Modify an existing voucher's details.",
      },
      {
        key: PERMISSIONS.PV_DELETE,
        label: "Delete voucher",
        description: "Remove a voucher permanently.",
      },
      {
        key: PERMISSIONS.PV_EXPORT,
        label: "Export Excel",
        description: "Download the PV register as a .xlsx file.",
      },
      {
        key: PERMISSIONS.PV_IMPORT,
        label: "Import Excel",
        description: "Bulk-load vouchers from a .xlsx file.",
      },
    ],
  },
  {
    label: "Staff",
    permissions: [
      {
        key: PERMISSIONS.STAFF_READ,
        label: "View staff",
        description: "See the staff list in Settings.",
      },
      {
        key: PERMISSIONS.STAFF_CREATE,
        label: "Add staff",
        description: "Add a new staff member manually.",
      },
      {
        key: PERMISSIONS.STAFF_UPDATE,
        label: "Edit staff",
        description: "Change a staff member's name, designation, or roles.",
      },
      {
        key: PERMISSIONS.STAFF_DELETE,
        label: "Delete staff",
        description: "Remove a staff member from the register.",
      },
      {
        key: PERMISSIONS.STAFF_SYNC,
        label: "Sync from tenant",
        description: "Pull staff from the Microsoft tenant directory.",
      },
    ],
  },
  {
    label: "Roles & Permissions",
    permissions: [
      {
        key: PERMISSIONS.ROLES_MANAGE,
        label: "Manage roles",
        description:
          "Create, edit, and delete roles, and assign them to staff.",
      },
    ],
  },
];

// ---------- Helpers ----------

/** True if the session has the given permission. False for unauthenticated. */
export function hasPermission(
  session: Session | null | undefined,
  permission: Permission,
): boolean {
  return session?.permissions?.includes(permission) ?? false;
}

/** True if the session has any of the given permissions. */
export function hasAnyPermission(
  session: Session | null | undefined,
  permissions: readonly Permission[],
): boolean {
  if (!session?.permissions) return false;
  return permissions.some((p) => session.permissions?.includes(p));
}

/**
 * Throws TRPCError(FORBIDDEN) if the session lacks the permission.
 * Use inside tRPC procedures (and any server-side handler that catches
 * TRPCError → HTTP). For raw API routes prefer `assertPermission` which
 * throws a regular Error.
 */
export function requirePermission(
  session: Session | null | undefined,
  permission: Permission,
): void {
  if (!session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (!hasPermission(session, permission)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Missing permission: ${permission}`,
    });
  }
}
