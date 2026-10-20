import { router, protectedProcedure, permissionProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  createCeaSchema,
  updateCeaSchema,
  ceaByNumSchema,
  nextCeaNumSchema,
  ceaLiveSourceSchema,
  type CreateCeaInput,
} from "../schemas/cea.schema";
import { assertActorHasSignature, getSignatureDataUrl } from "../lib/approval";
import { resolveGlAccountIds } from "../lib/glAccounts";
import { getAssetCoding, getOfficeStamp } from "../lib/settings";
import { assertProcurementSlot } from "../lib/procurement";
import {
  ceaSignProblem,
  nextCeaNum,
  peSource,
  resolveCea,
  type CeaPeSource,
  type CeaRow,
} from "@/lib/cea";

// The parts of a price evaluation a CEA takes its live values from.
const peSelect = {
  select: {
    evalNum: true,
    section: true,
    budgetBalance: true,
    gstRate: true,
    selectedVendor: true,
    glAccountId: true,
    glAccount: { select: { code: true, longTextEn: true } },
    vendors: { orderBy: { position: "asc" } },
    items: { orderBy: { position: "asc" }, include: { quotes: true } },
  },
} as const;

const baseInclude = {
  glAccount: { select: { code: true, longTextEn: true } },
  requestedBy: {
    select: { id: true, name: true, designation: true, dhivehiName: true, dhivehiDesignation: true },
  },
  items: { orderBy: { position: "asc" } },
  procurement: { select: { id: true, title: true, priceEvaluation: peSelect } },
} as const;

const fullInclude = {
  ...baseInclude,
  approvalEvents: {
    include: { actor: { select: { id: true, name: true, designation: true } } },
    orderBy: { createdAt: "asc" },
  },
} as const;

type WithPe = Prisma.CapitalExpenditureGetPayload<{ include: typeof baseInclude }>;

// The CEA with its procurement trimmed to a back-link and the values it
// shows resolved (live from the price evaluation, or stored).
function shape<T extends WithPe>(cea: T) {
  const { procurement, ...rest } = cea;
  const pe = procurement?.priceEvaluation ? peSource(procurement.priceEvaluation) : null;
  return {
    ...rest,
    procurement: procurement ? { id: procurement.id, title: procurement.title } : null,
    resolved: resolveCea(cea, pe),
  };
}

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

async function procurementPe(db: Db, procurementId: string | null | undefined) {
  if (!procurementId) return null;
  const p = await db.procurement.findUnique({
    where: { id: procurementId },
    select: { priceEvaluation: peSelect },
  });
  return p?.priceEvaluation ? peSource(p.priceEvaluation) : null;
}

const inputRows = (items: CreateCeaInput["items"]): CeaRow[] =>
  items.map((it, position) => ({
    position,
    description: it.description?.trim() || null,
    qty: it.qty ?? null,
    cost: it.cost ?? null,
    onHand: it.onHand?.trim() || null,
    acquired: it.acquired?.trim() || null,
    condition: it.condition?.trim() || null,
    reason: it.reason?.trim() || null,
  }));

// What to store: the price evaluation's values while it supplies them (so a
// later unlink keeps the last ones), otherwise what was entered.
async function storedValues(
  db: Db,
  input: Omit<CreateCeaInput, "ceaNum" | "procurementId">,
  pe: CeaPeSource | null,
) {
  const rows = inputRows(input.items);
  if (pe) {
    const r = resolveCea(
      { status: "DRAFT", section: null, glAccountId: null, glAccount: null, budgetBalance: null, items: rows },
      pe,
    );
    return { section: r.section, glAccountId: r.glAccountId, budgetBalance: r.budgetBalance, rows: r.rows };
  }
  const glAccountId = input.glCode
    ? (await resolveGlAccountIds(db, [input.glCode])).get(input.glCode)!
    : null;
  return {
    section: input.section?.trim() || null,
    glAccountId,
    budgetBalance: input.budgetBalance ?? null,
    rows,
  };
}

async function writeRows(tx: Tx, ceaId: string, rows: CeaRow[]) {
  await tx.ceaItem.deleteMany({ where: { ceaId } });
  if (rows.length) {
    await tx.ceaItem.createMany({
      data: rows.map((r, position) => ({
        ceaId,
        position,
        description: r.description,
        qty: r.qty,
        cost: r.cost,
        onHand: r.onHand,
        acquired: r.acquired,
        condition: r.condition,
        reason: r.reason,
      })),
    });
  }
}

