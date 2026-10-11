import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import type { PCRole } from "../lib/approval";
import { computeComparison } from "@/lib/price-eval";

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
  "PE_BUDGET_CHECKED",
  "PE_CHECKED",
  "PE_APPROVED",
  "PE_REJECTED",
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

// Price evaluations awaiting this user's signature at the current stage.
function pendingPriceEvalWhere(userId: string) {
  return {
    OR: [
      { status: "PENDING_BUDGET_CHECK" as const, budgetCheckedById: userId },
      { status: "PENDING_CHECK" as const, checkedById: userId },
      { status: "PENDING_APPROVAL" as const, approvedById: userId },
    ],
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
  // sum across the pending sources.
  pendingCount: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const [pvCount, pcCount, peCount] = await Promise.all([
      ctx.prisma.pV.count({ where: pendingPvWhere(userId) }),
      ctx.prisma.pettyCashStaff.count({ where: pendingPcRoleWhere(userId) }),
      ctx.prisma.priceEvaluation.count({ where: pendingPriceEvalWhere(userId) }),
    ]);
    return pvCount + pcCount + peCount;
  }),

  // Full data for the Pending tab.
  pending: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [pvs, pcRows, peRows] = await Promise.all([
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
      ctx.prisma.priceEvaluation.findMany({
        where: pendingPriceEvalWhere(userId),
        include: {
          preparedBy: { select: { id: true, name: true, designation: true } },
          vendors: { orderBy: { position: "asc" } },
          items: { orderBy: { position: "asc" }, include: { quotes: true } },
        },
        orderBy: { updatedAt: "asc" },
      }),
    ]);

    // A compact card per evaluation: what's being bought, from whom, for how
    // much (MVR, including GST where charged).
    const priceEvals = peRows.map((pe) => {
      const positionOf = new Map(pe.vendors.map((v) => [v.id, v.position]));
      const items = pe.items.map((it) => {
        const rates: (number | null)[] = pe.vendors.map(() => null);
        for (const q of it.quotes) {
          const v = positionOf.get(q.vendorId);
          if (v !== undefined) rates[v] = q.rate;
        }
        return { qty: it.qty, rates };
      });
      const comparison = computeComparison(items, pe.vendors, pe.gstRate);
      const chosen = pe.selectedVendor;
      return {
        evalNum: pe.evalNum,
        section: pe.section,
        date: pe.date,
        status: pe.status,
        updatedAt: pe.updatedAt,
        preparedBy: pe.preparedBy,
        itemsSummary: pe.items.map((it) => it.name).join(", "),
        vendorName: chosen != null ? (pe.vendors[chosen]?.name ?? null) : null,
        total: chosen != null ? (comparison.vendors[chosen]?.total ?? null) : null,
      };
    });

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

    return { pvs, pcRoles, priceEvals };
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
          priceEvaluation: {
            select: {
              id: true,
              evalNum: true,
              section: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),
});

export type { PCRole };
