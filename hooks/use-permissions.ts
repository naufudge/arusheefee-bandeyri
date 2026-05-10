"use client";

import { useSession } from "next-auth/react";
import type { Permission } from "@/lib/permissions";

/** True if the signed-in user has the given permission. */
export function useHasPermission(permission: Permission): boolean {
  const { data: session } = useSession();
  return session?.permissions?.includes(permission) ?? false;
}

/** True if the signed-in user has *any* of the given permissions. */
export function useHasAnyPermission(
  permissions: readonly Permission[],
): boolean {
  const { data: session } = useSession();
  if (!session?.permissions) return false;
  return permissions.some((p) => session.permissions.includes(p));
}

/**
 * True when the user is signed in but has no permissions at all
 * (i.e. an admin hasn't assigned them a role yet). Distinct from
 * "loading" or "signed out".
 */
export function useHasNoPermissions(): boolean {
  const { data: session, status } = useSession();
  if (status !== "authenticated") return false;
  return !session?.permissions || session.permissions.length === 0;
}
