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
  // Post an APPROVED PV (terminal POSTED state). Holders can post any
  // approved voucher; posting requires the actor to have a signature on
  // file (it's stamped onto the PDF).
  PV_POST: "pv:post",
  // Override: edit a PV after it has left DRAFT (sent for verification or
  // further along the workflow). Holders bypass the lock that normally
  // shuts down `pv.update` once `status !== DRAFT`. `pv:update` is still
  // required — this is additive, not a replacement.
  PV_EDIT_LOCKED: "pv:edit_locked",

  PETTYCASH_READ: "pettycash:read",
  PETTYCASH_CREATE: "pettycash:create",
  PETTYCASH_UPDATE: "pettycash:update",
  PETTYCASH_DELETE: "pettycash:delete",
  PETTYCASH_EXPORT: "pettycash:export",
  PETTYCASH_IMPORT: "pettycash:import",
  PETTYCASH_EDIT_PARKED_DATE: "pettycash:edit_parked_date",
  PETTYCASH_EDIT_POSTING_DATE: "pettycash:edit_posting_date",
  // Override: edit a Petty Cash after all five roles have approved.
  // Same semantics as PV_EDIT_LOCKED — `pettycash:update` is still
  // required as the base.
  PETTYCASH_EDIT_LOCKED: "pettycash:edit_locked",

  // ----- Assets -----
  // Plain CRUD registry (no approval workflow). Export/import are gated
  // separately so a viewer can browse without bulk-mutating the register.
  ASSET_READ: "asset:read",
  ASSET_CREATE: "asset:create",
  ASSET_UPDATE: "asset:update",
  ASSET_DELETE: "asset:delete",
  ASSET_EXPORT: "asset:export",
  ASSET_IMPORT: "asset:import",

  // ----- GSR Forms (Goods / Service Requisition) -----
  // Full approval workflow (like PV). Approve/receive actions are
  // assignee-gated, not permission-gated.
  GSR_READ: "gsr:read",
  GSR_CREATE: "gsr:create",
  GSR_UPDATE: "gsr:update",
  GSR_DELETE: "gsr:delete",
  GSR_EXPORT: "gsr:export",
  // Override: edit a GSR form after it has left DRAFT. Same semantics as
  // PV_EDIT_LOCKED — `gsr:update` is still required as the base.
  GSR_EDIT_LOCKED: "gsr:edit_locked",

  // ----- Petty Cash Reconciliation Report -----
  // Weekly Dhivehi safe statement with a PV-style approval workflow.
  // Check/Authorize actions are assignee-gated, not permission-gated.
  PCRECON_READ: "pcrecon:read",
  PCRECON_CREATE: "pcrecon:create",
  PCRECON_UPDATE: "pcrecon:update",
  PCRECON_DELETE: "pcrecon:delete",
  PCRECON_EXPORT: "pcrecon:export",
  // Override: edit a report after it has left DRAFT. `pcrecon:update` is
  // still required as the base.
  PCRECON_EDIT_LOCKED: "pcrecon:edit_locked",

  STAFF_READ: "staff:read",
  STAFF_CREATE: "staff:create",
  STAFF_UPDATE: "staff:update",
  STAFF_DELETE: "staff:delete",
  STAFF_SYNC: "staff:sync",

  ROLES_MANAGE: "roles:manage",

  // ----- Attachments -----
  // Generic CRUD permissions for reference documents (PV docs, petty
  // cash docs, anything else stored via the polymorphic Attachment
  // model). Replaces the older parent-resource gating: holding
  // `attachment:upload` lets you attach to any record regardless of
  // its PV / petty cash permissions.
  ATTACHMENT_READ: "attachment:read",
  ATTACHMENT_UPLOAD: "attachment:upload",
  ATTACHMENT_DELETE: "attachment:delete",
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
      {
        key: PERMISSIONS.PV_POST,
        label: "Post voucher",
        description:
          "Post an approved voucher (terminal Posted state). Stamps the poster's signature and posting date onto the PDF.",
      },
      {
        key: PERMISSIONS.PV_EDIT_LOCKED,
        label: "Edit locked PV",
        description:
          "Override the workflow lock and edit a PV that has been sent for verification or further. Requires \"Edit voucher\" as well.",
      },
    ],
  },
  {
    label: "Petty Cash",
    permissions: [
      {
        key: PERMISSIONS.PETTYCASH_READ,
        label: "View petty cash",
        description: "Browse the petty cash register and view individual records.",
      },
      {
        key: PERMISSIONS.PETTYCASH_CREATE,
        label: "Create petty cash",
        description: "Add a new petty cash request.",
      },
      {
        key: PERMISSIONS.PETTYCASH_UPDATE,
        label: "Edit petty cash",
        description: "Modify an existing petty cash record (excluding parked / posting dates).",
      },
      {
        key: PERMISSIONS.PETTYCASH_DELETE,
        label: "Delete petty cash",
        description: "Remove a petty cash record permanently.",
      },
      {
        key: PERMISSIONS.PETTYCASH_EXPORT,
        label: "Export register",
        description: "Download the petty cash register as a .xlsx file.",
      },
      {
        key: PERMISSIONS.PETTYCASH_IMPORT,
        label: "Import register",
        description: "Bulk-load petty cash records from a .xlsx file.",
      },
      {
        key: PERMISSIONS.PETTYCASH_EDIT_PARKED_DATE,
        label: "Edit parked date",
        description: "Set or change the parked date on a petty cash record.",
      },
      {
        key: PERMISSIONS.PETTYCASH_EDIT_POSTING_DATE,
        label: "Edit posting date",
        description: "Set or change the posting date on a petty cash record.",
      },
      {
        key: PERMISSIONS.PETTYCASH_EDIT_LOCKED,
        label: "Edit locked petty cash",
        description:
          "Override the workflow lock and edit a petty cash record after all five roles have approved. Requires \"Edit petty cash\" as well.",
      },
    ],
  },
  {
    label: "Assets",
    permissions: [
      {
        key: PERMISSIONS.ASSET_READ,
        label: "View assets",
        description: "Browse the asset register and view individual assets.",
      },
      {
        key: PERMISSIONS.ASSET_CREATE,
        label: "Create asset",
        description: "Add a new asset to the register.",
      },
      {
        key: PERMISSIONS.ASSET_UPDATE,
        label: "Edit asset",
        description: "Modify an existing asset's details.",
      },
      {
        key: PERMISSIONS.ASSET_DELETE,
        label: "Delete asset",
        description: "Remove an asset permanently.",
      },
      {
        key: PERMISSIONS.ASSET_EXPORT,
        label: "Export Excel",
        description: "Download the asset register as a .xlsx file.",
      },
      {
        key: PERMISSIONS.ASSET_IMPORT,
        label: "Import Excel",
        description: "Bulk-load assets from a .xlsx file.",
      },
    ],
  },
  {
    label: "GSR Forms",
    permissions: [
      {
        key: PERMISSIONS.GSR_READ,
        label: "View GSR forms",
        description:
          "Browse the GSR register and view individual requisition forms.",
      },
      {
        key: PERMISSIONS.GSR_CREATE,
        label: "Create GSR form",
        description: "Add a new goods / service requisition form.",
      },
      {
        key: PERMISSIONS.GSR_UPDATE,
        label: "Edit GSR form",
        description: "Modify an existing GSR form's details.",
      },
      {
        key: PERMISSIONS.GSR_DELETE,
        label: "Delete GSR form",
        description: "Remove a GSR form permanently.",
      },
      {
        key: PERMISSIONS.GSR_EXPORT,
        label: "Export GSR PDF",
        description: "Download a GSR form as a PDF.",
      },
      {
        key: PERMISSIONS.GSR_EDIT_LOCKED,
        label: "Edit locked GSR form",
        description:
          "Override the workflow lock and edit a GSR form that has been sent for authorization or further. Requires \"Edit GSR form\" as well.",
      },
    ],
  },
  {
    label: "Petty Cash Reconciliation",
    permissions: [
      {
        key: PERMISSIONS.PCRECON_READ,
        label: "View reconciliation reports",
        description:
          "Browse the reconciliation register and view individual reports.",
      },
      {
        key: PERMISSIONS.PCRECON_CREATE,
        label: "Create reconciliation report",
        description: "Add a new weekly petty cash reconciliation report.",
      },
      {
        key: PERMISSIONS.PCRECON_UPDATE,
        label: "Edit reconciliation report",
        description: "Modify an existing reconciliation report's details.",
      },
      {
        key: PERMISSIONS.PCRECON_DELETE,
        label: "Delete reconciliation report",
        description: "Remove a reconciliation report permanently.",
      },
      {
        key: PERMISSIONS.PCRECON_EXPORT,
        label: "Export reconciliation PDF",
        description: "Download a reconciliation report as a PDF.",
      },
      {
        key: PERMISSIONS.PCRECON_EDIT_LOCKED,
        label: "Edit locked reconciliation report",
        description:
          "Override the workflow lock and edit a report that has been sent for approval or further. Requires \"Edit reconciliation report\" as well.",
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
  {
    label: "Attachments",
    permissions: [
      {
        key: PERMISSIONS.ATTACHMENT_READ,
        label: "View attachments",
        description:
          "List and download reference documents attached to any record (PVs, petty cash, etc.).",
      },
      {
        key: PERMISSIONS.ATTACHMENT_UPLOAD,
        label: "Upload attachments",
        description:
          "Attach a reference document to any record. Replaces the prior PV/petty cash-tied gating.",
      },
      {
        key: PERMISSIONS.ATTACHMENT_DELETE,
        label: "Delete attachments",
        description:
          "Remove an attachment from any record. Workflow lock no longer applies — anyone with this can delete from locked records too.",
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
