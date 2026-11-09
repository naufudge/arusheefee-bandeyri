import type { PrismaClient } from "@prisma/client";
import { router, protectedProcedure } from "../trpc";
import { globalSearchSchema } from "../schemas/search.schema";
import {
  caseVariants,
  containsCi,
  exactly,
  isoDate,
  joinList,
  matchedOn,
  rankHits,
} from "../lib/search";
import { hasPermission } from "@/lib/permissions";
import {
  SEARCH_LIMIT,
  SEARCH_MODULES,
  SEARCH_MODULE_PERMISSION,
  SEARCH_SCOPED_LIMIT,
  type SearchModule,
} from "@/lib/search";
import { pvTotal } from "@/utils/currency";

type Args = { db: PrismaClient; q: string; take: number; limit: number };

const enc = encodeURIComponent;
const dot = (...parts: (string | null | undefined)[]) =>
  parts.filter((p) => p && p.trim()).join(" · ") || null;

// Each searcher: one exact-number lookup plus one newest-first substring
// query, both with narrow selects (no staff rows, comments or figures).

async function searchPv({ db, q, take, limit }: Args) {
  const select = {
    id: true,
    pvNum: true,
    vendor: true,
    notes: true,
    date: true,
    status: true,
    parkedDate: true,
    poNum: true,
    transferNum: true,
    exchangeRate: true,
    invoices: { select: { invoiceNumber: true, invoiceTotal: true } },
  } as const;
  const [exact, rows] = await Promise.all([
    db.pV.findMany({ where: { pvNum: exactly(q) }, select, take: 1 }),
    db.pV.findMany({
      where: {
        OR: [
          { pvNum: containsCi(q) },
          { vendor: containsCi(q) },
          { notes: containsCi(q) },
          { poNum: containsCi(q) },
          { transferNum: containsCi(q) },
          { invoices: { some: { invoiceNumber: containsCi(q) } } },
        ],
      },
      select,
      orderBy: { date: "desc" },
      take,
    }),
  ]);
  const { items, hasMore } = rankHits(exact, rows, q, limit, (r) => [r.pvNum]);
  return {
    module: "pv" as const,
    hasMore,
    items: items.map((r) => ({
      id: r.id,
      href: `/pv/${enc(r.pvNum)}`,
      num: r.pvNum,
      title: r.vendor,
      subtitle: r.notes,
      note: matchedOn(q, [r.pvNum, r.vendor, r.notes], [
        ["PO", r.poNum],
        ["Transfer", r.transferNum],
        ...r.invoices.map((i): [string, string | null] => ["Invoice", i.invoiceNumber]),
      ]),
      date: isoDate(r.date),
      status: r.status,
      parked: r.parkedDate != null,
      amountMvr: pvTotal(r).mvr,
    })),
  };
}

async function searchPettyCash({ db, q, take, limit }: Args) {
  const role = { select: { isApproved: true } } as const;
  const select = {
    id: true,
    pettyCashNum: true,
    previousNums: true,
    date: true,
    formNum: true,
    sectionUnit: true,
    systemApproved: true,
    handledBy: role,
    procurementApprovedBy: role,
    budgetCheckedBy: role,
    balanceHandedOverBy: role,
    balanceCollectedBy: role,
    items: { select: { name: true, nameDhivehi: true } },
  } as const;
  // previousNums is a String[], which only matches whole values.
  const previous = { previousNums: { hasSome: caseVariants(q) } };
  const [exact, rows] = await Promise.all([
    db.pettyCash.findMany({
      where: { OR: [{ pettyCashNum: exactly(q) }, previous] },
      select,
      take: 1,
    }),
    db.pettyCash.findMany({
      where: {
        OR: [
          { pettyCashNum: containsCi(q) },
          previous,
          { formNum: containsCi(q) },
          { sectionUnit: containsCi(q) },
          { items: { some: { name: containsCi(q) } } },
          { items: { some: { nameDhivehi: containsCi(q) } } },
        ],
      },
      select,
      orderBy: { date: "desc" },
      take,
    }),
  ]);
  const { items, hasMore } = rankHits(exact, rows, q, limit, (r) => [
    r.pettyCashNum,
    ...r.previousNums,
  ]);
  const needle = q.toLowerCase();
  return {
    module: "pettycash" as const,
    hasMore,
    items: items.map((r) => {
      const roles = [
        r.handledBy,
        r.procurementApprovedBy,
        r.budgetCheckedBy,
        r.balanceHandedOverBy,
        r.balanceCollectedBy,
      ];
      const previousNum = r.previousNums.find((n) => n.toLowerCase() === needle);
      const title =
        joinList(r.items.map((i) => i.name || i.nameDhivehi)) || r.sectionUnit;
      const subtitle = dot(`Form ${r.formNum}`, r.sectionUnit);
      return {
        id: r.id,
        href: `/petty-cash/${enc(r.pettyCashNum)}`,
        num: r.pettyCashNum,
        title,
        subtitle,
        note: previousNum
          ? `Renumbered from ${previousNum}`
          : matchedOn(q, [r.pettyCashNum, title, subtitle], r.items.map(
              (i): [string, string | null] => ["Item", i.nameDhivehi],
            )),
        date: isoDate(r.date),
        approvedCount: roles.filter((x) => x?.isApproved).length,
        totalAssigned: roles.filter((x) => x !== null).length,
        systemApproved: r.systemApproved,
      };
    }),
  };
}

