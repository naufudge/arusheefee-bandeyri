import { z } from "zod";
import { router, protectedProcedure, permissionProcedure } from "../trpc";
import { GST_RATE_KEY, getGstRate } from "../lib/settings";

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
});
