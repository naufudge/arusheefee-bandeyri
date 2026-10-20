import { router, protectedProcedure, permissionProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  createGlAccountSchema,
  updateGlAccountSchema,
  deleteGlAccountSchema,
} from "../schemas/glAccount.schema";

// Empty / whitespace-only Dhivehi text is stored as null. `undefined` passes
// through so an update can leave the field untouched.
const dv = (v: string | null | undefined) =>
  v === undefined ? undefined : v && v.trim() ? v.trim() : null;

// "3 PV GL lines and 1 petty cash record", or null when the account is unused.
function describeUsage(counts: {
  glDetails: number;
  pettyCash: number;
  priceEvaluations: number;
  assetCreations: number;
  capitalExpenditures: number;
}): string | null {
  const { glDetails, pettyCash, priceEvaluations, assetCreations, capitalExpenditures } = counts;
  const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  const parts = [
    glDetails > 0 ? plural(glDetails, "PV GL line") : null,
    pettyCash > 0 ? plural(pettyCash, "petty cash record") : null,
    priceEvaluations > 0 ? plural(priceEvaluations, "price evaluation") : null,
    assetCreations > 0 ? plural(assetCreations, "asset creation form") : null,
    capitalExpenditures > 0 ? plural(capitalExpenditures, "CEA form") : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.length === 1
    ? parts[0]
    : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

const usageCount = {
  _count: {
    select: {
      glDetails: true,
      pettyCash: true,
      priceEvaluations: true,
      assetCreations: true,
      capitalExpenditures: true,
    },
  },
} as const;

export const glAccountsRouter = router({
  // GET /gl-accounts - The chart of accounts, for the PV / petty cash GL
  // pickers. Reference data, so any signed-in user may read it.
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.glAccount.findMany({
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        shortTextEn: true,
        longTextEn: true,
        shortTextDv: true,
        longTextDv: true,
        pettyCashAllowed: true,
      },
    });
  }),

  // GET /gl-accounts/usage - Same list plus how many PV GL lines and petty
  // cash records use each account, for Settings → GL Accounts.
  listWithUsage: permissionProcedure("glaccount:read").query(async ({ ctx }) => {
    return ctx.prisma.glAccount.findMany({
      orderBy: { code: "asc" },
      include: usageCount,
    });
  }),

  // POST /gl-accounts - Add an account
  create: permissionProcedure("glaccount:create")
    .input(createGlAccountSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.glAccount.findUnique({
        where: { code: input.code },
        select: { code: true },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `GL code ${input.code} already exists.`,
        });
      }

      return ctx.prisma.glAccount.create({
        data: {
          code: input.code,
          shortTextEn: input.shortTextEn,
          longTextEn: input.longTextEn,
          shortTextDv: dv(input.shortTextDv) ?? null,
          longTextDv: dv(input.longTextDv) ?? null,
          pettyCashAllowed: input.pettyCashAllowed,
        },
      });
    }),

  // PATCH /gl-accounts/{id} - Edit names / petty cash flag. The code can
  // be corrected only while nothing uses the account, so codes shown on
  // existing PVs and petty cash records never change.
  update: permissionProcedure("glaccount:update")
    .input(updateGlAccountSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.glAccount.findUnique({
        where: { id: input.id },
        include: usageCount,
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "GL account not found",
        });
      }

      if (input.code !== undefined && input.code !== existing.code) {
        const usage = describeUsage(existing._count);
        if (usage) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `GL code ${existing.code} is used by ${usage}, so its code can't be changed.`,
          });
        }
        const taken = await ctx.prisma.glAccount.findUnique({
          where: { code: input.code },
          select: { id: true },
        });
        if (taken) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `GL code ${input.code} already exists.`,
          });
        }
      }

      return ctx.prisma.glAccount.update({
        where: { id: input.id },
        data: {
          code: input.code,
          shortTextEn: input.shortTextEn,
          longTextEn: input.longTextEn,
          shortTextDv: dv(input.shortTextDv),
          longTextDv: dv(input.longTextDv),
          pettyCashAllowed: input.pettyCashAllowed,
        },
      });
    }),

  // DELETE /gl-accounts/{id} - Only for accounts nothing uses. The
  // foreign keys (ON DELETE RESTRICT) are the backstop.
  delete: permissionProcedure("glaccount:delete")
    .input(deleteGlAccountSchema)
    .mutation(async ({ ctx, input }) => {
      const account = await ctx.prisma.glAccount.findUnique({
        where: { id: input.id },
        include: usageCount,
      });
      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "GL account not found",
        });
      }

      const usage = describeUsage(account._count);
      if (usage) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `GL code ${account.code} is used by ${usage}, so it can't be deleted.`,
        });
      }

      await ctx.prisma.glAccount.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