async function searchGsr({ db, q, take, limit }: Args) {
  const select = {
    id: true,
    gsrFormNum: true,
    section: true,
    date: true,
    status: true,
    items: { select: { particulars: true } },
  } as const;
  const [exact, rows] = await Promise.all([
    db.gSRForm.findMany({ where: { gsrFormNum: exactly(q) }, select, take: 1 }),
    db.gSRForm.findMany({
      where: {
        OR: [
          { gsrFormNum: containsCi(q) },
          { section: containsCi(q) },
          { items: { some: { particulars: containsCi(q) } } },
          { items: { some: { remarks: containsCi(q) } } },
        ],
      },
      select,
      orderBy: { date: "desc" },
      take,
    }),
  ]);
  const { items, hasMore } = rankHits(exact, rows, q, limit, (r) => [r.gsrFormNum]);
  return {
    module: "gsr" as const,
    hasMore,
    items: items.map((r) => ({
      id: r.id,
      href: `/gsr/${enc(r.gsrFormNum)}`,
      num: r.gsrFormNum,
      title: joinList(r.items.map((i) => i.particulars)) || r.section,
      subtitle: r.section,
      note: null,
      date: isoDate(r.date),
      status: r.status,
    })),
  };
}

async function searchPcRecon({ db, q, take, limit }: Args) {
  const itemMatch = {
    OR: [
      { details: containsCi(q) },
      { detailsEn: containsCi(q) },
      { sourcePettyCashNum: containsCi(q) },
    ],
  };
  const select = {
    id: true,
    reportNum: true,
    periodText: true,
    weekStart: true,
    status: true,
    // Only the first matching line, to say why the report matched.
    items: {
      where: itemMatch,
      select: { sourcePettyCashNum: true, detailsEn: true },
      take: 1,
    },
  } as const;
  const [exact, rows] = await Promise.all([
    db.pcReconciliation.findMany({ where: { reportNum: exactly(q) }, select, take: 1 }),
    db.pcReconciliation.findMany({
      where: {
        OR: [
          { reportNum: containsCi(q) },
          { periodText: containsCi(q) },
          { items: { some: itemMatch } },
        ],
      },
      select,
      orderBy: { weekStart: "desc" },
      take,
    }),
  ]);
  const { items, hasMore } = rankHits(exact, rows, q, limit, (r) => [r.reportNum]);
  return {
    module: "pcrecon" as const,
    hasMore,
    items: items.map((r) => ({
      id: r.id,
      href: `/pc-reconciliation/${enc(r.reportNum)}`,
      num: r.reportNum,
      title: r.periodText,
      subtitle: null,
      note: matchedOn(q, [r.reportNum, r.periodText], [
        ["Petty cash", r.items[0]?.sourcePettyCashNum],
        ["Item", r.items[0]?.detailsEn],
      ]),
      date: isoDate(r.weekStart),
      status: r.status,
    })),
  };
}

