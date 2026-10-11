import { z } from "zod";
import { router, protectedProcedure, permissionProcedure } from "../trpc";
import {
  ASSET_CODING_KEYS,
  GST_RATE_KEY,
  getAssetCoding,
  getGstRate,
} from "../lib/settings";
import type { AssetCoding } from "@/lib/asset-creation";

const codingField = z.string().trim().min(1).max(100);

export const settingsRouter = router({
  // The global GST rate (%). Read by forms that apply GST, so any signed-in
  // user may see it.
  gstRate: protectedProcedure.query(async ({ ctx }) => {
    return getGstRate(ctx.prisma);
  }),

  // Settings → General. Draft price evaluations pick up the new rate when
  // next saved; ones already sent keep the rate they were sent with.
  setGstRate: permissionProcedure("settings:manage")
    .input(z.object({ rate: z.number().min(0).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const value = String(Math.round(input.rate * 100) / 100);
      await ctx.prisma.appSetting.upsert({
        where: { key: GST_RATE_KEY },
        create: { key: GST_RATE_KEY, value },
        update: { value },
      });
      return Number(value);
    }),

  // SAP coding printed on asset creation forms. New forms start with these;
  // each form keeps its own copy.
  assetCoding: protectedProcedure.query(async ({ ctx }) => {
    return getAssetCoding(ctx.prisma);
  }),

  setAssetCoding: permissionProcedure("settings:manage")
    .input(
      z.object({
        agencyName: codingField,
        businessArea: codingField,
        costCentre: codingField,
        fund: codingField,
        functionalArea: codingField,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const fields = Object.keys(ASSET_CODING_KEYS) as (keyof AssetCoding)[];
      await ctx.prisma.$transaction(
        fields.map((field) =>
          ctx.prisma.appSetting.upsert({
            where: { key: ASSET_CODING_KEYS[field] },
            create: { key: ASSET_CODING_KEYS[field], value: input[field] },
            update: { value: input[field] },
          }),
        ),
      );
      return getAssetCoding(ctx.prisma);
    }),
});
