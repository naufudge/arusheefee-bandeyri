import { router } from "../trpc";
import { staffRouter } from "./staff";
import { pvRouter } from "./pv";
import { pettyCashRouter } from "./pettyCash";
import { exchangeRatesRouter } from "./exchangeRates";
import { roleRouter } from "./role";
import { approvalsRouter } from "./approvals";
import { templatesRouter } from "./templates";

export const appRouter = router({
  staff: staffRouter,
  pv: pvRouter,
  pettycash: pettyCashRouter,
  exchangeRates: exchangeRatesRouter,
  role: roleRouter,
  approvals: approvalsRouter,
  templates: templatesRouter,
});

// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter;
