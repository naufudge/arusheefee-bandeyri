import { z } from "zod";
import { router, protectedProcedure, permissionProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { requirePermission } from "@/lib/permissions";
import {
  createPettyCashSchema,
  updatePettyCashSchema,
  getPettyCashByNumSchema,
  deletePettyCashSchema,
  yearFilterSchema,
  approveRoleSchema,
  rejectRoleSchema,
  type PettyCashStaffInput,
  type PCRoleSchemaInput,
} from "../schemas/pettycash.schema";
import {
  PC_ROLES,
  PC_ROLE_TO_FK,
  assertActorHasSignature,
  getSignatureDataUrl,
  type PCRole,
} from "../lib/approval";

const pettyCashInclude = {
  handledBy: { include: { staff: true } },
  procurementApprovedBy: { include: { staff: true } },
  budgetCheckedBy: { include: { staff: true } },
  balanceHandedOverBy: { include: { staff: true } },
  balanceCollectedBy: { include: { staff: true } },
  items: true,
  approvalEvents: {
    include: {
      actor: { select: { id: true, name: true, designation: true } },
    },
    orderBy: { createdAt: "asc" },
  },
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

// Float comparison tolerant of the noise we get from JSON round-trips +
// react-hook-form's coercion. Petty cash amounts are MVR with 2 decimals,
// so 1e-9 is comfortably tight enough to detect any real change.
function amountUnchanged(
  a: number | null | undefined,
  b: number | null | undefined,
): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 1e-9;
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

  // Petty cash whose `date` falls in [weekStart, weekEnd] (inclusive of the
  // whole weekEnd day). Used to source the reconciliation report's items.
  byWeek: permissionProcedure("pettycash:read")
    .input(
      z.object({
        weekStart: z.coerce.date(),
        weekEnd: z.coerce.date(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const endExclusive = new Date(input.weekEnd);
      endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
      return ctx.prisma.pettyCash.findMany({
        where: { date: { gte: input.weekStart, lt: endExclusive } },
        include: pettyCashInclude,
        orderBy: { date: "asc" },
      });
    }),

  create: permissionProcedure("pettycash:create")
    .input(createPettyCashSchema)
    .mutation(async ({ ctx, input }) => {
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
              name: item.name ?? null,
              nameDhivehi: item.nameDhivehi ?? null,
            })),
          },
        },
        include: pettyCashInclude,
      });
    }),

  // Diff-aware update.
  //
  // Locked only when every assigned role is approved AND all five roles
  // are populated. Otherwise editable, with this preservation rule:
  // for each of the five roles, if the incoming `staffId` AND `amount`
  // match the existing row, keep the row and its approval state intact
  // (we still update `date` in place). If either differs, or the role
  // was added/removed, delete the old row and create a fresh one with
  // `isApproved = false`. If the discarded row had been approved, log a
  // `PC_ROLE_RESET_ON_EDIT` event so the timeline records why approval
  // disappeared.
  update: permissionProcedure("pettycash:update")
    .input(updatePettyCashSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.pettyCash.findUnique({
        where: { pettyCashNum: input.pettyCashNum },
        include: pettyCashInclude,
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Petty cash ${input.pettyCashNum} not found`,
        });
      }

      // Edit lock: fully approved petty cash records are final, unless
      // the actor has the `pettycash:edit_locked` override. `pettycash:update`
      // (the procedure-level gate) is still required.
      const allRoles = PC_ROLES.map((r) => existing[r]);
      const allAssigned = allRoles.every((r) => r !== null);
      const allApproved =
        allAssigned && allRoles.every((r) => r !== null && r.isApproved);
      if (
        allApproved &&
        !ctx.session.permissions?.includes("pettycash:edit_locked")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Petty cash is fully approved and locked from edits.",
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

      return ctx.prisma.$transaction(async (tx) => {
        // Classify each role: preserve, reset (delete + recreate), or noop.
        for (const role of PC_ROLES) {
          const existingRow = existing[role];
          const incoming = input[role] ?? null;

          if (!existingRow && !incoming) {
            // Was empty, still empty. Nothing to do.
            continue;
          }

          if (existingRow && incoming) {
            const sameStaff = existingRow.staffId === incoming.staffId;
            const sameAmount = amountUnchanged(
              existingRow.amount,
              incoming.amount ?? null,
            );
            if (sameStaff && sameAmount) {
              // Preserve approval state. Update only the transaction date
              // (which is form-supplied and unrelated to approval).
              await tx.pettyCashStaff.update({
                where: { id: existingRow.id },
                data: { date: incoming.date },
              });
              continue;
            }
          }

          // Reset path. If the old row was approved, log a timeline event
          // before deleting so the audit trail explains the missing
          // signature on a previously-completed role.
          if (existingRow) {
            if (existingRow.isApproved) {
              await tx.approvalEvent.create({
                data: {
                  kind: "PC_ROLE_RESET_ON_EDIT",
                  pettyCashId: existing.id,
                  pettyCashRole: role,
                  actorId: ctx.session.user.id,
                },
              });
            }
            // Detach FK first, then delete the orphaned row.
            await tx.pettyCash.update({
              where: { id: existing.id },
              data: { [PC_ROLE_TO_FK[role]]: null },
            });
            await tx.pettyCashStaff.delete({ where: { id: existingRow.id } });
          }

          if (incoming) {
            await tx.pettyCash.update({
              where: { id: existing.id },
              data: {
                [role]: {
                  create: {
                    staffId: incoming.staffId,
                    amount: incoming.amount ?? null,
                    isApproved: false,
                    date: incoming.date,
                  },
                },
              },
            });
          }
        }

        // Items use the existing wholesale delete-recreate — they're not
        // tied to approval state.
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
        // Cascade clears items + approvalEvents; explicitly delete the
        // role rows so they don't linger in petty_cash_staff after the
        // parent is gone.
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

  // ----- Approval workflow -----

  // Approve one role. Strict assignee gate (only the staff assigned to
  // that role on this PC). PC approvals are independent — any role can
  // approve in any order.
  approveRole: protectedProcedure
    .input(approveRoleSchema)
    .mutation(async ({ ctx, input }) => {
      const pc = await ctx.prisma.pettyCash.findUnique({
        where: { pettyCashNum: input.pettyCashNum },
        include: pettyCashInclude,
      });
      if (!pc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Petty cash ${input.pettyCashNum} not found`,
        });
      }

      const row = pc[input.role as PCRoleSchemaInput];
      if (!row) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Role ${input.role} is not assigned on this petty cash.`,
        });
      }
      if (row.staffId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the assigned staff can approve this role.",
        });
      }
      if (row.isApproved) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This role has already been approved.",
        });
      }
      await assertActorHasSignature(ctx.prisma, ctx.session.user.id);

      return ctx.prisma.$transaction(async (tx) => {
        await tx.approvalEvent.create({
          data: {
            kind: "PC_ROLE_APPROVED",
            pettyCashId: pc.id,
            pettyCashRole: input.role,
            actorId: ctx.session.user.id,
          },
        });
        await tx.pettyCashStaff.update({
          where: { id: row.id },
          data: {
            isApproved: true,
            approvedAt: new Date(),
            // A previously-rejected role being re-approved: clear the
            // rejection metadata so the UI doesn't show both states.
            rejectedAt: null,
            rejectionComment: null,
          },
        });
        return tx.pettyCash.findUnique({
          where: { id: pc.id },
          include: pettyCashInclude,
        });
      });
    }),

  // Reject one role. Assignee gate. `isApproved` stays false; we just
  // record the rejection timestamp + optional comment. The role can be
  // re-approved later — no state change beyond timeline + flags.
  rejectRole: protectedProcedure
    .input(rejectRoleSchema)
    .mutation(async ({ ctx, input }) => {
      const pc = await ctx.prisma.pettyCash.findUnique({
        where: { pettyCashNum: input.pettyCashNum },
        include: pettyCashInclude,
      });
      if (!pc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Petty cash ${input.pettyCashNum} not found`,
        });
      }

      const row = pc[input.role as PCRoleSchemaInput];
      if (!row) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Role ${input.role} is not assigned on this petty cash.`,
        });
      }
      if (row.staffId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the assigned staff can reject this role.",
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        await tx.approvalEvent.create({
          data: {
            kind: "PC_ROLE_REJECTED",
            pettyCashId: pc.id,
            pettyCashRole: input.role,
            actorId: ctx.session.user.id,
            comment: input.comment ?? null,
          },
        });
        await tx.pettyCashStaff.update({
          where: { id: row.id },
          data: {
            isApproved: false,
            approvedAt: null,
            rejectedAt: new Date(),
            rejectionComment: input.comment ?? null,
          },
        });
        return tx.pettyCash.findUnique({
          where: { id: pc.id },
          include: pettyCashInclude,
        });
      });
    }),

  // PDF payload — same as getByNum plus a base64 signature map keyed by
  // role. Only approved roles get a signature; un-approved ones stay
  // null so the PDF renders blank cells where appropriate.
  pdfPayload: permissionProcedure("pettycash:read")
    .input(getPettyCashByNumSchema)
    .query(async ({ ctx, input }) => {
      const pc = await ctx.prisma.pettyCash.findUnique({
        where: { pettyCashNum: input.pettyCashNum },
        include: pettyCashInclude,
      });
      if (!pc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Petty cash ${input.pettyCashNum} not found`,
        });
      }

      const signatures = Object.fromEntries(
        await Promise.all(
          PC_ROLES.map(async (role) => {
            const row = pc[role];
            if (!row || !row.isApproved) return [role, null] as const;
            return [
              role,
              await getSignatureDataUrl(ctx.prisma, row.staffId),
            ] as const;
          }),
        ),
      ) as Record<PCRole, string | null>;

      return { ...pc, signatures };
    }),
});
