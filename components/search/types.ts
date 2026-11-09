import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";
import type { SearchModule } from "@/lib/search";

export type SearchGroup = inferRouterOutputs<AppRouter>["search"]["global"][number];
export type SearchHit = SearchGroup["items"][number];

/** A record opened from search, kept per user in this browser. */
export type RecentRecord = {
  module: SearchModule;
  href: string;
  num: string | null;
  title: string;
};
