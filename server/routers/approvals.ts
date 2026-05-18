import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import type { PCRole } from "../lib/approval";

// The "did the user act on this" history filter — explicitly excludes
// preparer / edit events (SENT_FOR_VERIFICATION, CALLED_BACK,
// PC_ROLE_RESET_ON_EDIT) so the history surface stays focused on actual
// approve / reject decisions.
const HISTORY_KINDS = [
  "VERIFIED",
  "AUTHORISED_ONE",
  "AUTHORISED_TWO",
  "REJECTED",
  "PC_ROLE_APPROVED",
  "PC_ROLE_REJECTED",
] as const;

// "Currently waiting on this user at the current stage" — strict reading
// of pending. The status check pairs with the assignee check so users
// assigned to later stages don't see PVs that haven't reached them yet.
function pendingPvWhere(userId: string) {
  return {
    OR: [
      { status: "PENDING_VERIFICATION" as const, verifiedById: userId },
      { status: "PENDING_AUTHORISATION_ONE" as const, authorisedByOneId: userId },
      { status: "PENDING_AUTHORISATION_TWO" as const, authorisedByTwoId: userId },
    ],
  };
}

// `rejectedAt: null` so a row the user has already rejected isn't shown
// back to them as still pending — it'll re-appear if anyone re-approves
// it (which resets `rejectedAt` in the approveRole resolver).
function pendingPcRoleWhere(userId: string) {
  return {
    staffId: userId,
    isApproved: false,
    rejectedAt: null,
  };
}

// Which of the five back-relations on PettyCashStaff is set tells us the
// role name. Exactly one is non-null per row (enforced by the unique FKs
// on the PettyCash side).
function derivePcRole(row: {
  handledFor: { id: string } | null;
  procurementApprovedFor: { id: string } | null;
  budgetCheckedFor: { id: string } | null;
  balanceHandedOverFor: { id: string } | null;
  balanceCollectedFor: { id: string } | null;
}): PCRole | null {
  if (row.handledFor) return "handledBy";
  if (row.procurementApprovedFor) return "procurementApprovedBy";
  if (row.budgetCheckedFor) return "budgetCheckedBy";
  if (row.balanceHandedOverFor) return "balanceHandedOverBy";
  if (row.balanceCollectedFor) return "balanceCollectedBy";
  return null;
}

export const approvalsRouter = router({
  // Tiny query for the sidebar badge. No record-level details — just a
  // sum across the two pending sources.
  pendingCount: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const [pvCount, pcCount] = await Promise.all([
      ctx.prisma.pV.count({ where: pendingPvWhere(userId) }),
      ctx.prisma.pettyCashStaff.count({ where: pendingPcRoleWhere(userId) }),
    ]);
    return pvCount + pcCount;
  }),

  // Full data for the Pending tab.
  pending: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [pvs, pcRows] = await Promise.all([
      ctx.prisma.pV.findMany({
        where: pendingPvWhere(userId),
        include: {
          preparedBy: { select: { id: true, name: true, designation: true } },
          verifiedBy: { select: { id: true, name: true, designation: true } },
          authorisedByOne: { select: { id: true, name: true, designation: true } },
          authorisedByTwo: { select: { id: true, name: true, designation: true } },
          invoices: { select: { invoiceTotal: true } },
        },
        // Oldest first — emphasises urgency.
        orderBy: { updatedAt: "asc" },
      }),
      ctx.prisma.pettyCashStaff.findMany({
        where: pendingPcRoleWhere(userId),
        include: {
          handledFor: true,
          procurementApprovedFor: true,
          budgetCheckedFor: true,
          balanceHandedOverFor: true,
          balanceCollectedFor: true,
        },
      }),
    ]);

    // Reshape PC rows into a flat list of { pettyCash, role, row }. Drop
    // any orphan rows (back-relations all null) — shouldn't happen given
    // the schema but defensive.
    const pcRoles = pcRows
      .map((row) => {
        const role = derivePcRole(row);
        if (!role) return null;
        const pettyCash =
          row.handledFor ??
          row.procurementApprovedFor ??
          row.budgetCheckedFor ??
          row.balanceHandedOverFor ??
          row.balanceCollectedFor;
        if (!pettyCash) return null;
        return {
          pettyCash,
          role,
          row: {
            id: row.id,
            staffId: row.staffId,
            amount: row.amount,
            isApproved: row.isApproved,
            date: row.date,
            approvedAt: row.approvedAt,
            rejectedAt: row.rejectedAt,
            rejectionComment: row.rejectionComment,
          },
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort(
        (a, b) =>
          new Date(a.pettyCash.date).getTime() -
          new Date(b.pettyCash.date).getTime(),
      );

    return { pvs, pcRoles };
  }),

  // Reverse-chronological list of approve/reject events authored by
  // this user. Capped at 100 by default; the param is exposed so an
  // admin reviewer could ask for more in the future.
  history: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(200).default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.approvalEvent.findMany({
        where: {
          actorId: ctx.session.user.id,
          kind: { in: [...HISTORY_KINDS] },
        },
        include: {
          pv: {
            select: {
              id: true,
              pvNum: true,
              vendor: true,
              status: true,
            },
          },
          pettyCash: {
            select: {
              id: true,
              pettyCashNum: true,
              sectionUnit: true,
              formNum: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),
});

export type { PCRole };
