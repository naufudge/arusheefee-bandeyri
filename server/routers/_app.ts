import { router } from "../trpc";
import { staffRouter } from "./staff";
import { pvRouter } from "./pv";
import { pettyCashRouter } from "./pettycash";
import { exchangeRatesRouter } from "./exchangeRates";
import { roleRouter } from "./role";
import { approvalsRouter } from "./approvals";
import { templatesRouter } from "./templates";
import { assetRouter } from "./asset";
import { gsrRouter } from "./gsr";
import { pcReconRouter } from "./pcRecon";

export const appRouter = router({
  staff: staffRouter,
  pv: pvRouter,
  pettycash: pettyCashRouter,
  exchangeRates: exchangeRatesRouter,
  role: roleRouter,
  approvals: approvalsRouter,
  templates: templatesRouter,
  asset: assetRouter,
  gsr: gsrRouter,
  pcRecon: pcReconRouter,
});

// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter;
