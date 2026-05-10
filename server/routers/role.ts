import { router, permissionProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  createRoleSchema,
  updateRoleSchema,
  deleteRoleSchema,
} from "../schemas/role.schema";

export const roleRouter = router({
  // GET /roles - list all roles with assigned-staff count
  list: permissionProcedure("roles:manage").query(async ({ ctx }) => {
    const roles = await ctx.prisma.role.findMany({
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      include: {
        _count: { select: { staff: true } },
      },
    });
    return roles;
  }),

  // POST /roles - create a new role
  create: permissionProcedure("roles:manage")
    .input(createRoleSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.role.findUnique({
        where: { name: input.name },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A role named "${input.name}" already exists.`,
        });
      }
      return ctx.prisma.role.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          permissions: input.permissions,
          isSystem: false,
        },
      });
    }),

  // PATCH /roles/{id} - rename, re-describe, or change permissions
  update: permissionProcedure("roles:manage")
    .input(updateRoleSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const existing = await ctx.prisma.role.findUnique({ where: { id } });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Role ${id} not found`,
        });
      }
      // Detect a name collision against a *different* role
      if (rest.name && rest.name !== existing.name) {
        const clash = await ctx.prisma.role.findUnique({
          where: { name: rest.name },
        });
        if (clash) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A role named "${rest.name}" already exists.`,
          });
        }
      }
      return ctx.prisma.role.update({
        where: { id },
        data: {
          ...(rest.name !== undefined ? { name: rest.name } : {}),
          ...(rest.description !== undefined
            ? { description: rest.description ?? null }
            : {}),
          ...(rest.permissions !== undefined
            ? { permissions: rest.permissions }
            : {}),
        },
      });
    }),

  // DELETE /roles/{id} - delete a role
  // Refuses to delete system roles or roles with assigned staff.
  delete: permissionProcedure("roles:manage")
    .input(deleteRoleSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.role.findUnique({
        where: { id: input.id },
        include: { _count: { select: { staff: true } } },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Role ${input.id} not found`,
        });
      }
      if (existing.isSystem) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `"${existing.name}" is a system role and cannot be deleted.`,
        });
      }
      if (existing._count.staff > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `"${existing.name}" is assigned to ${existing._count.staff} staff. Unassign first.`,
        });
      }
      await ctx.prisma.role.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
