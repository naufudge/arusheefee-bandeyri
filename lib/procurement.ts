// Procurements — shared by the server, the register and the detail page.
//
// A procurement groups one purchase's documents. Each document type is a
// stage below; a future module (asset creation, capital expenditure
// authorization, …) joins by adding a \`procurementId\` to its table and an
// entry here.

export const PROCUREMENT_STAGES = [
  {
    key: "gsr",
    label: "Requisition",
    doc: "GSR form",
    multiple: false,
    optional: false,
  },
  {
    key: "priceEvaluation",
    label: "Price evaluation",
    doc: "Price evaluation",
    multiple: false,
    optional: false,
  },
  {
    key: "pv",
    label: "Payment",
    doc: "Payment voucher",
    multiple: true,
    optional: false,
  },
  {
    key: "asset",
    label: "Asset registration",
    doc: "Asset",
    multiple: true,
    // Only when the purchase is an asset.
    optional: true,
  },
] as const;

export type ProcurementStageKey = (typeof PROCUREMENT_STAGES)[number]["key"];

export const PROCUREMENT_DOC_TYPES = PROCUREMENT_STAGES.map((s) => s.key) as [
  ProcurementStageKey,
  ...ProcurementStageKey[],
];

export type StageState = "empty" | "in-progress" | "done";

/** The bits of each linked document that progress depends on. */
export interface ProcurementDocsLike {
  gsrForm: { status: string } | null;
  priceEvaluation: { status: string } | null;
  pvs: { status: string }[];
  assets: unknown[];
}

export interface ProcurementProgress {
  stages: Record<ProcurementStageKey, StageState>;
  /** Fully completed once a linked PV is posted. */
  completed: boolean;
  /** The furthest required stage that has a document, or null if none yet. */
  currentStage: ProcurementStageKey | null;
}

export function procurementProgress(p: ProcurementDocsLike): ProcurementProgress {
  const gsr: StageState = !p.gsrForm
    ? "empty"
    : // Authorised (receipt pending) or completed counts as done.
      p.gsrForm.status === "PENDING_RECEIPT" || p.gsrForm.status === "COMPLETED"
      ? "done"
      : "in-progress";
  const priceEvaluation: StageState = !p.priceEvaluation
    ? "empty"
    : p.priceEvaluation.status === "APPROVED"
      ? "done"
      : "in-progress";
  const pv: StageState =
    p.pvs.length === 0 ? "empty" : p.pvs.some((x) => x.status === "POSTED") ? "done" : "in-progress";
  const asset: StageState = p.assets.length > 0 ? "done" : "empty";

  const stages = { gsr, priceEvaluation, pv, asset };
  const required = PROCUREMENT_STAGES.filter((s) => !s.optional).map((s) => s.key);
  const currentStage = [...required].reverse().find((k) => stages[k] !== "empty") ?? null;

  return { stages, completed: pv === "done", currentStage };
}

/** "Completed", "Ongoing · Price evaluation" or "Not started". */
export function procurementStatusLabel(progress: ProcurementProgress): string {
  if (progress.completed) return "Completed";
  if (!progress.currentStage) return "Not started";
  const stage = PROCUREMENT_STAGES.find((s) => s.key === progress.currentStage);
  return `Ongoing · ${stage?.label ?? ""}`;
}
