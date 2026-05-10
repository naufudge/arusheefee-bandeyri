import { router, permissionProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  createStaffSchema,
  updateStaffSchema,
  deleteStaffSchema,
} from "../schemas/staff.schema";

export const staffRouter = router({
  // GET /staff - List all staff with their assigned roles
  list: permissionProcedure("staff:read").query(async ({ ctx }) => {
    return ctx.prisma.staff.findMany({
      orderBy: { name: "asc" },
      include: {
        roles: {
          select: { id: true, name: true, isSystem: true },
        },
      },
    });
  }),

  // POST /staff - Create staff (optionally with roles)
  create: permissionProcedure("staff:create")
    .input(createStaffSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.staff.create({
        data: {
          name: input.name,
          designation: input.designation,
          ...(input.roleIds && input.roleIds.length > 0
            ? { roles: { connect: input.roleIds.map((id) => ({ id })) } }
            : {}),
        },
        include: {
          roles: { select: { id: true, name: true, isSystem: true } },
        },
      });
    }),

  // PATCH /staff/{id} - Update staff (optionally replacing roles)
  update: permissionProcedure("staff:update")
    .input(updateStaffSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, roleIds, ...updateData } = input;

      const existing = await ctx.prisma.staff.findUnique({ where: { id } });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Staff with id ${id} not found`,
        });
      }

      return ctx.prisma.staff.update({
        where: { id },
        data: {
          ...updateData,
          // If roleIds was provided, REPLACE the staff's role set with
          // exactly these roles (set semantic, not connect/disconnect).
          ...(roleIds !== undefined
            ? { roles: { set: roleIds.map((rid) => ({ id: rid })) } }
            : {}),
        },
        include: {
          roles: { select: { id: true, name: true, isSystem: true } },
        },
      });
    }),

  // DELETE /staff/{id} - Delete staff
  delete: permissionProcedure("staff:delete")
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
