import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { isAssetOnlyStage, type ProcurementStageKey } from "@/lib/procurement";

type Db = Pick<PrismaClient, "procurement" | "gSRForm" | "priceEvaluation">;

/**
 * Checks a document can join `procurementId`: the procurement exists, it's
 * an asset purchase if the document is asset-only (asset creation form,
 * asset), and for the one-per-procurement types (GSR, price evaluation) the
 * slot is free. A no-op when no procurement is given.
 *
 * Pass the caller's `permissions` when a document is being created straight
 * into a procurement: adding to one needs `procurement:update`, the same as
 * linking from the procurement page.
 */
export async function assertProcurementSlot(
  db: Db,
  procurementId: string | null | undefined,
  type: ProcurementStageKey,
  permissions?: readonly string[] | null,
): Promise<void> {
  if (!procurementId) return;
  if (permissions !== undefined && !(permissions ?? []).includes("procurement:update")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You need permission to edit procurements to add a document to one.",
    });
  }

  const procurement = await db.procurement.findUnique({
    where: { id: procurementId },
    select: {
      title: true,
      isAsset: true,
      gsrForm: { select: { gsrFormNum: true } },
      priceEvaluation: { select: { evalNum: true } },
      capitalExpenditure: { select: { ceaNum: true } },
    },
  });
  if (!procurement) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "That procurement no longer exists.",
    });
  }
  if (isAssetOnlyStage(type) && !procurement.isAsset) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `"${procurement.title}" isn't an asset purchase. Mark it as one first.`,
    });
  }
  if (type === "gsr" && procurement.gsrForm) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `"${procurement.title}" already has GSR form ${procurement.gsrForm.gsrFormNum}. Unlink it first.`,
    });
  }
  if (type === "cea" && procurement.capitalExpenditure) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `"${procurement.title}" already has CEA form ${procurement.capitalExpenditure.ceaNum}. Unlink it first.`,
    });
  }
  if (type === "priceEvaluation" && procurement.priceEvaluation) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `"${procurement.title}" already has price evaluation ${procurement.priceEvaluation.evalNum}. Unlink it first.`,
    });
  }
}

/** Shown on a document's own page, linking back to its procurement. */
export const procurementBackLink = {
  select: { id: true, title: true },
} as const;
