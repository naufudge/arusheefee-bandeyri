import { initTRPC, TRPCError } from "@trpc/server";
import { Context } from "./context";
import type { Permission } from "@/lib/permissions";

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.context<Context>().create();

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router.
 *
 * - `publicProcedure`     — no auth required (use sparingly; only for
 *                           genuinely public reads)
 * - `protectedProcedure`  — requires a signed-in session
 * - `permissionProcedure(p)` — requires the named permission
 */
export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Procedure that throws UNAUTHORIZED when the request has no session.
 * Downstream resolvers can rely on `ctx.session` and `ctx.session.user`
 * being non-null.
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      // Re-narrow to non-null for downstream resolvers
      session: ctx.session,
    },
  });
});

/**
 * Factory: a procedure that requires a specific RBAC permission.
 * Throws FORBIDDEN if the session lacks it.
 *
 *   list: permissionProcedure("staff:read").query(...)
 */
export function permissionProcedure(permission: Permission) {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!ctx.session.permissions?.includes(permission)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Missing permission: ${permission}`,
      });
    }
    return next();
  });
}
