import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";

type Outputs = inferRouterOutputs<AppRouter>["assetCreation"];

/** One set as the detail/edit pages load it (with its timeline). */
export type AssetCreationDetail = Outputs["getByNum"];
/** One row of the register. */
export type AssetCreationListRow = Outputs["list"][number];
/** The set plus signatures, for the PDF. */
export type AssetCreationPdfPayload = Outputs["pdfPayload"];
