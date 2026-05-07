import { prisma } from "@/lib/prisma";
import type { Staff } from "@prisma/client";

export type ResolveStaffSource = "login" | "sync";

export interface ResolveStaffArgs {
  /** Azure Entra object id — primary stable identifier. */
  azureOid: string;
  /** Lower-cased email. */
  email: string;
  /** Display name from Azure. */
  name: string;
  /** Optional Microsoft Graph fields; pass null when unavailable. */
  jobTitle?: string | null;
  department?: string | null;
  /**
   * Where this resolve is being called from. Affects:
   *   - whether `lastLoginAt` is bumped (only for `login`)
   *   - the `source` value of newly-created Staff rows
   */
  trigger: ResolveStaffSource;
}

/**
 * Match-or-create cascade for an Azure Entra user, used by both:
 *   - the next-auth jwt callback (per-login)
 *   - the tenant-sync route handler (bulk)
 *
 * Cascade order:
 *   1. azureOid                → already linked from a prior login/sync
 *   2. email (case-insensitive) → matching Staff row, hasn't been linked yet
 *   3. name (case-insensitive) where email IS NULL → legacy Staff predating SSO
 *   4. fallback                 → INSERT a new Staff
 *
 * Designation is **admin-controlled** and never overwritten when it already has
 * a non-empty value. Only when designation is empty do we fall back to
 * Azure's jobTitle.
 *
 * jobTitle / department from Graph are written when provided. When `null`
 * (Graph unavailable, or user simply has no value set), existing DB values
 * are preserved.
 */
export async function resolveStaff(args: ResolveStaffArgs): Promise<Staff> {
  const {
    azureOid,
    email,
    name,
    jobTitle = null,
    department = null,
    trigger,
  } = args;
  const now = trigger === "login" ? new Date() : null;

  const preserveDesignation = (
    existing: string | null | undefined,
  ): string => {
    if (existing && existing.trim() !== "") return existing;
    return jobTitle ?? existing ?? "";
  };

  const merged = (existing: Staff) => ({
    email,
    name,
    isActive: true,
    jobTitle: jobTitle ?? existing.jobTitle,
    department: department ?? existing.department,
    designation: preserveDesignation(existing.designation),
    ...(now ? { lastLoginAt: now } : {}),
  });

  // 1. Match by Azure object id
  const byOid = await prisma.staff.findUnique({ where: { azureOid } });
  if (byOid) {
    return prisma.staff.update({ where: { id: byOid.id }, data: merged(byOid) });
  }

  // 2. Match by email (case-insensitive)
  const byEmail = await prisma.staff.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (byEmail) {
    return prisma.staff.update({
      where: { id: byEmail.id },
      data: {
        ...merged(byEmail),
        azureOid,
        // Keep "legacy" if it was legacy, otherwise reflect what triggered it
        source: byEmail.source === "legacy" ? "legacy" : trigger,
      },
    });
  }

  // 3. Match a legacy Staff (email NULL) by name (case-insensitive)
  const byName = await prisma.staff.findFirst({
    where: {
      email: null,
      name: { equals: name, mode: "insensitive" },
    },
  });
  if (byName) {
    return prisma.staff.update({
      where: { id: byName.id },
      data: {
        ...merged(byName),
        azureOid,
        // Was legacy — keep that source so we know they pre-existed SSO
      },
    });
  }

  // 4. Create
  return prisma.staff.create({
    data: {
      name,
      email,
      azureOid,
      designation: jobTitle ?? "",
      jobTitle,
      department,
      isActive: true,
      source: trigger,
      ...(now ? { lastLoginAt: now } : {}),
    },
  });
}
