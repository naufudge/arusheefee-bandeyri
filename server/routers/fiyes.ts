import { TRPCError } from "@trpc/server";
import type { ApprovalEventKind, FiyesStatus, Prisma, PrismaClient } from "@prisma/client";
import { router, permissionProcedure, protectedProcedure } from "../trpc";
import {
  createFiyesSchema,
  fiyesFormSchema,
  fiyesMonthSchema,
  fiyesPeriodSchema,
  fiyesYearSchema,
  rejectFiyesSchema,
  updateFiyesSchema,
  type FiyesPayableInput,
} from "../schemas/fiyes.schema";
import { assertActorHasSignature, getSignatureDataUrl } from "../lib/approval";
import { monthPettyCash } from "../lib/petty-cash-balance";
import { buildFiyesWorkbook, returnData } from "../lib/fiyes-workbook";
import { sheetLayout } from "../lib/xlsx-layout";
import {
  fiyesFileName,
  fiyesForm,
  parsePeriod,
  periodHasStarted,
  periodKey,
  periodLabel,
  readEntries,
  returnTitle,
  type FiyesKind,
  type FiyesPeriod,
} from "@/lib/fiyes";
import { toMvrRounded } from "@/utils/currency";

type Db = PrismaClient;

const signatory = { select: { id: true, name: true, designation: true } } as const;

const fiyesInclude = {
  enteredBy: signatory,
  approvedBy: signatory,
  rejectedBy: signatory,
  payables: { orderBy: { position: "asc" } },
  approvalEvents: {
    include: { actor: signatory },
    orderBy: { createdAt: "asc" },
  },
} as const satisfies Prisma.FiyesReturnInclude;

/** UTC midnight of the day the client picked, so the printed date can't shift. */
const dayOnly = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const round2 = (n: number) => Math.round(n * 100) / 100;

function periodOr400(period: string): FiyesPeriod {
  const p = parsePeriod(period);
  if (!p) throw new TRPCError({ code: "BAD_REQUEST", message: `"${period}" isn't a Fiyes period` });
  return p;
}

async function findOr404(db: Db, period: string) {
  const ret = await db.fiyesReturn.findUnique({ where: { period }, include: fiyesInclude });
  if (!ret) {
    throw new TRPCError({ code: "NOT_FOUND", message: `No Fiyes return for ${periodLabel(periodOr400(period))}` });
  }
  return ret;
}

async function assertStaff(db: Db, ids: (string | null)[]) {
  const wanted = ids.filter((id): id is string => !!id);
  if (wanted.length === 0) return;
  const found = await db.staff.count({ where: { id: { in: wanted } } });
  if (found !== new Set(wanted).size) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Pick the signatories from the staff list." });
  }
}

// F19 rows: the server, not the client, works out the MVR amount.
const payableRows = (payables: FiyesPayableInput[]) =>
  payables.map((p, position) => {
    const rate = p.currency === "MVR" ? 1 : p.exchangeRate;
    return {
      position,
      invoiceNumber: p.invoiceNumber,
      invoiceDate: dayOnly(p.invoiceDate),
      vendorName: p.vendorName,
      vendorAccount: p.vendorAccount,
      details: p.details,
      currency: p.currency,
      exchangeRate: rate,
      amount: round2(p.amount),
      amountMvr: toMvrRounded(p.amount, rate),
    };
  });

const pettyCash = (n: number | null) => (n === null ? null : round2(n));

// Stored in canonical form: every line and column of the set's forms, trimmed and rounded.
const storedEntries = (kind: FiyesKind, entries: unknown) => readEntries(kind, entries) as Prisma.InputJsonObject;

