import { router, permissionProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  createAssetSchema,
  updateAssetSchema,
  getAssetByNumSchema,
  deleteAssetSchema,
  nextItemSchema,
} from "../schemas/asset.schema";
import { AGENCY_CODE, parseAssetNumber } from "@/lib/assetNumber";

export const assetRouter = router({
  // List every asset (filtered client-side on the register, like pv-register).
  list: permissionProcedure("asset:read").query(async ({ ctx }) => {
    return ctx.prisma.asset.findMany({
      orderBy: { createdAt: "desc" },
    });
  }),

  // Suggest the next running item number for a number prefix. Narrows by
  // agency+year, then matches the category/subcategory/type segments
  // numerically (ignoring legacy zero-padding) and returns max + 1.
  nextItem: permissionProcedure("asset:create")
    .input(nextItemSchema)
    .query(async ({ ctx, input }) => {
      const { yy, mainNum, subNum, typeNum, variantNum, noType } = input;
      const hasVariant = variantNum !== undefined && variantNum !== null;

      const assets = await ctx.prisma.asset.findMany({
        where: { assetNum: { startsWith: `${AGENCY_CODE}-${yy}-` } },
        select: { assetNum: true },
      });

      let max = 0;
      for (const a of assets) {
        const parsed = parseAssetNumber(a.assetNum);
        if (!parsed) continue;
        const p = parsed.parts;
        if (p[2] !== mainNum || p[3] !== subNum) continue;
        if (noType) {
          // Type-less subcategory: 5-segment 433-YY-main-sub-item.
          if (p.length !== 5) continue;
        } else {
          if (p[4] !== typeNum) continue;
          if (hasVariant) {
            if (p.length !== 7 || p[5] !== variantNum) continue;
          } else if (p.length !== 6) {
            continue;
          }
        }
        if (parsed.item > max) max = parsed.item;
      }
      return { nextItem: max + 1 };
    }),

  // Single asset by its slug/number.
  getByNum: permissionProcedure("asset:read")
    .input(getAssetByNumSchema)
    .query(async ({ ctx, input }) => {
      const asset = await ctx.prisma.asset.findUnique({
        where: { assetNum: input.assetNum },
      });
      if (!asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Asset ${input.assetNum} not found`,
        });
      }
      return asset;
    }),

  create: permissionProcedure("asset:create")
    .input(createAssetSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.asset.findUnique({
        where: { assetNum: input.assetNum },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Asset ${input.assetNum} already exists`,
        });
      }
      return ctx.prisma.asset.create({ data: input });
    }),

  // Update by assetNum (the slug is immutable). No nested records, so a
  // plain update — no transaction needed.
  update: permissionProcedure("asset:update")
    .input(updateAssetSchema)
    .mutation(async ({ ctx, input }) => {
      const { assetNum, ...data } = input;
      const existing = await ctx.prisma.asset.findUnique({
        where: { assetNum },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Asset ${assetNum} not found`,
        });
      }
      return ctx.prisma.asset.update({
        where: { assetNum },
        data,
      });
    }),

  delete: permissionProcedure("asset:delete")
    .input(deleteAssetSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.asset.findUnique({
        where: { assetNum: input.assetNum },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Asset ${input.assetNum} not found`,
        });
      }
      await ctx.prisma.asset.delete({ where: { assetNum: input.assetNum } });
      return { success: true };
    }),
});
