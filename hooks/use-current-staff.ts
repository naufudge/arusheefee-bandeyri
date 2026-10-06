"use client";

import { useSession } from "next-auth/react";

/**
 * The logged-in user's row from a loaded staff list, or undefined until both
 * the session and the list are available. `session.user.id` is the Staff id
 * (set in the auth session callback).
 *
 * Used to pre-select the logged-in staff member as the creator role
 * (Prepared by / Requested by) on new records.
 */
export function useCurrentStaff<T extends { id: string }>(
  staffList: T[] | undefined,
): T | undefined {
  const { data: session } = useSession();
  const id = session?.user?.id;
  return id ? staffList?.find((s) => s.id === id) : undefined;
}