const feData = (input: Omit<CreateCeaInput, "ceaNum">) => ({
  feNameEn: input.feNameEn?.trim() || null,
  feNameDv: input.feNameDv?.trim() || null,
  feDesignationEn: input.feDesignationEn?.trim() || null,
  feDesignationDv: input.feDesignationDv?.trim() || null,
});

const TX_OPTIONS = { timeout: 15000 } as const;

async function assertStaff(db: Db, staffId: string | null | undefined) {
  if (!staffId) return;
  const staff = await db.staff.findUnique({ where: { id: staffId }, select: { id: true } });
  if (!staff) throw new TRPCError({ code: "BAD_REQUEST", message: "Pick the requester from the staff list." });
}

async function findOr404(db: Db, ceaNum: string) {
  const cea = await db.capitalExpenditure.findUnique({ where: { ceaNum }, include: baseInclude });
  if (!cea) throw new TRPCError({ code: "NOT_FOUND", message: `CEA form ${ceaNum} not found` });
  return cea;
}

export const ceaRouter = router({
  list: permissionProcedure("cea:read").query(async ({ ctx }) => {
    const rows = await ctx.prisma.capitalExpenditure.findMany({
      include: baseInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(shape);
  }),

  getByNum: permissionProcedure("cea:read")
    .input(ceaByNumSchema)
    .query(async ({ ctx, input }) => {
      const cea = await ctx.prisma.capitalExpenditure.findUnique({
        where: { ceaNum: input.ceaNum },
        include: fullInclude,
      });
      if (!cea) throw new TRPCError({ code: "NOT_FOUND", message: `CEA form ${input.ceaNum} not found` });
      return shape(cea);
    }),

  nextNumber: permissionProcedure("cea:create")
    .input(nextCeaNumSchema)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.capitalExpenditure.findMany({
        where: { ceaNum: { contains: `/${input.year}/` } },
        select: { ceaNum: true },
      });
      return nextCeaNum(input.year, rows.map((r) => r.ceaNum));
    }),

  // What a new CEA in this procurement takes from its price evaluation (null
  // when it has none), so the create form can show it before saving.
  liveSource: permissionProcedure("cea:create")
    .input(ceaLiveSourceSchema)
    .query(async ({ ctx, input }) => procurementPe(ctx.prisma, input.procurementId)),

  // Values the price evaluation supplies are taken from it, whatever was sent.
  create: permissionProcedure("cea:create")
    .input(createCeaSchema)
    .mutation(async ({ ctx, input }) => {
      const { ceaNum, procurementId, ...fields } = input;
      if (await ctx.prisma.capitalExpenditure.findUnique({ where: { ceaNum }, select: { id: true } })) {
        throw new TRPCError({ code: "CONFLICT", message: `CEA form ${ceaNum} already exists` });
      }
      await assertProcurementSlot(ctx.prisma, procurementId, "cea", ctx.session.permissions);
      await assertStaff(ctx.prisma, fields.requestedById);

      const pe = await procurementPe(ctx.prisma, procurementId);
      const values = await storedValues(ctx.prisma, fields, pe);
      const { businessArea } = await getAssetCoding(ctx.prisma);

      await ctx.prisma.$transaction(async (tx) => {
        const cea = await tx.capitalExpenditure.create({
          data: {
            ceaNum,
            date: fields.date,
            businessArea,
            section: values.section,
            glAccountId: values.glAccountId,
            budgetBalance: values.budgetBalance,
            ...feData(fields),
            requestedById: fields.requestedById ?? null,
            procurementId: procurementId ?? null,
          },
          select: { id: true },
        });
        await writeRows(tx, cea.id, values.rows);
      }, TX_OPTIONS);
      return { ceaNum };
    }),

  // Drafts only, unless the editor holds the edit_locked override.
  update: permissionProcedure("cea:update")
    .input(updateCeaSchema)
    .mutation(async ({ ctx, input }) => {
      const { ceaNum, ...fields } = input;
      const existing = await findOr404(ctx.prisma, ceaNum);
      if (existing.status !== "DRAFT" && !ctx.session.permissions?.includes("cea:edit_locked")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This CEA form has been signed: reopen it before editing.",
        });
      }
      const requestedById = fields.requestedById ?? null;
      // A signed form carries its requester's signature.
      if (existing.status !== "DRAFT" && requestedById !== existing.requestedById) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This form is signed by its requester: reopen it to change who requests it.",
        });
      }
      await assertStaff(ctx.prisma, requestedById);
      // A signed form keeps its frozen values; only drafts follow the evaluation.
      const pe =
        existing.status === "DRAFT" && existing.procurement?.priceEvaluation
          ? peSource(existing.procurement.priceEvaluation)
          : null;
      const values = await storedValues(ctx.prisma, fields, pe);

      await ctx.prisma.$transaction(async (tx) => {
        await tx.capitalExpenditure.update({
          where: { id: existing.id },
          data: {
            date: fields.date,
            section: values.section,
            glAccountId: values.glAccountId,
            budgetBalance: values.budgetBalance,
            ...feData(fields),
            requestedById,
          },
        });
        await writeRows(tx, existing.id, values.rows);
      }, TX_OPTIONS);
      return { ceaNum };
    }),

  delete: permissionProcedure("cea:delete")
    .input(ceaByNumSchema)
    .mutation(async ({ ctx, input }) => {
      const cea = await findOr404(ctx.prisma, input.ceaNum);
      await ctx.prisma.capitalExpenditure.delete({ where: { id: cea.id } });
      return { success: true };
    }),

  // The requester signs. The values shown (live or stored) are frozen onto the
  // form in the same write, so a signed form never changes underneath.
  sign: protectedProcedure
    .input(ceaByNumSchema)
    .mutation(async ({ ctx, input }) => {
      const cea = await findOr404(ctx.prisma, input.ceaNum);
      const userId = ctx.session.user.id;
      if (cea.status !== "DRAFT") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This CEA form is already signed." });
      }
      if (!cea.requestedById) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Choose who is requesting this form before signing." });
      }
      if (cea.requestedById !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the requester can sign this form." });
      }
      const { resolved } = shape(cea);
      const problem = ceaSignProblem(resolved);
      if (problem) throw new TRPCError({ code: "BAD_REQUEST", message: problem });
      await assertActorHasSignature(ctx.prisma, userId);

      await ctx.prisma.$transaction(async (tx) => {
        await tx.capitalExpenditure.update({
          where: { id: cea.id },
          data: {
            section: resolved.section,
            glAccountId: resolved.glAccountId,
            budgetBalance: resolved.budgetBalance,
            status: "SIGNED",
            signedAt: new Date(),
          },
        });
        await writeRows(tx, cea.id, resolved.rows);
        await tx.approvalEvent.create({
          data: {
            kind: "CEA_SIGNED",
            capitalExpenditureId: cea.id,
            actorId: userId,
            comment: resolved.sourceEvalNum ? `Values from price evaluation ${resolved.sourceEvalNum}` : null,
          },
        });
      }, TX_OPTIONS);
      return { status: "SIGNED" as const };
    }),

  // Back to draft: the requester, or anyone with the override.
  reopen: protectedProcedure
    .input(ceaByNumSchema)
    .mutation(async ({ ctx, input }) => {
      const cea = await findOr404(ctx.prisma, input.ceaNum);
      const userId = ctx.session.user.id;
      if (cea.status !== "SIGNED") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only a signed CEA form can be reopened." });
      }
      if (cea.requestedById !== userId && !ctx.session.permissions?.includes("cea:edit_locked")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the requester can reopen this form." });
      }
      await ctx.prisma.$transaction([
        ctx.prisma.approvalEvent.create({
          data: { kind: "CEA_REOPENED", capitalExpenditureId: cea.id, actorId: userId },
        }),
        ctx.prisma.capitalExpenditure.update({
          where: { id: cea.id },
          data: { status: "DRAFT", signedAt: null },
        }),
      ]);
      return { status: "DRAFT" as const };
    }),

  // The requester's signature and the office stamp only print once signed.
  pdfPayload: permissionProcedure("cea:read")
    .input(ceaByNumSchema)
    .query(async ({ ctx, input }) => {
      const cea = shape(await findOr404(ctx.prisma, input.ceaNum));
      const signed = cea.status === "SIGNED";
      const [signature, stamp] = await Promise.all([
        signed && cea.requestedById ? getSignatureDataUrl(ctx.prisma, cea.requestedById) : Promise.resolve(null),
        signed ? getOfficeStamp(ctx.prisma) : Promise.resolve(null),
      ]);
      return { ...cea, signature, stamp };
    }),
});