async function searchPriceEval({ db, q, take, limit }: Args) {
  const select = {
    id: true,
    evalNum: true,
    section: true,
    date: true,
    status: true,
    vendors: { select: { name: true }, orderBy: { position: "asc" } },
    items: { select: { name: true }, orderBy: { position: "asc" } },
  } as const;
  const [exact, rows] = await Promise.all([
    db.priceEvaluation.findMany({ where: { evalNum: exactly(q) }, select, take: 1 }),
    db.priceEvaluation.findMany({
      where: {
        OR: [
          { evalNum: containsCi(q) },
          { section: containsCi(q) },
          { vendors: { some: { name: containsCi(q) } } },
          { items: { some: { name: containsCi(q) } } },
        ],
      },
      select,
      orderBy: { date: "desc" },
      take,
    }),
  ]);
  const { items, hasMore } = rankHits(exact, rows, q, limit, (r) => [r.evalNum]);
  const needle = q.toLowerCase();
  return {
    module: "priceeval" as const,
    hasMore,
    items: items.map((r) => {
      const vendors = joinList(r.vendors.map((v) => v.name));
      return {
        id: r.id,
        href: `/price-evaluation/${enc(r.evalNum)}`,
        num: r.evalNum,
        title: joinList(r.items.map((i) => i.name)) || r.section,
        // Show the section when that's what matched, otherwise the vendors.
        subtitle: r.section.toLowerCase().includes(needle) ? r.section : vendors || null,
        note: null,
        date: isoDate(r.date),
        status: r.status,
      };
    }),
  };
}

async function searchAssetCreation({ db, q, take, limit }: Args) {
  const select = {
    id: true,
    description1: true,
    vendor: true,
    location: true,
    createdAt: true,
    status: true,
    forms: {
      select: { formNum: true, sapAssetNum: true },
      orderBy: { position: "asc" },
    },
  } as const;
  const [exact, rows] = await Promise.all([
    db.assetCreation.findMany({
      where: {
        forms: {
          some: { OR: [{ formNum: exactly(q) }, { sapAssetNum: exactly(q) }] },
        },
      },
      select,
      take: 1,
    }),
    db.assetCreation.findMany({
      where: {
        OR: [
          { forms: { some: { formNum: containsCi(q) } } },
          { forms: { some: { sapAssetNum: containsCi(q) } } },
          { description1: containsCi(q) },
          { description2: containsCi(q) },
          { vendor: containsCi(q) },
          { location: containsCi(q) },
        ],
      },
      select,
      orderBy: { createdAt: "desc" },
      take,
    }),
  ]);
  const { items, hasMore } = rankHits(exact, rows, q, limit, (r) =>
    r.forms.flatMap((f) => [f.formNum, f.sapAssetNum]),
  );
  return {
    module: "assetcreation" as const,
    hasMore,
    items: items
      // The form set opens by any of its form numbers; a set always has one.
      .filter((r) => r.forms.length > 0)
      .map((r) => {
        const first = r.forms[0].formNum;
        const subtitle = dot(r.vendor, r.location);
        return {
          id: r.id,
          href: `/asset-creation/${enc(first)}`,
          num: first,
          title: r.description1,
          subtitle,
          note: matchedOn(
            q,
            [first, r.description1, subtitle],
            r.forms.flatMap((f): [string, string | null][] => [
              ["Form", f.formNum],
              ["SAP", f.sapAssetNum],
            ]),
          ),
          date: isoDate(r.createdAt),
          status: r.status,
        };
      }),
  };
}

