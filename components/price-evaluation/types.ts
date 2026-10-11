import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";

type Outputs = inferRouterOutputs<AppRouter>["priceEval"];

/** One evaluation as the detail/edit pages load it (with its timeline). */
export type PriceEvalDetail = Outputs["getByNum"];
/** One row of the register. */
export type PriceEvalListRow = Outputs["list"][number];
