import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";

type Outputs = inferRouterOutputs<AppRouter>["cea"];

/** One CEA as the detail/edit pages load it (with its timeline). */
export type CeaDetail = Outputs["getByNum"];
/** One row of the register. */
export type CeaListRow = Outputs["list"][number];
/** The CEA plus the requester's signature and the office stamp, for the PDF. */
export type CeaPdfPayload = Outputs["pdfPayload"];
/** What a new CEA takes from its procurement's price evaluation. */
export type CeaLiveSource = NonNullable<Outputs["liveSource"]>;
