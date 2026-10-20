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
import { formNumRange } from "@/lib/asset-creation";
import { peSource, resolveCea } from "@/lib/cea";
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
      section: true,
      budgetBalance: true,
      glAccountId: true,
      glAccount: { select: { code: true, longTextEn: true } },
      vendors: { orderBy: { position: "asc" } },
      items: { orderBy: { position: "asc" }, include: { quotes: true } },
    },
  },
  capitalExpenditure: {
    select: {
      id: true,
      ceaNum: true,
      status: true,
      section: true,
      glAccountId: true,
      glAccount: { select: { code: true, longTextEn: true } },
      budgetBalance: true,
      items: { orderBy: { position: "asc" } },
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
  assetCreations: {
    select: {
      id: true,
      status: true,
      description1: true,
      quantity: true,
      originalValue: true,
      forms: { select: { formNum: true }, orderBy: { position: "asc" } },
    },
    orderBy: { createdAt: "asc" },
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
    assetCreations: p.assetCreations.map((ac) => {
      const formNums = ac.forms.map((f) => f.formNum);
      return {
        id: ac.id,
        status: ac.status,
        formNum: formNums[0] ?? "",
        formRange: formNumRange(formNums),
        formCount: formNums.length,
        description: ac.description1,
        // Every form carries the same value.
        totalValue: ac.originalValue != null ? ac.originalValue * formNums.length : null,
        formNums,
      };
    }),
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
    // A draft CEA's cost follows the price evaluation, as on its own page.
    capitalExpenditure: p.capitalExpenditure
      ? {
          id: p.capitalExpenditure.id,
          ceaNum: p.capitalExpenditure.ceaNum,
          status: p.capitalExpenditure.status,
          total: resolveCea(p.capitalExpenditure, pe ? peSource(pe) : null).total,
        }
      : null,
  };

  return {
    id: p.id,
    title: p.title,
    notes: p.notes,
    isAsset: p.isAsset,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    createdBy: p.createdBy,
    ...docs,
    progress: procurementProgress({ isAsset: p.isAsset, ...docs }),
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
  const row = await findLinkable(db, type, docId);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "That document no longer exists." });
  return row;
}

async function findLinkable(
  db: PrismaClient,
  type: ProcurementStageKey,
  docId: string,
): Promise<{ label: string; procurementId: string | null } | null> {
  const select = { procurementId: true } as const;
  switch (type) {
    case "gsr":
      return db.gSRForm
        .findUnique({ where: { id: docId }, select: { ...select, gsrFormNum: true } })
        .then((r) => r && { label: `GSR form ${r.gsrFormNum}`, procurementId: r.procurementId });
    case "priceEvaluation":
      return db.priceEvaluation
        .findUnique({ where: { id: docId }, select: { ...select, evalNum: true } })
        .then((r) => r && { label: `Price evaluation ${r.evalNum}`, procurementId: r.procurementId });
    case "cea":
      return db.capitalExpenditure
        .findUnique({ where: { id: docId }, select: { ...select, ceaNum: true } })
        .then((r) => r && { label: `CEA form ${r.ceaNum}`, procurementId: r.procurementId });
    case "assetCreation":
      return db.assetCreation
        .findUnique({
          where: { id: docId },
          select: { ...select, forms: { select: { formNum: true }, orderBy: { position: "asc" } } },
        })
        .then(
          (r) =>
            r && {
              label: `Asset creation form ${formNumRange(r.forms.map((f) => f.formNum))}`,
              procurementId: r.procurementId,
            },
        );
    case "asset":
      return db.asset
        .findUnique({ where: { id: docId }, select: { ...select, assetNum: true } })
        .then((r) => r && { label: `Asset ${r.assetNum}`, procurementId: r.procurementId });
    case "pv":
      return db.pV
        .findUnique({ where: { id: docId }, select: { ...select, pvNum: true } })
        .then((r) => r && { label: `PV ${r.pvNum}`, procurementId: r.procurementId });
  }
}

// Point a document at a procurement (or detach it with null).
async function setLink(
  db: PrismaClient,
  type: ProcurementStageKey,
  docId: string,
  procurementId: string | null,
) {
  const data = { procurementId };
  const where = { id: docId };
  switch (type) {
    case "gsr":
      return void (await db.gSRForm.update({ where, data }));
    case "priceEvaluation":
      return void (await db.priceEvaluation.update({ where, data }));
    case "assetCreation":
      return void (await db.assetCreation.update({ where, data }));
    case "cea":
      return void (await db.capitalExpenditure.update({ where, data }));
    case "asset":
      return void (await db.asset.update({ where, data }));
    case "pv":
      return void (await db.pV.update({ where, data }));
  }
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
          isAsset: input.isAsset,
          createdById: ctx.session.user.id,
        },
        select: { id: true },
      });
      return p;
    }),

  update: permissionProcedure("procurement:update")
    .input(updateProcurementSchema)
    .mutation(async ({ ctx, input }) => {
      const p = await findOr404(ctx.prisma, input.id);
      // The asset stages hold documents: they can't just disappear.
      if (p.isAsset && !input.isAsset && (p.assetCreations.length > 0 || p.assets.length > 0)) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "This procurement has asset creation forms or assets. Unlink them before marking it as not an asset purchase.",
        });
      }
      await ctx.prisma.procurement.update({
        where: { id: input.id },
        data: {
          title: input.title,
          notes: input.notes?.trim() || null,
          isAsset: input.isAsset,
        },
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
        case "cea": {
          const rows = await ctx.prisma.capitalExpenditure.findMany({
            where,
            select: { id: true, ceaNum: true, items: { select: { description: true }, orderBy: { position: "asc" } } },
            orderBy: { createdAt: "desc" },
          });
          return rows.map((r) => ({
            id: r.id,
            label: r.ceaNum,
            hint: joinNames(r.items.map((i) => i.description ?? "")),
          }));
        }
        case "assetCreation": {
          const rows = await ctx.prisma.assetCreation.findMany({
            where,
            select: {
              id: true,
              description1: true,
              forms: { select: { formNum: true }, orderBy: { position: "asc" } },
            },
            orderBy: { createdAt: "desc" },
          });
          return rows.map((r) => ({
            id: r.id,
            label: formNumRange(r.forms.map((f) => f.formNum)),
            hint: r.description1,
          }));
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
