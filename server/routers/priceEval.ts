import { router, protectedProcedure, permissionProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import type {
  Prisma,
  PrismaClient,
  PriceEvalStatus,
  ApprovalEventKind,
} from "@prisma/client";
import {
  createPriceEvalSchema,
  updatePriceEvalSchema,
  priceEvalByNumSchema,
  nextEvalNumSchema,
  budgetCheckSchema,
  rejectPriceEvalSchema,
  type CreatePriceEvalInput,
} from "../schemas/priceEval.schema";
import { assertActorHasSignature, getSignatureDataUrl } from "../lib/approval";
import { resolveGlAccountIds } from "../lib/glAccounts";
import { getGstRate } from "../lib/settings";
import {
  STAGE_ROLE,
  computeComparison,
  isPendingStatus,
  nextEvalNum,
  type PeRole,
} from "@/lib/price-eval";

const staffSelect = {
  select: {
    id: true,
    name: true,
    designation: true,
    dhivehiName: true,
    dhivehiDesignation: true,
  },
} as const;

const baseInclude = {
  glAccount: { select: { code: true, longTextEn: true, longTextDv: true } },
  preparedBy: staffSelect,
  budgetCheckedBy: staffSelect,
  checkedBy: staffSelect,
  approvedBy: staffSelect,
  rejectedBy: staffSelect,
  vendors: { orderBy: { position: "asc" } },
  items: { orderBy: { position: "asc" }, include: { quotes: true } },
} as const;

const fullInclude = {
  ...baseInclude,
  approvalEvents: {
    include: {
      actor: { select: { id: true, name: true, designation: true } },
    },
    orderBy: { createdAt: "asc" },
  },
} as const;

type WithChildren = Prisma.PriceEvaluationGetPayload<{ include: typeof baseInclude }>;

// Items come back with each vendor's unit price laid out by vendor position
// (`rates[v]`, null = not quoted), which is how the form, the detail page and
// the PDF all read them.
type ShapedItem = Omit<WithChildren["items"][number], "quotes"> & {
  rates: (number | null)[];
};

function shape<T extends WithChildren>(pe: T): Omit<T, "items"> & { items: ShapedItem[] } {
  const positionOf = new Map(pe.vendors.map((v) => [v.id, v.position]));
  return {
    ...pe,
    items: pe.items.map(({ quotes, ...item }) => {
      const rates: (number | null)[] = pe.vendors.map(() => null);
      for (const q of quotes) {
        const v = positionOf.get(q.vendorId);
        if (v !== undefined) rates[v] = q.rate;
      }
      return { ...item, rates };
    }),
  };
}

const roleField = {
  preparedBy: "preparedById",
  budgetCheckedBy: "budgetCheckedById",
  checkedBy: "checkedById",
  approvedBy: "approvedById",
} as const satisfies Record<PeRole, string>;

type Tx = Prisma.TransactionClient;

// Vendors, items and quotes in three bulk writes.
async function createChildren(
  tx: Tx,
  evaluationId: string,
  input: Pick<CreatePriceEvalInput, "vendors" | "items">,
) {
  const vendors = await tx.priceEvalVendor.createManyAndReturn({
    data: input.vendors.map((v, position) => ({ ...v, position, evaluationId })),
    select: { id: true, position: true },
  });
  const vendorIds = new Map(vendors.map((v) => [v.position, v.id]));

  const items = await tx.priceEvalItem.createManyAndReturn({
    data: input.items.map((it, position) => ({
      name: it.name,
      qty: it.qty,
      position,
      evaluationId,
    })),
    select: { id: true, position: true },
  });

  const quotes = items.flatMap((item) =>
    input.items[item.position].rates.flatMap((rate, v) =>
      rate == null ? [] : [{ rate, itemId: item.id, vendorId: vendorIds.get(v)! }],
    ),
  );
  if (quotes.length > 0) await tx.priceEvalQuote.createMany({ data: quotes });
}

// Bulk writes keep this well under the limit; the headroom covers a slow link.
const TX_OPTIONS = { timeout: 15000 } as const;

export const priceEvalRouter = router({
  list: permissionProcedure("priceeval:read").query(async ({ ctx }) => {
    const rows = await ctx.prisma.priceEvaluation.findMany({
      include: baseInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(shape);
  }),

  getByNum: permissionProcedure("priceeval:read")
    .input(priceEvalByNumSchema)
    .query(async ({ ctx, input }) => {
      const pe = await ctx.prisma.priceEvaluation.findUnique({
        where: { evalNum: input.evalNum },
        include: fullInclude,
      });
      if (!pe) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Price evaluation ${input.evalNum} not found`,
        });
      }
      return shape(pe);
    }),

  // The next free "YYYY-N" for the create form. Editable there.
  nextNumber: permissionProcedure("priceeval:create")
    .input(nextEvalNumSchema)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.priceEvaluation.findMany({
        where: { evalNum: { startsWith: `${input.year}-` } },
        select: { evalNum: true },
      });
      return nextEvalNum(input.year, rows.map((r) => r.evalNum));
    }),

  create: permissionProcedure("priceeval:create")
    .input(createPriceEvalSchema)
    .mutation(async ({ ctx, input }) => {
      const { evalNum, glCode, vendors, items, ...fields } = input;

      const existing = await ctx.prisma.priceEvaluation.findUnique({
        where: { evalNum },
        select: { id: true },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Price evaluation ${evalNum} already exists`,
        });
      }

      const glIds = await resolveGlAccountIds(ctx.prisma, [glCode]);
      const gstRate = await getGstRate(ctx.prisma);

      const id = await ctx.prisma.$transaction(async (tx) => {
        const pe = await tx.priceEvaluation.create({
          data: { evalNum, glAccountId: glIds.get(glCode)!, gstRate, ...fields },
          select: { id: true },
        });
        await createChildren(tx, pe.id, { vendors, items });
        return pe.id;
      }, TX_OPTIONS);

      // The id lets the form attach queued quotation files.
      return { id, evalNum };
    }),

  // Rewrites vendors, items and quotes. Only drafts, unless the editor holds
  // the edit_locked override. Drafts take the current global GST rate; a
  // sent evaluation keeps the rate it was sent with.
  update: permissionProcedure("priceeval:update")
    .input(updatePriceEvalSchema)
    .mutation(async ({ ctx, input }) => {
      const { evalNum, glCode, vendors, items, ...fields } = input;

      const existing = await ctx.prisma.priceEvaluation.findUnique({
        where: { evalNum },
        select: { id: true, status: true, gstRate: true },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Price evaluation ${evalNum} not found`,
        });
      }
      if (
        existing.status !== "DRAFT" &&
        !ctx.session.permissions?.includes("priceeval:edit_locked")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This evaluation has been sent: call it back to draft before editing.",
        });
      }

      const glIds = await resolveGlAccountIds(ctx.prisma, [glCode]);
      const gstRate =
        existing.status === "DRAFT" ? await getGstRate(ctx.prisma) : existing.gstRate;

      await ctx.prisma.$transaction(async (tx) => {
        await tx.priceEvalItem.deleteMany({ where: { evaluationId: existing.id } });
        await tx.priceEvalVendor.deleteMany({ where: { evaluationId: existing.id } });
        await tx.priceEvaluation.update({
          where: { id: existing.id },
          data: { glAccountId: glIds.get(glCode)!, gstRate, ...fields },
        });
        await createChildren(tx, existing.id, { vendors, items });
      }, TX_OPTIONS);

      return { evalNum };
    }),

  delete: permissionProcedure("priceeval:delete")
    .input(priceEvalByNumSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.priceEvaluation.findUnique({
        where: { evalNum: input.evalNum },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Price evaluation ${input.evalNum} not found`,
        });
      }
      // Vendors, items, quotes and timeline events cascade.
      await ctx.prisma.priceEvaluation.delete({ where: { id: existing.id } });
      return { success: true };
    }),

  // DRAFT → PENDING_BUDGET_CHECK. Sending is the preparer's signature, so
  // only the assigned preparer can do it. Freezes the GST rate.
  send: protectedProcedure
    .input(priceEvalByNumSchema)
    .mutation(async ({ ctx, input }) => {
      const pe = await findWithChildren(ctx.prisma, input.evalNum);
      const userId = ctx.session.user.id;

      if (pe.status !== "DRAFT") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only a draft evaluation can be sent.",
        });
      }
      if (!pe.preparedById) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Choose who prepared this evaluation before sending it.",
        });
      }
      if (pe.preparedById !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the person who prepared this evaluation can send it.",
        });
      }

      const gstRate = await getGstRate(ctx.prisma);
      const problem = sendProblem(shape(pe), gstRate);
      if (problem) throw new TRPCError({ code: "BAD_REQUEST", message: problem });

      await assertActorHasSignature(ctx.prisma, userId);

      return transition(ctx.prisma, pe.id, userId, "PE_SENT", {
        status: "PENDING_BUDGET_CHECK",
        sentAt: new Date(),
        gstRate,
        rejectedAt: null,
        rejectedById: null,
        rejectionComment: null,
      });
    }),

  // Any pending stage → DRAFT. The preparer, or anyone who may edit.
  callback: protectedProcedure
    .input(priceEvalByNumSchema)
    .mutation(async ({ ctx, input }) => {
      const pe = await findOr404(ctx.prisma, input.evalNum);
      const userId = ctx.session.user.id;

      if (!isPendingStatus(pe.status)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only an evaluation that is awaiting a signature can be called back.",
        });
      }
      const canEdit = ctx.session.permissions?.includes("priceeval:update");
      if (pe.preparedById !== userId && !canEdit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the preparer can call this evaluation back.",
        });
      }

      return transition(ctx.prisma, pe.id, userId, "PE_CALLED_BACK", {
        status: "DRAFT",
        ...CLEARED_STAMPS,
      });
    }),

  // Budget checker: confirms the code balance and whether the budget can
  // cover it, then signs. → PENDING_CHECK.
  budgetCheck: protectedProcedure
    .input(budgetCheckSchema)
    .mutation(async ({ ctx, input }) => {
      const pe = await assertStage(ctx, input.evalNum, "PENDING_BUDGET_CHECK");
      const balance = Math.round(input.budgetBalance * 100) / 100;
      return transition(
        ctx.prisma,
        pe.id,
        ctx.session.user.id,
        "PE_BUDGET_CHECKED",
        {
          status: "PENDING_CHECK",
          budgetCheckedAt: new Date(),
          budgetBalance: balance,
          budgetAvailable: input.budgetAvailable,
        },
        `Budget ${input.budgetAvailable ? "available" : "not available"} · code balance MVR ${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      );
    }),

  // Checker. → PENDING_APPROVAL.
  check: protectedProcedure
    .input(priceEvalByNumSchema)
    .mutation(async ({ ctx, input }) => {
      const pe = await assertStage(ctx, input.evalNum, "PENDING_CHECK");
      return transition(ctx.prisma, pe.id, ctx.session.user.id, "PE_CHECKED", {
        status: "PENDING_APPROVAL",
        checkedAt: new Date(),
      });
    }),

  // Approver (approval to spend). Final step → APPROVED.
  approve: protectedProcedure
    .input(priceEvalByNumSchema)
    .mutation(async ({ ctx, input }) => {
      const pe = await assertStage(ctx, input.evalNum, "PENDING_APPROVAL");
      return transition(ctx.prisma, pe.id, ctx.session.user.id, "PE_APPROVED", {
        status: "APPROVED",
        approvedAt: new Date(),
      });
    }),

  // The current stage's assignee sends it back to DRAFT with a comment.
  reject: protectedProcedure
    .input(rejectPriceEvalSchema)
    .mutation(async ({ ctx, input }) => {
      const pe = await findOr404(ctx.prisma, input.evalNum);
      const userId = ctx.session.user.id;

      const role = isPendingStatus(pe.status) ? STAGE_ROLE[pe.status] : null;
      if (!role || pe[roleField[role]] !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the person whose signature is awaited can reject this evaluation.",
        });
      }

      return transition(
        ctx.prisma,
        pe.id,
        userId,
        "PE_REJECTED",
        {
          status: "DRAFT",
          ...CLEARED_STAMPS,
          rejectedAt: new Date(),
          rejectedById: userId,
          rejectionComment: input.comment ?? null,
        },
        input.comment ?? null,
      );
    }),

  // Record plus each signatory's signature, included only once they've signed.
  pdfPayload: permissionProcedure("priceeval:read")
    .input(priceEvalByNumSchema)
    .query(async ({ ctx, input }) => {
      const pe = await findWithChildren(ctx.prisma, input.evalNum);
      const signed = (at: Date | null, staffId: string | null) =>
        at && staffId ? getSignatureDataUrl(ctx.prisma, staffId) : Promise.resolve(null);

      const [preparedBy, budgetCheckedBy, checkedBy, approvedBy] = await Promise.all([
        signed(pe.sentAt, pe.preparedById),
        signed(pe.budgetCheckedAt, pe.budgetCheckedById),
        signed(pe.checkedAt, pe.checkedById),
        signed(pe.approvedAt, pe.approvedById),
      ]);

      return {
        ...shape(pe),
        signatures: { preparedBy, budgetCheckedBy, checkedBy, approvedBy },
      };
    }),
});

// ----- helpers -----

type Db = PrismaClient;
type Shaped = ReturnType<typeof shape<WithChildren>>;

// Back to draft: every signature is cleared, and so is the budget checker's
// available/not answer. Their balance stays, to prefill the next check.
const CLEARED_STAMPS = {
  sentAt: null,
  budgetCheckedAt: null,
  checkedAt: null,
  approvedAt: null,
  budgetAvailable: null,
} as const;

async function findOr404(db: Db, evalNum: string) {
  const pe = await db.priceEvaluation.findUnique({ where: { evalNum } });
  if (!pe) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Price evaluation ${evalNum} not found`,
    });
  }
  return pe;
}

