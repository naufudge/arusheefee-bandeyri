import { router } from "../trpc";
import { staffRouter } from "./staff";
import { pvRouter } from "./pv";
import { exchangeRatesRouter } from "./exchangeRates";

export const appRouter = router({
  staff: staffRouter,
  pv: pvRouter,
  exchangeRates: exchangeRatesRouter,
});

// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter;
