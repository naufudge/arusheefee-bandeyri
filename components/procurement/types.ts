import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";

type Outputs = inferRouterOutputs<AppRouter>["procurement"];

/** A procurement with its documents summarised and its progress worked out. */
export type ProcurementSummary = Outputs["getById"];
