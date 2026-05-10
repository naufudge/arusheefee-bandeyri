import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { listTenantUsers } from "@/lib/graph";
import { resolveStaff } from "@/lib/staff-resolve";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/staff/sync
 *
 * Fetches all licensed Member users from the Microsoft tenant and runs each
 * through the shared resolveStaff cascade with `trigger: "sync"`.
 *
 * Per resolved decisions:
 *   - License-based filter only (no name blocklist)
 *   - Inserts and updates only — never auto-deactivates
 *   - Admin-set `designation` is preserved (resolveStaff handles this)
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session, PERMISSIONS.STAFF_SYNC)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let tenantUsers;
  try {
    tenantUsers = await listTenantUsers();
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to fetch users from Microsoft Graph.",
      },
      { status: 502 },
    );
  }

  let inserted = 0;
  let updated = 0;
  const failed: { name: string; error: string }[] = [];

  for (const u of tenantUsers) {
    const email = (u.mail ?? u.userPrincipalName).toLowerCase();
    try {
      // Take a snapshot of whether this Staff already exists *before* the
      // resolve writes — we use createdAt vs updatedAt afterwards to decide
      // inserted vs updated.
      const existing = await prisma.staff.findFirst({
        where: {
          OR: [
            { azureOid: u.id },
            { email: { equals: email, mode: "insensitive" } },
            { email: null, name: { equals: u.displayName, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });

      await resolveStaff({
        azureOid: u.id,
        email,
        name: u.displayName,
        jobTitle: u.jobTitle,
        department: u.department,
        trigger: "sync",
      });

      if (existing) updated++;
      else inserted++;
    } catch (err) {
      failed.push({
        name: u.displayName,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    inserted,
    updated,
    total: tenantUsers.length,
    failed,
  });
}
