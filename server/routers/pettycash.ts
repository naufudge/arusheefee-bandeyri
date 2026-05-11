import { router, permissionProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { requirePermission } from "@/lib/permissions";
import {
  createPettyCashSchema,
  updatePettyCashSchema,
  getPettyCashByNumSchema,
  deletePettyCashSchema,
  yearFilterSchema,
  type PettyCashStaffInput,
} from "../schemas/pettycash.schema";

const pettyCashInclude = {
  handledBy: { include: { staff: true } },
  procurementApprovedBy: { include: { staff: true } },
  budgetCheckedBy: { include: { staff: true } },
  balanceHandedOverBy: { include: { staff: true } },
  balanceCollectedBy: { include: { staff: true } },
  items: true,
} as const;

// Build the nested-create payload for one role's PettyCashStaff row.
// Returns undefined when the role wasn't filled in, so prisma skips it.
function buildRoleCreate(role: PettyCashStaffInput | null | undefined) {
  if (!role) return undefined;
  return {
    create: {
      staffId: role.staffId,
      amount: role.amount ?? null,
      isApproved: role.isApproved,
      date: role.date,
    },
  };
}

// Datetimes can come in as Date objects, ISO strings, or null. Normalise so
// equality checks in the parked/posting permission gate are reliable.
function dateValue(d: Date | string | null | undefined): number | null {
  if (!d) return null;
  return new Date(d).getTime();
}

export const pettyCashRouter = router({
  list: permissionProcedure("pettycash:read").query(async ({ ctx }) => {
    return ctx.prisma.pettyCash.findMany({
      include: pettyCashInclude,
      orderBy: { createdAt: "desc" },
    });
  }),

  getByNum: permissionProcedure("pettycash:read")
    .input(getPettyCashByNumSchema)
    .query(async ({ ctx, input }) => {
      const record = await ctx.prisma.pettyCash.findUnique({
        where: { pettyCashNum: input.pettyCashNum },
        include: pettyCashInclude,
      });
      if (!record) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Petty cash ${input.pettyCashNum} not found`,
        });
      }
      return record;
    }),

  latest: permissionProcedure("pettycash:read").query(async ({ ctx }) => {
    const record = await ctx.prisma.pettyCash.findFirst({
      orderBy: { createdAt: "desc" },
      include: pettyCashInclude,
    });
    if (!record) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No petty cash records found",
      });
    }
    return record;
  }),

  byYear: permissionProcedure("pettycash:read")
    .input(yearFilterSchema)
    .query(async ({ ctx, input }) => {
      const yearNum = Number(input.year);
      return ctx.prisma.pettyCash.findMany({
        where: {
          date: {
            gte: new Date(Date.UTC(yearNum, 0, 1)),
            lt: new Date(Date.UTC(yearNum + 1, 0, 1)),
          },
        },
        include: pettyCashInclude,
        orderBy: { date: "desc" },
      });
    }),

  create: permissionProcedure("pettycash:create")
    .input(createPettyCashSchema)
    .mutation(async ({ ctx, input }) => {
      // Editing parked / posting on creation also requires the fine-grained
      // permission — otherwise users without `pettycash:update` could set
      // them by going through the create endpoint.
      if (input.parkedDate) {
        requirePermission(ctx.session, "pettycash:edit_parked_date");
      }
      if (input.postingDate) {
        requirePermission(ctx.session, "pettycash:edit_posting_date");
      }

      const existing = await ctx.prisma.pettyCash.findUnique({
        where: { pettyCashNum: input.pettyCashNum },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Petty cash ${input.pettyCashNum} already exists`,
        });
      }

      return ctx.prisma.pettyCash.create({
        data: {
          pettyCashNum: input.pettyCashNum,
          date: input.date,
          formNum: input.formNum,
          sectionUnit: input.sectionUnit,
          totalRequiredAmount: input.totalRequiredAmount,
          glCode: input.glCode,
          parkedDate: input.parkedDate ?? null,
          postingDate: input.postingDate ?? null,
          handledBy: buildRoleCreate(input.handledBy),
          procurementApprovedBy: buildRoleCreate(input.procurementApprovedBy),
          budgetCheckedBy: buildRoleCreate(input.budgetCheckedBy),
          balanceHandedOverBy: buildRoleCreate(input.balanceHandedOverBy),
          balanceCollectedBy: buildRoleCreate(input.balanceCollectedBy),
          items: {
            create: input.items.map((item) => ({
              qty: item.qty,
              name: item.name,
            })),
          },
        },
        include: pettyCashInclude,
      });
    }),

  // Delete-and-recreate the role rows + items, mirroring how PV updates
  // invoices/GL details. The five PettyCashStaff rows are detached from the
  // PettyCash first (FKs nullified), then deleted by id so we don't orphan
  // them in the petty_cash_staff table.
  update: permissionProcedure("pettycash:update")
    .input(updatePettyCashSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.pettyCash.findUnique({
        where: { pettyCashNum: input.pettyCashNum },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Petty cash ${input.pettyCashNum} not found`,
        });
      }

      // Fine-grained permission gate: only block if the date actually
      // changed. Users without these permissions can still re-save the
      // record as long as they leave the existing date alone.
      if (
        dateValue(input.parkedDate) !== dateValue(existing.parkedDate) &&
        !ctx.session.permissions?.includes("pettycash:edit_parked_date")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Missing permission: pettycash:edit_parked_date",
        });
      }
      if (
        dateValue(input.postingDate) !== dateValue(existing.postingDate) &&
        !ctx.session.permissions?.includes("pettycash:edit_posting_date")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Missing permission: pettycash:edit_posting_date",
        });
      }

      const oldRoleIds = [
        existing.handledById,
        existing.procurementApprovedById,
        existing.budgetCheckedById,
        existing.balanceHandedOverById,
        existing.balanceCollectedById,
      ].filter((id): id is string => Boolean(id));

      return ctx.prisma.$transaction(async (tx) => {
        // Detach the PettyCashStaff rows so we can delete them, and clear
        // the items in one go (cascade handles the items' FKs).
        await tx.pettyCash.update({
          where: { pettyCashNum: input.pettyCashNum },
          data: {
            handledById: null,
            procurementApprovedById: null,
            budgetCheckedById: null,
            balanceHandedOverById: null,
            balanceCollectedById: null,
          },
        });

        if (oldRoleIds.length > 0) {
          await tx.pettyCashStaff.deleteMany({
            where: { id: { in: oldRoleIds } },
          });
        }
        await tx.pettyCashItem.deleteMany({
          where: { pettyCashId: existing.id },
        });

        return tx.pettyCash.update({
          where: { pettyCashNum: input.pettyCashNum },
          data: {
            date: input.date,
            formNum: input.formNum,
            sectionUnit: input.sectionUnit,
            totalRequiredAmount: input.totalRequiredAmount,
            glCode: input.glCode,
            parkedDate: input.parkedDate ?? null,
            postingDate: input.postingDate ?? null,
            handledBy: buildRoleCreate(input.handledBy),
            procurementApprovedBy: buildRoleCreate(input.procurementApprovedBy),
            budgetCheckedBy: buildRoleCreate(input.budgetCheckedBy),
            balanceHandedOverBy: buildRoleCreate(input.balanceHandedOverBy),
            balanceCollectedBy: buildRoleCreate(input.balanceCollectedBy),
            items: {
              create: input.items.map((item) => ({
                qty: item.qty,
                name: item.name,
              })),
            },
          },
          include: pettyCashInclude,
        });
      });
    }),

  delete: permissionProcedure("pettycash:delete")
    .input(deletePettyCashSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.pettyCash.findUnique({
        where: { pettyCashNum: input.pettyCashNum },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Petty cash ${input.pettyCashNum} not found`,
        });
      }

      const roleIds = [
        existing.handledById,
        existing.procurementApprovedById,
        existing.budgetCheckedById,
        existing.balanceHandedOverById,
        existing.balanceCollectedById,
      ].filter((id): id is string => Boolean(id));

      await ctx.prisma.$transaction(async (tx) => {
        // Cascade clears items; explicitly delete the role rows so they
        // don't linger in petty_cash_staff after the parent is gone.
        await tx.pettyCash.delete({
          where: { pettyCashNum: input.pettyCashNum },
        });
        if (roleIds.length > 0) {
          await tx.pettyCashStaff.deleteMany({
            where: { id: { in: roleIds } },
          });
        }
      });

      return { success: true };
    }),
});