async function findWithChildren(db: Db, evalNum: string) {
  const pe = await db.priceEvaluation.findUnique({
    where: { evalNum },
    include: baseInclude,
  });
  if (!pe) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Price evaluation ${evalNum} not found`,
    });
  }
  return pe;
}

// The evaluation must be at `status`, and the caller must be that stage's
// assigned signatory with a signature on file.
async function assertStage(
  ctx: { prisma: Db; session: { user: { id: string } } },
  evalNum: string,
  status: keyof typeof STAGE_ROLE,
) {
  const pe = await findOr404(ctx.prisma, evalNum);
  if (pe.status !== status) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This evaluation isn't awaiting that signature.",
    });
  }
  if (pe[roleField[STAGE_ROLE[status]]] !== ctx.session.user.id) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the assigned signatory can sign at this stage.",
    });
  }
  await assertActorHasSignature(ctx.prisma, ctx.session.user.id);
  return pe;
}

// One workflow step: an approval-timeline event plus the status change.
async function transition(
  db: Db,
  id: string,
  actorId: string,
  kind: ApprovalEventKind,
  data: Prisma.PriceEvaluationUncheckedUpdateInput & { status: PriceEvalStatus },
  comment: string | null = null,
) {
  await db.$transaction([
    db.approvalEvent.create({
      data: { kind, priceEvaluationId: id, actorId, comment },
    }),
    db.priceEvaluation.update({ where: { id }, data }),
  ]);
  return { status: data.status };
}

// Why an evaluation can't be sent yet, or null when it's ready.
function sendProblem(pe: Shaped, gstRate: number): string | null {
  const missingSigner = (
    [
      ["budgetCheckedById", "budget checker"],
      ["checkedById", "checker"],
      ["approvedById", "approver"],
    ] as const
  ).find(([field]) => !pe[field]);
  if (missingSigner) return `Choose the ${missingSigner[1]} before sending.`;

  const unnamed = pe.vendors.filter((v) => !v.name.trim()).length;
  if (unnamed > 0) return "Name all three vendors before sending.";
  if (pe.items.length === 0) return "Add at least one item before sending.";

  const comparison = computeComparison(pe.items, pe.vendors, gstRate);
  const silent = pe.vendors.find((_, v) => !comparison.vendors[v].quotedAny);
  if (silent) return `${silent.name} has no prices — enter their quote before sending.`;

  if (pe.selectedVendor == null) return "Choose the vendor to buy from before sending.";
  if (!comparison.vendors[pe.selectedVendor]?.quotedAll) {
    return `${pe.vendors[pe.selectedVendor]?.name ?? "The chosen vendor"} hasn't quoted every item.`;
  }
  if (!pe.selectionReason?.trim()) return "Give the reason for choosing this vendor before sending.";
  return null;
}
