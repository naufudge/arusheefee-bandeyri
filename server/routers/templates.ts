import { router, permissionProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  createTemplateSchema,
  updateTemplateSchema,
  getTemplateSchema,
  deleteTemplateSchema,
} from "../schemas/template.schema";

const templateInclude = {
  createdBy: { select: { id: true, name: true } },
} as const;

export const templatesRouter = router({
  // GET /templates — list all templates. Shared across everyone with
  // pv:create (decision: one library for the team).
  list: permissionProcedure("pv:create").query(async ({ ctx }) => {
    return ctx.prisma.pvTemplate.findMany({
      orderBy: { updatedAt: "desc" },
      include: templateInclude,
    });
  }),

  // GET /templates/{id} — used by the apply flow on the create form.
  getById: permissionProcedure("pv:create")
    .input(getTemplateSchema)
    .query(async ({ ctx, input }) => {
      const tpl = await ctx.prisma.pvTemplate.findUnique({
        where: { id: input.id },
        include: templateInclude,
      });
      if (!tpl) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Template ${input.id} not found`,
        });
      }
      return tpl;
    }),

  // POST /templates — save the current form state as a template.
  create: permissionProcedure("pv:create")
    .input(createTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const clash = await ctx.prisma.pvTemplate.findUnique({
        where: { name: input.name },
      });
      if (clash) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A template named "${input.name}" already exists.`,
        });
      }
      return ctx.prisma.pvTemplate.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          values: input.values,
          createdById: ctx.session.user.id,
        },
        include: templateInclude,
      });
    }),

  // PATCH /templates/{id} — rename / re-describe / replace values.
  update: permissionProcedure("pv:create")
    .input(updateTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.pvTemplate.findUnique({
        where: { id: input.id },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Template ${input.id} not found`,
        });
      }
      // Conflict only fires on a *different* row with the same name —
      // re-saving with the same name is fine.
      if (input.name !== existing.name) {
        const clash = await ctx.prisma.pvTemplate.findUnique({
          where: { name: input.name },
        });
        if (clash) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A template named "${input.name}" already exists.`,
          });
        }
      }
      return ctx.prisma.pvTemplate.update({
        where: { id: input.id },
        data: {
          name: input.name,
          description: input.description ?? null,
          // Omit `values` from the patch if the caller didn't include
          // it — the Settings page rename flow doesn't ship values.
          ...(input.values !== undefined ? { values: input.values } : {}),
        },
        include: templateInclude,
      });
    }),

  // DELETE /templates/{id}
  delete: permissionProcedure("pv:create")
    .input(deleteTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.pvTemplate.findUnique({
        where: { id: input.id },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Template ${input.id} not found`,
        });
      }
      await ctx.prisma.pvTemplate.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
