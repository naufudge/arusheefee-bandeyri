import { TRPCError } from "@trpc/server";
import type { Prisma, PrismaClient } from "@prisma/client";
import { router, permissionProcedure } from "../trpc";
import {
  createProcurementSchema,
  updateProcurementSchema,
  procurementIdSchema,
  linkCandidatesSchema,
  linkDocumentSchema,
  unlinkDocumentSchema,
} from "../schemas/procurement.schema";
import { assertProcurementSlot } from "../lib/procurement";
import { procurementProgress, type ProcurementStageKey } from "@/lib/procurement";
import { computeComparison, ratesByPosition } from "@/lib/price-eval";
import { pvTotal } from "@/utils/currency";

// Enough of each linked document to show its row and work out progress.
const docsInclude = {
  createdBy: { select: { id: true, name: true } },
  gsrForm: {
    select: {
      id: true,
      gsrFormNum: true,
      status: true,
      section: true,
      date: true,
      items: { select: { particulars: true } },
    },
  },
  priceEvaluation: {
    select: {
      id: true,
      evalNum: true,
      status: true,
      date: true,
      gstRate: true,
      selectedVendor: true,
      vendors: { orderBy: { position: "asc" } },
      items: { orderBy: { position: "asc" }, include: { quotes: true } },
    },
  },
  pvs: {
    select: {
      id: true,
      pvNum: true,
      status: true,
      vendor: true,
      date: true,
      currency: true,
      exchangeRate: true,
      invoices: { select: { invoiceTotal: true } },
    },
    orderBy: { date: "asc" },
  },
  assets: {
    select: { id: true, assetNum: true, assetName: true, presentLocation: true, price: true },
    orderBy: { assetNum: "asc" },
  },
} as const;

type WithDocs = Prisma.ProcurementGetPayload<{ include: typeof docsInclude }>;

const joinNames = (names: string[]) =>
  names.map((n) => n.trim()).filter(Boolean).join(", ");

// The procurement with each document reduced to what its row shows, plus
// the derived progress.
function summarize(p: WithDocs) {
  const pe = p.priceEvaluation;
  let priceEvaluation = null;
  if (pe) {
    const items = pe.items.map((it) => ({
      qty: it.qty,
      rates: ratesByPosition(pe.vendors, it.quotes),
    }));
    const comparison = computeComparison(items, pe.vendors, pe.gstRate);
    const chosen = pe.selectedVendor;
    priceEvaluation = {
      id: pe.id,
      evalNum: pe.evalNum,
      status: pe.status,
      date: pe.date,
      itemsSummary: joinNames(pe.items.map((it) => it.name)),
      vendorName: chosen != null ? (pe.vendors[chosen]?.name ?? null) : null,
      total: chosen != null ? (comparison.vendors[chosen]?.total ?? null) : null,
    };
  }

  const docs = {
    gsrForm: p.gsrForm
      ? {
          id: p.gsrForm.id,
          gsrFormNum: p.gsrForm.gsrFormNum,
          status: p.gsrForm.status,
          section: p.gsrForm.section,
          date: p.gsrForm.date,
          itemsSummary: joinNames(p.gsrForm.items.map((it) => it.particulars)),
        }
      : null,
    priceEvaluation,
    pvs: p.pvs.map((pv) => {
      const total = pvTotal(pv);
      return {
        id: pv.id,
        pvNum: pv.pvNum,
        status: pv.status,
        vendor: pv.vendor,
        date: pv.date,
        currency: pv.currency,
        total: total.doc,
        totalMvr: total.mvr,
      };
    }),
    assets: p.assets,
  };

  return {
    id: p.id,
    title: p.title,
    notes: p.notes,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    createdBy: p.createdBy,
    ...docs,
    progress: procurementProgress(docs),
  };
}

async function findOr404(db: PrismaClient, id: string) {
  const p = await db.procurement.findUnique({ where: { id }, include: docsInclude });
  if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Procurement not found" });
  return p;
}

// The document's current procurement, or NOT_FOUND if it doesn't exist.
async function currentLink(
  db: PrismaClient,
  type: ProcurementStageKey,
  docId: string,
): Promise<{ label: string; procurementId: string | null }> {
  const select = { procurementId: true } as const;
  const row =
    type === "gsr"
      ? await db.gSRForm.findUnique({ where: { id: docId }, select: { ...select, gsrFormNum: true } }).then((r) => r && { label: `GSR form ${r.gsrFormNum}`, procurementId: r.procurementId })
      : type === "priceEvaluation"
        ? await db.priceEvaluation.findUnique({ where: { id: docId }, select: { ...select, evalNum: true } }).then((r) => r && { label: `Price evaluation ${r.evalNum}`, procurementId: r.procurementId })
        : type === "pv"
          ? await db.pV.findUnique({ where: { id: docId }, select: { ...select, pvNum: true } }).then((r) => r && { label: `PV ${r.pvNum}`, procurementId: r.procurementId })
          : await db.asset.findUnique({ where: { id: docId }, select: { ...select, assetNum: true } }).then((r) => r && { label: `Asset ${r.assetNum}`, procurementId: r.procurementId });
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "That document no longer exists." });
  return row;
}