function isUniqueViolation(e: unknown) {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

// One workflow step: the timeline event and the status change together.
async function transition(
  db: Db,
  id: string,
  actorId: string,
  kind: ApprovalEventKind,
  data: Prisma.FiyesReturnUncheckedUpdateInput & { status: FiyesStatus },
  comment: string | null = null,
) {
  await db.$transaction([
    db.approvalEvent.create({ data: { kind, fiyesReturnId: id, actorId, comment } }),
    db.fiyesReturn.update({ where: { id }, data }),
  ]);
  return { status: data.status };
}

const CLEARED_STAMPS = { sentAt: null, approvedAt: null } as const;

export const fiyesRouter = router({
  // A year's returns, for the filing calendar: its twelve monthly returns
  // and the yearly return reporting on that year.
  list: permissionProcedure("fiyes:read")
    .input(fiyesYearSchema)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.fiyesReturn.findMany({
        where: { year: input.year },
        select: {
          period: true,
          kind: true,
          year: true,
          month: true,
          status: true,
          documentDate: true,
          pettyCashOpening: true,
          pettyCashClosing: true,
          approvedAt: true,
          enteredBy: { select: { name: true } },
          payables: { select: { amountMvr: true } },
        },
        orderBy: { period: "asc" },
      });
      return rows.map(({ payables, ...r }) => ({
        ...r,
        payableCount: payables.length,
        payableTotal: round2(payables.reduce((s, p) => s + p.amountMvr, 0)),
      }));
    }),

  getByPeriod: permissionProcedure("fiyes:read")
    .input(fiyesPeriodSchema)
    .query(async ({ ctx, input }) => {
      const ret = await findOr404(ctx.prisma, input.period);
      return { ...ret, entries: readEntries(ret.kind, ret.entries) };
    }),

  // F01's suggested figures, counted as the petty cash register export does.
  pettyCashBalances: permissionProcedure("fiyes:read")
    .input(fiyesMonthSchema)
    .query(({ ctx, input }) => monthPettyCash(ctx.prisma, input.year, input.month)),

  // Who approved the latest return, to suggest for the next one.
  lastApprover: permissionProcedure("fiyes:create").query(async ({ ctx }) => {
    const last = await ctx.prisma.fiyesReturn.findFirst({
      where: { approvedById: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { approvedById: true },
    });
    return { approvedById: last?.approvedById ?? null };
  }),

  create: permissionProcedure("fiyes:create")
    .input(createFiyesSchema)
    .mutation(async ({ ctx, input }) => {
      const p: FiyesPeriod =
        input.kind === "MONTHLY"
          ? { kind: "MONTHLY", year: input.year, month: input.month }
          : { kind: "YEARLY", year: input.year, month: null };
      if (!periodHasStarted(p)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${periodLabel(p)} hasn't started yet, so its return can't be filed.`,
        });
      }
      const period = periodKey(p);
      if (await ctx.prisma.fiyesReturn.findUnique({ where: { period }, select: { id: true } })) {
        throw new TRPCError({ code: "CONFLICT", message: `A return for ${periodLabel(p)} already exists.` });
      }
      await assertStaff(ctx.prisma, [input.enteredById, input.approvedById]);

      try {
        return await ctx.prisma.fiyesReturn.create({
          data: {
            kind: p.kind,
            year: p.year,
            month: p.month,
            period,
            documentDate: dayOnly(input.documentDate),
            enteredById: input.enteredById,
            approvedById: input.approvedById,
            entries: storedEntries(p.kind, input.entries),
            ...(input.kind === "MONTHLY"
              ? { pettyCashOpening: pettyCash(input.pettyCashOpening), pettyCashClosing: pettyCash(input.pettyCashClosing) }
              : { payables: { create: payableRows(input.payables) } }),
          },
          select: { period: true },
        });
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new TRPCError({ code: "CONFLICT", message: `A return for ${periodLabel(p)} already exists.` });
        }
        throw e;
      }
    }),

  update: permissionProcedure("fiyes:update")
    .input(updateFiyesSchema)
    .mutation(async ({ ctx, input }) => {
      const ret = await findOr404(ctx.prisma, input.period);
      if (ret.kind !== input.kind) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A return can't move between the monthly and yearly sets." });
      }
      if (ret.status !== "DRAFT") {
        if (!ctx.session.permissions?.includes("fiyes:edit_locked")) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This return has been sent for approval. Call it back to edit it.",
          });
        }
        // The workflow runs on these two; changing them mid-way would strand it.
        if (input.enteredById !== ret.enteredById || input.approvedById !== ret.approvedById) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Signatories can't change once a return has been sent. Call it back first.",
          });
        }
      }
      await assertStaff(ctx.prisma, [input.enteredById, input.approvedById]);

      // One nested write, so the payables are replaced atomically.
      return ctx.prisma.fiyesReturn.update({
        where: { id: ret.id },
        data: {
          documentDate: dayOnly(input.documentDate),
          enteredById: input.enteredById,
          approvedById: input.approvedById,
          entries: storedEntries(ret.kind, input.entries),
          ...(input.kind === "MONTHLY"
            ? { pettyCashOpening: pettyCash(input.pettyCashOpening), pettyCashClosing: pettyCash(input.pettyCashClosing) }
            : { payables: { deleteMany: {}, create: payableRows(input.payables) } }),
        },
        select: { period: true },
      });
    }),

  delete: permissionProcedure("fiyes:delete")
    .input(fiyesPeriodSchema)
    .mutation(async ({ ctx, input }) => {
      const ret = await findOr404(ctx.prisma, input.period);
      await ctx.prisma.fiyesReturn.delete({ where: { id: ret.id } });
      return { period: input.period };
    }),

  // DRAFT → PENDING_APPROVAL. Only Entered by, who signs by sending.
  send: protectedProcedure.input(fiyesPeriodSchema).mutation(async ({ ctx, input }) => {
    const ret = await findOr404(ctx.prisma, input.period);
    const userId = ctx.session.user.id;
    if (ret.status !== "DRAFT") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only a draft return can be sent." });
    }
    if (!ret.enteredById || !ret.approvedById) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Choose who enters and who approves this return before sending it." });
    }
    if (ret.enteredById !== userId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only the person entering this return can send it." });
    }
    if (ret.kind === "MONTHLY" && (ret.pettyCashOpening === null || ret.pettyCashClosing === null)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Enter both F01 petty cash amounts before sending." });
    }
    await assertActorHasSignature(ctx.prisma, userId);
    return transition(ctx.prisma, ret.id, userId, "FIYES_SENT", {
      status: "PENDING_APPROVAL",
      sentAt: new Date(),
      approvedAt: null,
      rejectedAt: null,
      rejectedById: null,
      rejectionComment: null,
    });
  }),

  // PENDING_APPROVAL → DRAFT. Entered by, or anyone who may edit returns.
  callback: protectedProcedure.input(fiyesPeriodSchema).mutation(async ({ ctx, input }) => {
    const ret = await findOr404(ctx.prisma, input.period);
    const userId = ctx.session.user.id;
    if (ret.status !== "PENDING_APPROVAL") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only a return awaiting approval can be called back." });
    }
    if (ret.enteredById !== userId && !ctx.session.permissions?.includes("fiyes:update")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only the person who entered this return can call it back." });
    }
    return transition(ctx.prisma, ret.id, userId, "FIYES_CALLED_BACK", { status: "DRAFT", ...CLEARED_STAMPS });
  }),

  // PENDING_APPROVAL → APPROVED. Only Approved by, with a signature on file.
  approve: protectedProcedure.input(fiyesPeriodSchema).mutation(async ({ ctx, input }) => {
    const ret = await findOr404(ctx.prisma, input.period);
    const userId = ctx.session.user.id;
    if (ret.status !== "PENDING_APPROVAL") {
      throw new TRPCError({ code: "FORBIDDEN", message: "This return isn't awaiting approval." });
    }
    if (ret.approvedById !== userId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only the assigned approver can approve this return." });
    }
    await assertActorHasSignature(ctx.prisma, userId);
    return transition(ctx.prisma, ret.id, userId, "FIYES_APPROVED", { status: "APPROVED", approvedAt: new Date() });
  }),

  // PENDING_APPROVAL → DRAFT with an optional comment. Only Approved by.
  reject: protectedProcedure.input(rejectFiyesSchema).mutation(async ({ ctx, input }) => {
    const ret = await findOr404(ctx.prisma, input.period);
    const userId = ctx.session.user.id;
    if (ret.status !== "PENDING_APPROVAL" || ret.approvedById !== userId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only the assigned approver can reject this return." });
    }
    const comment = input.comment || null;
    return transition(
      ctx.prisma,
      ret.id,
      userId,
      "FIYES_REJECTED",
      { status: "DRAFT", ...CLEARED_STAMPS, rejectedAt: new Date(), rejectedById: userId, rejectionComment: comment },
      comment,
    );
  }),

  // One form's approval sheet, laid out for the PDF, plus each signature
  // once that person has signed.
  pdfPayload: permissionProcedure("fiyes:read")
    .input(fiyesFormSchema)
    .query(async ({ ctx, input }) => {
      const ret = await findOr404(ctx.prisma, input.period);
      const p = periodOr400(ret.period);
      const form = fiyesForm(input.form);
      if (!form || form.kind !== ret.kind) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${form?.title ?? input.form} isn't part of the ${returnTitle(p)}.`,
        });
      }
      const { book, signatureRow } = await buildFiyesWorkbook(returnData(ret), form);
      const [layout, enteredBy, approvedBy] = await Promise.all([
        sheetLayout(book, "Approval_Template"),
        ret.sentAt ? getSignatureDataUrl(ctx.prisma, ret.enteredById) : Promise.resolve(null),
        ret.approvedAt ? getSignatureDataUrl(ctx.prisma, ret.approvedById) : Promise.resolve(null),
      ]);
      return {
        fileName: fiyesFileName(form, p, "pdf"),
        layout,
        signatureRow,
        signatureColumns: { entered: form.signature.entered, approved: form.signature.approved },
        signatures: { enteredBy, approvedBy },
      };
    }),
});