async function searchAsset({ db, q, take, limit }: Args) {
  const select = {
    id: true,
    assetNum: true,
    SAPassetNum: true,
    assetName: true,
    modelNum: true,
    presentLocation: true,
  } as const;
  const [exact, rows] = await Promise.all([
    db.asset.findMany({
      where: { OR: [{ assetNum: exactly(q) }, { SAPassetNum: exactly(q) }] },
      select,
      take: 1,
    }),
    db.asset.findMany({
      where: {
        OR: [
          { assetNum: containsCi(q) },
          { SAPassetNum: containsCi(q) },
          { assetName: containsCi(q) },
          { modelNum: containsCi(q) },
          { presentLocation: containsCi(q) },
        ],
      },
      select,
      orderBy: { createdAt: "desc" },
      take,
    }),
  ]);
  const { items, hasMore } = rankHits(exact, rows, q, limit, (r) => [
    r.assetNum,
    r.SAPassetNum,
  ]);
  return {
    module: "asset" as const,
    hasMore,
    items: items.map((r) => ({
      id: r.id,
      href: `/asset/${enc(r.assetNum)}`,
      num: r.assetNum,
      title: r.assetName,
      subtitle: r.presentLocation,
      note: matchedOn(q, [r.assetNum, r.assetName, r.presentLocation], [
        ["SAP", r.SAPassetNum],
        ["Model", r.modelNum],
      ]),
      // Asset dates are often year-only; the register shows them properly.
      date: null,
    })),
  };
}

async function searchProcurement({ db, q, take, limit }: Args) {
  // No document number, so there's no exact lookup.
  const rows = await db.procurement.findMany({
    where: { OR: [{ title: containsCi(q) }, { notes: containsCi(q) }] },
    select: { id: true, title: true, notes: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take,
  });
  const { items, hasMore } = rankHits([], rows, q, limit, () => []);
  return {
    module: "procurement" as const,
    hasMore,
    items: items.map((r) => ({
      id: r.id,
      href: `/procurement/${enc(r.id)}`,
      num: null,
      title: r.title,
      subtitle: r.notes,
      note: null,
      date: isoDate(r.createdAt),
    })),
  };
}

async function searchCea({ db, q, take, limit }: Args) {
  const select = {
    id: true,
    ceaNum: true,
    section: true,
    date: true,
    status: true,
    items: { select: { description: true }, orderBy: { position: "asc" } },
    procurement: { select: { title: true } },
  } as const;
  const [exact, rows] = await Promise.all([
    db.capitalExpenditure.findMany({ where: { ceaNum: exactly(q) }, select, take: 1 }),
    db.capitalExpenditure.findMany({
      where: {
        OR: [
          { ceaNum: containsCi(q) },
          { section: containsCi(q) },
          { items: { some: { description: containsCi(q) } } },
          { procurement: { is: { title: containsCi(q) } } },
        ],
      },
      select,
      orderBy: { date: "desc" },
      take,
    }),
  ]);
  const { items, hasMore } = rankHits(exact, rows, q, limit, (r) => [r.ceaNum]);
  return {
    module: "cea" as const,
    hasMore,
    items: items.map((r) => {
      const title =
        joinList(r.items.map((i) => i.description)) || r.procurement?.title || "—";
      return {
        id: r.id,
        href: `/cea/${enc(r.ceaNum)}`,
        num: r.ceaNum,
        title,
        subtitle: r.section,
        note: matchedOn(q, [r.ceaNum, title, r.section], [
          ["Procurement", r.procurement?.title],
        ]),
        date: isoDate(r.date),
        status: r.status,
      };
    }),
  };
}

const SEARCHERS = {
  pv: searchPv,
  pettycash: searchPettyCash,
  gsr: searchGsr,
  pcrecon: searchPcRecon,
  priceeval: searchPriceEval,
  assetcreation: searchAssetCreation,
  asset: searchAsset,
  procurement: searchProcurement,
  cea: searchCea,
} satisfies Record<SearchModule, (args: Args) => Promise<unknown>>;

export const searchRouter = router({
  // Spans modules, so no single permissionProcedure fits: each module is
  // queried only when the user holds its read permission.
  global: protectedProcedure.input(globalSearchSchema).query(async ({ ctx, input }) => {
    const scoped = input.module !== undefined;
    const requested: readonly SearchModule[] = input.module ? [input.module] : SEARCH_MODULES;
    const modules = requested.filter((m) =>
      hasPermission(ctx.session, SEARCH_MODULE_PERMISSION[m]),
    );
    const args: Args = {
      db: ctx.prisma,
      q: input.q,
      take: scoped ? 50 : 30,
      limit: scoped ? SEARCH_SCOPED_LIMIT : SEARCH_LIMIT,
    };
    const groups = await Promise.all(modules.map((m) => SEARCHERS[m](args)));
    return groups.filter((g) => g.items.length > 0);
  }),
});