// Point a document at a procurement (or detach it with null).
async function setLink(
  db: PrismaClient,
  type: ProcurementStageKey,
  docId: string,
  procurementId: string | null,
) {
  const data = { procurementId };
  if (type === "gsr") await db.gSRForm.update({ where: { id: docId }, data });
  else if (type === "priceEvaluation") await db.priceEvaluation.update({ where: { id: docId }, data });
  else if (type === "pv") await db.pV.update({ where: { id: docId }, data });
  else await db.asset.update({ where: { id: docId }, data });
}

export const procurementRouter = router({
  list: permissionProcedure("procurement:read").query(async ({ ctx }) => {
    const rows = await ctx.prisma.procurement.findMany({
      include: docsInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(summarize);
  }),

  getById: permissionProcedure("procurement:read")
    .input(procurementIdSchema)
    .query(async ({ ctx, input }) => summarize(await findOr404(ctx.prisma, input.id))),

  create: permissionProcedure("procurement:create")
    .input(createProcurementSchema)
    .mutation(async ({ ctx, input }) => {
      const p = await ctx.prisma.procurement.create({
        data: {
          title: input.title,
          notes: input.notes?.trim() || null,
          createdById: ctx.session.user.id,
        },
        select: { id: true },
      });
      return p;
    }),

  update: permissionProcedure("procurement:update")
    .input(updateProcurementSchema)
    .mutation(async ({ ctx, input }) => {
      await findOr404(ctx.prisma, input.id);
      await ctx.prisma.procurement.update({
        where: { id: input.id },
        data: { title: input.title, notes: input.notes?.trim() || null },
      });
      return { id: input.id };
    }),

  // The documents stay; their link is cleared (ON DELETE SET NULL).
  delete: permissionProcedure("procurement:delete")
    .input(procurementIdSchema)
    .mutation(async ({ ctx, input }) => {
      await findOr404(ctx.prisma, input.id);
      await ctx.prisma.procurement.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // Documents of a type that aren't in any procurement yet, for the
  // "Link existing" picker.
  linkCandidates: permissionProcedure("procurement:update")
    .input(linkCandidatesSchema)
    .query(async ({ ctx, input }) => {
      const where = { procurementId: null };
      switch (input.type) {
        case "gsr": {
          const rows = await ctx.prisma.gSRForm.findMany({
            where,
            select: { id: true, gsrFormNum: true, items: { select: { particulars: true } } },
            orderBy: { createdAt: "desc" },
          });
          return rows.map((r) => ({ id: r.id, label: r.gsrFormNum, hint: joinNames(r.items.map((i) => i.particulars)) }));
        }
        case "priceEvaluation": {
          const rows = await ctx.prisma.priceEvaluation.findMany({
            where,
            select: { id: true, evalNum: true, items: { select: { name: true }, orderBy: { position: "asc" } } },
            orderBy: { createdAt: "desc" },
          });
          return rows.map((r) => ({ id: r.id, label: r.evalNum, hint: joinNames(r.items.map((i) => i.name)) }));
        }
        case "pv": {
          const rows = await ctx.prisma.pV.findMany({
            where,
            select: { id: true, pvNum: true, vendor: true },
            orderBy: { date: "desc" },
          });
          return rows.map((r) => ({ id: r.id, label: r.pvNum, hint: r.vendor }));
        }
        case "asset": {
          const rows = await ctx.prisma.asset.findMany({
            where,
            select: { id: true, assetNum: true, assetName: true },
            orderBy: { assetNum: "asc" },
          });
          return rows.map((r) => ({ id: r.id, label: r.assetNum, hint: r.assetName }));
        }
      }
    }),

  link: permissionProcedure("procurement:update")
    .input(linkDocumentSchema)
    .mutation(async ({ ctx, input }) => {
      const doc = await currentLink(ctx.prisma, input.type, input.docId);
      if (doc.procurementId === input.procurementId) return { success: true };
      if (doc.procurementId) {
        const other = await ctx.prisma.procurement.findUnique({
          where: { id: doc.procurementId },
          select: { title: true },
        });
        throw new TRPCError({
          code: "CONFLICT",
          message: `${doc.label} is already part of "${other?.title ?? "another procurement"}". Unlink it there first.`,
        });
      }
      await assertProcurementSlot(ctx.prisma, input.procurementId, input.type);
      await setLink(ctx.prisma, input.type, input.docId, input.procurementId);
      return { success: true };
    }),

  unlink: permissionProcedure("procurement:update")
    .input(unlinkDocumentSchema)
    .mutation(async ({ ctx, input }) => {
      await currentLink(ctx.prisma, input.type, input.docId);
      await setLink(ctx.prisma, input.type, input.docId, null);
      return { success: true };
    }),
});
