import { router } from "../trpc";
import { staffRouter } from "./staff";
import { pvRouter } from "./pv";
import { pettyCashRouter } from "./pettycash";
import { exchangeRatesRouter } from "./exchangeRates";
import { roleRouter } from "./role";

export const appRouter = router({
  staff: staffRouter,
  pv: pvRouter,
  pettycash: pettyCashRouter,
  exchangeRates: exchangeRatesRouter,
  role: roleRouter,
});

// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter;
