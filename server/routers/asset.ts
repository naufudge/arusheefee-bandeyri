import { router, permissionProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { assertProcurementSlot, procurementBackLink } from "../lib/procurement";
import {
  createAssetSchema,
  updateAssetSchema,
  getAssetByNumSchema,
  deleteAssetSchema,
  nextItemSchema,
} from "../schemas/asset.schema";
import { nextAssetItem } from "../lib/assetNumbers";

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
      return { nextItem: await nextAssetItem(ctx.prisma, input) };
    }),

  // Single asset by its slug/number.
  getByNum: permissionProcedure("asset:read")
    .input(getAssetByNumSchema)
    .query(async ({ ctx, input }) => {
      const asset = await ctx.prisma.asset.findUnique({
        where: { assetNum: input.assetNum },
        include: {
          procurement: procurementBackLink,
          // The asset creation form it was registered from, if any.
          assetCreationForm: { select: { formNum: true } },
        },
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
      const { procurementId, ...data } = input;
      await assertProcurementSlot(ctx.prisma, procurementId, "asset", ctx.session.permissions);
      return ctx.prisma.asset.create({
        data: { ...data, procurementId: procurementId ?? null },
      });
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
