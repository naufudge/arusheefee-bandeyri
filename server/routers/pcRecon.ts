import { router, protectedProcedure, permissionProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import {
  createPcReconSchema,
  updatePcReconSchema,
  getPcReconByNumSchema,
  deletePcReconSchema,
  pcReconWorkflowActionSchema,
  rejectPcReconSchema,
  type GateIssue,
} from "../schemas/pcrecon.schema";
import {
  assertActorHasSignature,
  getSignatureDataUrl,
} from "../lib/approval";

const pcReconInclude = {
  preparedBy: true,
  checkedBy: true,
  authorizedBy: true,
  rejectedBy: true,
  items: { orderBy: { sortOrder: "asc" } },
  approvalEvents: {
    include: {
      actor: { select: { id: true, name: true, designation: true } },
    },
    orderBy: { createdAt: "asc" },
  },
} as const;

const hasText = (s: string | null | undefined) => (s?.trim() ?? "") !== "";

// One snapshot transaction row per petty cash record dated in the week.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function deriveItems(prisma: PrismaClient | any, weekStart: Date, weekEnd: Date) {
  const endExclusive = new Date(weekEnd);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  const records = await prisma.pettyCash.findMany({
    where: { date: { gte: weekStart, lt: endExclusive } },
    include: { items: true },
    orderBy: { date: "asc" },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return records.map((pc: any, i: number) => ({
    date: pc.date,
    details: pc.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((it: any) => it.nameDhivehi || it.name || "")
      .filter(Boolean)
      .join("، "),
    detailsEn:
      pc.items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((it: any) => it.name || "")
        .filter(Boolean)
        .join(", ") || null,
    withdrawn: pc.totalRequiredAmount as number,
    sourcePettyCashNum: pc.pettyCashNum as string,
    sortOrder: i,
  }));
}

// Required-Dhivehi checks gating "send for approval".
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function gateIssues(prisma: PrismaClient | any, recon: {
  weekStart: Date;
  weekEnd: Date;
  preparedById: string | null;
  checkedById: string | null;
  authorizedById: string | null;
}): Promise<GateIssue[]> {
  const issues: GateIssue[] = [];

  const endExclusive = new Date(recon.weekEnd);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  const records = await prisma.pettyCash.findMany({
    where: { date: { gte: recon.weekStart, lt: endExclusive } },
    include: { items: true },
    orderBy: { date: "asc" },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const pc of records as any[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const missing = pc.items.filter((it: any) => !hasText(it.nameDhivehi));
    if (missing.length > 0) {
      issues.push({
        type: "petty_cash_missing_dhivehi",
        pettyCashNum: pc.pettyCashNum,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        itemNames: missing.map((it: any) => it.name || "(unnamed)"),
      });
    }
  }

  const roles = [
    ["preparedBy", recon.preparedById],
    ["checkedBy", recon.checkedById],
    ["authorizedBy", recon.authorizedById],
  ] as const;
  for (const [role, staffId] of roles) {
    if (!staffId) continue;
    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (staff && (!hasText(staff.dhivehiName) || !hasText(staff.dhivehiDesignation))) {
      issues.push({
        type: "staff_missing_dhivehi",
        role,
        staffId,
        name: staff.name,
      });
    }
  }

  return issues;
}

export const pcReconRouter = router({
  list: permissionProcedure("pcrecon:read").query(async ({ ctx }) => {
    return ctx.prisma.pcReconciliation.findMany({
      include: pcReconInclude,
      orderBy: { createdAt: "desc" },
    });
  }),

  getByNum: permissionProcedure("pcrecon:read")
    .input(getPcReconByNumSchema)
    .query(async ({ ctx, input }) => {
      const recon = await ctx.prisma.pcReconciliation.findUnique({
        where: { reportNum: input.reportNum },
        include: pcReconInclude,
      });
      if (!recon) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Reconciliation report ${input.reportNum} not found`,
        });
      }
      return recon;
    }),

  create: permissionProcedure("pcrecon:create")
    .input(createPcReconSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.pcReconciliation.findUnique({
        where: { reportNum: input.reportNum },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Reconciliation report ${input.reportNum} already exists`,
        });
      }

      const items = await deriveItems(
        ctx.prisma,
        input.weekStart,
        input.weekEnd,
      );

      return ctx.prisma.pcReconciliation.create({
        data: {
          ...input,
          items: { create: items },
        },
        include: pcReconInclude,
      });
    }),

  update: permissionProcedure("pcrecon:update")
    .input(updatePcReconSchema)
    .mutation(async ({ ctx, input }) => {
      const { reportNum, ...data } = input;

      const existing = await ctx.prisma.pcReconciliation.findUnique({
        where: { reportNum },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Reconciliation report ${reportNum} not found`,
        });
      }
      if (
        existing.status !== "DRAFT" &&
        !ctx.session.permissions?.includes("pcrecon:edit_locked")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Report is locked: call it back to DRAFT before editing.",
        });
      }

      // Re-derive the snapshot from the (possibly edited) petty cash records.
      const items = await deriveItems(ctx.prisma, data.weekStart, data.weekEnd);

      return ctx.prisma.$transaction(async (tx) => {
        await tx.pcReconciliationItem.deleteMany({
          where: { reconciliationId: existing.id },
        });
        return tx.pcReconciliation.update({
          where: { reportNum },
          data: { ...data, items: { create: items } },
          include: pcReconInclude,
        });
      });
    }),

  delete: permissionProcedure("pcrecon:delete")
    .input(deletePcReconSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.pcReconciliation.findUnique({
        where: { reportNum: input.reportNum },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Reconciliation report ${input.reportNum} not found`,
        });
      }
      await ctx.prisma.pcReconciliation.delete({
        where: { reportNum: input.reportNum },
      });
      return { success: true };
    }),

  // Preflight for "send" — returns the list of missing Dhivehi requirements so
  // the client can show a friendly checklist with links. Empty = good to send.
  sendPreflight: permissionProcedure("pcrecon:read")
    .input(getPcReconByNumSchema)
    .query(async ({ ctx, input }) => {
      const recon = await ctx.prisma.pcReconciliation.findUnique({
        where: { reportNum: input.reportNum },
      });
      if (!recon) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Reconciliation report ${input.reportNum} not found`,
        });
      }
      return gateIssues(ctx.prisma, recon);
    }),

  // DRAFT → PENDING_CHECK. Requires both a checker and an authoriser assigned,
  // and re-validates the Dhivehi gate as a server backstop.
  send: permissionProcedure("pcrecon:update")
    .input(pcReconWorkflowActionSchema)
    .mutation(async ({ ctx, input }) => {
      const recon = await ctx.prisma.pcReconciliation.findUnique({
        where: { reportNum: input.reportNum },
      });
      if (!recon) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Reconciliation report ${input.reportNum} not found`,
        });
      }
      if (recon.status !== "DRAFT") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only DRAFT reports can be sent for approval.",
        });
      }
      if (!recon.checkedById || !recon.authorizedById) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Assign both a checker and an authoriser before sending.",
        });
      }
      const issues = await gateIssues(ctx.prisma, recon);
      if (issues.length > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "DHIVEHI_REQUIRED",
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        await tx.approvalEvent.create({
          data: {
            kind: "PCRECON_SENT_FOR_CHECK",
            pcReconciliationId: recon.id,
            actorId: ctx.session.user.id,
          },
        });
        return tx.pcReconciliation.update({
          where: { id: recon.id },
          data: { status: "PENDING_CHECK" },
          include: pcReconInclude,
        });
      });
    }),

  callback: permissionProcedure("pcrecon:update")
    .input(pcReconWorkflowActionSchema)
    .mutation(async ({ ctx, input }) => {
      const recon = await ctx.prisma.pcReconciliation.findUnique({
        where: { reportNum: input.reportNum },
      });
      if (!recon) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Reconciliation report ${input.reportNum} not found`,
        });
      }
      if (recon.status !== "PENDING_CHECK") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Callback is only allowed while awaiting check.",
        });
      }
      return ctx.prisma.$transaction(async (tx) => {
        await tx.approvalEvent.create({
          data: {
            kind: "PCRECON_CALLED_BACK",
            pcReconciliationId: recon.id,
            actorId: ctx.session.user.id,
          },
        });
        return tx.pcReconciliation.update({
          where: { id: recon.id },
          data: { status: "DRAFT" },
          include: pcReconInclude,
        });
      });
    }),

  // Checker action. PENDING_CHECK → PENDING_AUTHORIZATION.
  check: protectedProcedure
    .input(pcReconWorkflowActionSchema)
    .mutation(async ({ ctx, input }) => {
      const recon = await ctx.prisma.pcReconciliation.findUnique({
        where: { reportNum: input.reportNum },
      });
      if (!recon) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Reconciliation report ${input.reportNum} not found`,
        });
      }
      if (recon.status !== "PENDING_CHECK") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Report is not awaiting check.",
        });
      }
      if (recon.checkedById !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the assigned checker can check this report.",
        });
      }
      await assertActorHasSignature(ctx.prisma, ctx.session.user.id);

      return ctx.prisma.$transaction(async (tx) => {
        await tx.approvalEvent.create({
          data: {
            kind: "PCRECON_CHECKED",
            pcReconciliationId: recon.id,
            actorId: ctx.session.user.id,
          },
        });
        return tx.pcReconciliation.update({
          where: { id: recon.id },
          data: { status: "PENDING_AUTHORIZATION", checkedAt: new Date() },
          include: pcReconInclude,
        });
      });
    }),

  // Authoriser action. Final step → COMPLETED.
  authorize: protectedProcedure
    .input(pcReconWorkflowActionSchema)
    .mutation(async ({ ctx, input }) => {
      const recon = await ctx.prisma.pcReconciliation.findUnique({
        where: { reportNum: input.reportNum },
      });
      if (!recon) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Reconciliation report ${input.reportNum} not found`,
        });
      }
      if (recon.status !== "PENDING_AUTHORIZATION") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Report is not awaiting authorization.",
        });
      }
      if (recon.authorizedById !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the assigned authoriser can authorize this report.",
        });
      }
      await assertActorHasSignature(ctx.prisma, ctx.session.user.id);

      return ctx.prisma.$transaction(async (tx) => {
        await tx.approvalEvent.create({
          data: {
            kind: "PCRECON_AUTHORIZED",
            pcReconciliationId: recon.id,
            actorId: ctx.session.user.id,
          },
        });
        return tx.pcReconciliation.update({
          where: { id: recon.id },
          data: { status: "COMPLETED", authorizedAt: new Date() },
          include: pcReconInclude,
        });
      });
    }),

  reject: protectedProcedure
    .input(rejectPcReconSchema)
    .mutation(async ({ ctx, input }) => {
      const recon = await ctx.prisma.pcReconciliation.findUnique({
        where: { reportNum: input.reportNum },
      });
      if (!recon) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Reconciliation report ${input.reportNum} not found`,
        });
      }

      const userId = ctx.session.user.id;
      let isAllowed = false;
      if (recon.status === "PENDING_CHECK") {
        isAllowed = recon.checkedById === userId;
      } else if (recon.status === "PENDING_AUTHORIZATION") {
        isAllowed = recon.authorizedById === userId;
      }
      if (!isAllowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Only the assignee for the current stage can reject this report.",
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        await tx.approvalEvent.create({
          data: {
            kind: "PCRECON_REJECTED",
            pcReconciliationId: recon.id,
            actorId: userId,
            comment: input.comment ?? null,
          },
        });
        return tx.pcReconciliation.update({
          where: { id: recon.id },
          data: {
            status: "DRAFT",
            checkedAt: null,
            authorizedAt: null,
            rejectedAt: new Date(),
            rejectedById: userId,
            rejectionComment: input.comment ?? null,
          },
          include: pcReconInclude,
        });
      });
    }),

  pdfPayload: permissionProcedure("pcrecon:read")
    .input(getPcReconByNumSchema)
    .query(async ({ ctx, input }) => {
      const recon = await ctx.prisma.pcReconciliation.findUnique({
        where: { reportNum: input.reportNum },
        include: pcReconInclude,
      });
      if (!recon) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Reconciliation report ${input.reportNum} not found`,
        });
      }

      // Prepared-by has no `*At` column — gate on "past DRAFT".
      const includePrepared = recon.status !== "DRAFT" && !!recon.preparedById;

      const [preparedBy, checkedBy, authorizedBy] = await Promise.all([
        includePrepared
          ? getSignatureDataUrl(ctx.prisma, recon.preparedById)
          : Promise.resolve(null),
        recon.checkedAt
          ? getSignatureDataUrl(ctx.prisma, recon.checkedById)
          : Promise.resolve(null),
        recon.authorizedAt
          ? getSignatureDataUrl(ctx.prisma, recon.authorizedById)
          : Promise.resolve(null),
      ]);

      return {
        ...recon,
        signatures: { preparedBy, checkedBy, authorizedBy },
      };
    }),
});
