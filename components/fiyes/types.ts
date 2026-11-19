import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";

type Outputs = inferRouterOutputs<AppRouter>["fiyes"];

export type FiyesListItem = Outputs["list"][number];
export type FiyesReturnDetail = Outputs["getByPeriod"];
export type FiyesPdfPayload = Outputs["pdfPayload"];
export type FiyesPettyCashBalances = Outputs["pettyCashBalances"];
