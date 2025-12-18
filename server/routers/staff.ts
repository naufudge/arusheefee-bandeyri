import { router, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  createStaffSchema,
  updateStaffSchema,
  deleteStaffSchema,
} from "../schemas/staff.schema";

export const staffRouter = router({
  // GET /staff - List all staff
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.staff.findMany({
      orderBy: { name: "asc" },
    });
  }),

  // POST /staff - Create staff
  create: publicProcedure
    .input(createStaffSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.staff.create({
        data: {
          name: input.name,
          designation: input.designation,
        },
      });
    }),

  // PATCH /staff/{id} - Update staff
  update: publicProcedure
    .input(updateStaffSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      const existing = await ctx.prisma.staff.findUnique({ where: { id } });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Staff with id ${id} not found`,
        });
      }

      return ctx.prisma.staff.update({
        where: { id },
        data: updateData,
      });
    }),

  // DELETE /staff/{id} - Delete staff
  delete: publicProcedure
    .input(deleteStaffSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.staff.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Staff with id ${input.id} not found`,
        });
      }

      await ctx.prisma.staff.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
