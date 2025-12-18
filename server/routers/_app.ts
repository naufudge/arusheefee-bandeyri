import { router } from "../trpc";

export const appRouter = router({
  // Add your routers here
  // Example: staff: staffRouter,
});

// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter;
