import { z } from "zod";
import { router, protectedProcedure, permissionProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  ASSET_CODING_KEYS,
  CEA_FE_KEYS,
  GST_RATE_KEY,
  OFFICE_STAMP_KEY,
  getAssetCoding,
  getCeaFe,
  getGstRate,
  getOfficeStamp,
  type CeaFe,
} from "../lib/settings";
import { detectPdfImage } from "@/lib/image-check";
import type { AssetCoding } from "@/lib/asset-creation";

const codingField = z.string().trim().min(1).max(100);
const feField = z.string().trim().max(200);
const MAX_STAMP_BYTES = 1024 * 1024;

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

  // Financial Executive printed on CEA forms. New forms start with these;
  // each form keeps (and may edit) its own copy.
  ceaFe: protectedProcedure.query(async ({ ctx }) => getCeaFe(ctx.prisma)),

  setCeaFe: permissionProcedure("settings:manage")
    .input(
      z.object({
        nameEn: feField,
        nameDv: feField,
        designationEn: feField,
        designationDv: feField,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const fields = Object.keys(CEA_FE_KEYS) as (keyof CeaFe)[];
      await ctx.prisma.$transaction(
        fields.map((field) =>
          ctx.prisma.appSetting.upsert({
            where: { key: CEA_FE_KEYS[field] },
            create: { key: CEA_FE_KEYS[field], value: input[field] },
            update: { value: input[field] },
          }),
        ),
      );
      return getCeaFe(ctx.prisma);
    }),

  // The office stamp is only handed out to settings managers here; CEA PDFs
  // get it from cea.pdfPayload once a form is signed.
  officeStamp: permissionProcedure("settings:manage").query(async ({ ctx }) => {
    return { dataUrl: await getOfficeStamp(ctx.prisma) };
  }),

  setOfficeStamp: permissionProcedure("settings:manage")
    .input(z.object({ dataUrl: z.string().max(2_000_000) }))
    .mutation(async ({ ctx, input }) => {
      const m = /^data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(input.dataUrl);
      const bytes = m ? Buffer.from(m[1], "base64") : null;
      const type = bytes ? detectPdfImage(bytes) : null;
      if (!bytes || !type) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The stamp must be a PNG or JPEG image." });
      }
      if (bytes.byteLength > MAX_STAMP_BYTES) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The stamp image must be under 1 MB." });
      }
      // Store with the type the bytes actually are.
      const value = `data:${type};base64,${bytes.toString("base64")}`;
      await ctx.prisma.appSetting.upsert({
        where: { key: OFFICE_STAMP_KEY },
        create: { key: OFFICE_STAMP_KEY, value },
        update: { value },
      });
      return { success: true };
    }),

  clearOfficeStamp: permissionProcedure("settings:manage").mutation(async ({ ctx }) => {
    await ctx.prisma.appSetting.deleteMany({ where: { key: OFFICE_STAMP_KEY } });
    return { success: true };
  }),
});
