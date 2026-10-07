"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import type { SearchableSelectOption } from "@/components/ui/searchable-select";

type GlAccountLike = { code: number; longTextEn: string };

/**
 * GL accounts as picker options: the code, with the account name muted
 * beside it. Values are the code as a string; both parts are searchable.
 */
export function glAccountOptions(accounts: GlAccountLike[]): SearchableSelectOption[] {
  return accounts.map((a) => ({ value: String(a.code), label: String(a.code), hint: a.longTextEn }));
}

/**
 * The chart of accounts for the GL pickers. Reference data that rarely
 * changes, so it's cached for the session rather than refetched per form.
 * Readable by any signed-in user.
 */
export function useGlAccounts() {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.glAccounts.list.queryOptions(),
    staleTime: 10 * 60 * 1000,
  });
}
