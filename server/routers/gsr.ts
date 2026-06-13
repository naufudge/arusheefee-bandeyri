import { router, protectedProcedure, permissionProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  createGsrSchema,
  updateGsrSchema,
  getGsrByNumSchema,
  deleteGsrSchema,
  gsrWorkflowActionSchema,
  rejectGsrSchema,
} from "../schemas/gsr.schema";
import {
  assertActorHasSignature,
  getSignatureDataUrl,
} from "../lib/approval";

// Common include for GSR queries with all relations. The approvalEvents
// array drives the timeline on the detail page.
const gsrInclude = {
  requestedBy: true,
  authorizedBy: true,
  receivedBy: true,
  rejectedBy: true,
  items: true,
  approvalEvents: {
    include: {
      actor: { select: { id: true, name: true, designation: true } },
    },
    orderBy: { createdAt: "asc" },
  },
} as const;

export const gsrRouter = router({
  // List all GSR forms with relations
  list: permissionProcedure("gsr:read").query(async ({ ctx }) => {
    return ctx.prisma.gSRForm.findMany({
      include: gsrInclude,
      orderBy: { createdAt: "desc" },
    });
  }),

  // Get a GSR form by its number
  getByNum: permissionProcedure("gsr:read")
    .input(getGsrByNumSchema)
    .query(async ({ ctx, input }) => {
      const gsr = await ctx.prisma.gSRForm.findUnique({
        where: { gsrFormNum: input.gsrFormNum },
        include: gsrInclude,
      });

      if (!gsr) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `GSR form ${input.gsrFormNum} not found`,
        });
      }

      return gsr;
    }),

  // Create a GSR form with nested line items. `gsrFormNum` is manual, so the
  // uniqueness check is load-bearing.
  create: permissionProcedure("gsr:create")
    .input(createGsrSchema)
    .mutation(async ({ ctx, input }) => {
      const { items, ...gsrData } = input;

      const existing = await ctx.prisma.gSRForm.findUnique({
        where: { gsrFormNum: gsrData.gsrFormNum },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `GSR form ${gsrData.gsrFormNum} already exists`,
        });
      }

      return ctx.prisma.gSRForm.create({
        data: {
          ...gsrData,
          items: {
            create: items.map((item) => ({
              particulars: item.particulars,
              requestedQty: item.requestedQty,
              issuedQty: item.issuedQty,
              rqdDate: item.rqdDate,
              remarks: item.remarks,
            })),
          },
        },
        include: gsrInclude,
      });
    }),

  // Update a GSR form (delete and recreate line items).
  // Locked unless the form is in DRAFT: post-rejection editing is unblocked
  // automatically because reject sets status back to DRAFT.
  update: permissionProcedure("gsr:update")
    .input(updateGsrSchema)
    .mutation(async ({ ctx, input }) => {
      const { items, gsrFormNum, ...gsrUpdateData } = input;

      const existing = await ctx.prisma.gSRForm.findUnique({
        where: { gsrFormNum },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `GSR form ${gsrFormNum} not found`,
        });
      }

      // `gsr:edit_locked` is an override that bypasses the DRAFT lock.
      // `gsr:update` (the procedure-level gate) is still required.
      if (
        existing.status !== "DRAFT" &&
        !ctx.session.permissions?.includes("gsr:edit_locked")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "GSR form is locked: call it back to DRAFT before editing.",
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        await tx.gSRItem.deleteMany({
          where: { gsrFormId: existing.id },
        });

        return tx.gSRForm.update({
          where: { gsrFormNum },
          data: {
            ...gsrUpdateData,
            items: {
              create: items.map((item) => ({
                particulars: item.particulars,
                requestedQty: item.requestedQty,
                issuedQty: item.issuedQty,
                rqdDate: item.rqdDate,
                remarks: item.remarks,
              })),
            },
          },
          include: gsrInclude,
        });
      });
    }),

  // Delete a GSR form (cascade deletes line items).
  delete: permissionProcedure("gsr:delete")
    .input(deleteGsrSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.gSRForm.findUnique({
        where: { gsrFormNum: input.gsrFormNum },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `GSR form ${input.gsrFormNum} not found`,
        });
      }

      await ctx.prisma.gSRForm.delete({
        where: { gsrFormNum: input.gsrFormNum },
      });

      return { success: true };
    }),

  // ----- Approval workflow mutations -----

  // Move DRAFT → PENDING_AUTHORIZATION. Requires `gsr:update` and an
  // authoriser assigned (without one there's no possible next step).
  send: permissionProcedure("gsr:update")
    .input(gsrWorkflowActionSchema)
    .mutation(async ({ ctx, input }) => {
      const gsr = await ctx.prisma.gSRForm.findUnique({
        where: { gsrFormNum: input.gsrFormNum },
      });
      if (!gsr) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `GSR form ${input.gsrFormNum} not found`,
        });
      }
      if (gsr.status !== "DRAFT") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only DRAFT GSR forms can be sent for authorization.",
        });
      }
      if (!gsr.authorizedById) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Assign an authoriser before sending for authorization.",
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        await tx.approvalEvent.create({
          data: {
            kind: "GSR_SENT_FOR_AUTHORIZATION",
            gsrFormId: gsr.id,
            actorId: ctx.session.user.id,
          },
        });
        return tx.gSRForm.update({
          where: { id: gsr.id },
          data: { status: "PENDING_AUTHORIZATION" },
          include: gsrInclude,
        });
      });
    }),

  // Callback a PENDING_AUTHORIZATION form back to DRAFT. Only legal while the
  // authoriser hasn't acted yet.
  callback: permissionProcedure("gsr:update")
    .input(gsrWorkflowActionSchema)
    .mutation(async ({ ctx, input }) => {
      const gsr = await ctx.prisma.gSRForm.findUnique({
        where: { gsrFormNum: input.gsrFormNum },
      });
      if (!gsr) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `GSR form ${input.gsrFormNum} not found`,
        });
      }
      if (gsr.status !== "PENDING_AUTHORIZATION") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Callback is only allowed while awaiting authorization.",
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        await tx.approvalEvent.create({
          data: {
            kind: "GSR_CALLED_BACK",
            gsrFormId: gsr.id,
            actorId: ctx.session.user.id,
          },
        });
        return tx.gSRForm.update({
          where: { id: gsr.id },
          data: { status: "DRAFT" },
          include: gsrInclude,
        });
      });
    }),

  // Authoriser action. Strict assignee gate. Advances to the receipt stage if
  // a receiver is assigned; otherwise completes the form directly.
  authorize: protectedProcedure
    .input(gsrWorkflowActionSchema)
    .mutation(async ({ ctx, input }) => {
      const gsr = await ctx.prisma.gSRForm.findUnique({
        where: { gsrFormNum: input.gsrFormNum },
      });
      if (!gsr) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `GSR form ${input.gsrFormNum} not found`,
        });
      }
      if (gsr.status !== "PENDING_AUTHORIZATION") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "GSR form is not awaiting authorization.",
        });
      }
      if (gsr.authorizedById !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the assigned authoriser can authorize this form.",
        });
      }
      await assertActorHasSignature(ctx.prisma, ctx.session.user.id);

      // Form Received By is optional — with no receiver, authorising
      // completes the form.
      const nextStatus = gsr.receivedById ? "PENDING_RECEIPT" : "COMPLETED";

      return ctx.prisma.$transaction(async (tx) => {
        await tx.approvalEvent.create({
          data: {
            kind: "GSR_AUTHORIZED",
            gsrFormId: gsr.id,
            actorId: ctx.session.user.id,
          },
        });
        return tx.gSRForm.update({
          where: { id: gsr.id },
          data: {
            status: nextStatus,
            authorizedAt: new Date(),
          },
          include: gsrInclude,
        });
      });
    }),

  // Receiver action. Strict assignee gate. Final step → COMPLETED.
  receive: protectedProcedure
    .input(gsrWorkflowActionSchema)
    .mutation(async ({ ctx, input }) => {
      const gsr = await ctx.prisma.gSRForm.findUnique({
        where: { gsrFormNum: input.gsrFormNum },
      });
      if (!gsr) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `GSR form ${input.gsrFormNum} not found`,
        });
      }
      if (gsr.status !== "PENDING_RECEIPT") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "GSR form is not awaiting receipt.",
        });
      }
      if (gsr.receivedById !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the assigned receiver can acknowledge this form.",
        });
      }
      await assertActorHasSignature(ctx.prisma, ctx.session.user.id);

      return ctx.prisma.$transaction(async (tx) => {
        await tx.approvalEvent.create({
          data: {
            kind: "GSR_RECEIVED",
            gsrFormId: gsr.id,
            actorId: ctx.session.user.id,
          },
        });
        return tx.gSRForm.update({
          where: { id: gsr.id },
          data: {
            status: "COMPLETED",
            receivedAt: new Date(),
          },
          include: gsrInclude,
        });
      });
    }),

  // Reject from any pending stage. The current-stage assignee is the only one
  // allowed to reject. Drops the form back to DRAFT, clears the `*At` columns
  // so the PDF doesn't render stale signatures, and records the rejection.
  reject: protectedProcedure
    .input(rejectGsrSchema)
    .mutation(async ({ ctx, input }) => {
      const gsr = await ctx.prisma.gSRForm.findUnique({
        where: { gsrFormNum: input.gsrFormNum },
      });
      if (!gsr) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `GSR form ${input.gsrFormNum} not found`,
        });
      }

      const userId = ctx.session.user.id;
      let isAllowed = false;
      if (gsr.status === "PENDING_AUTHORIZATION") {
        isAllowed = gsr.authorizedById === userId;
      } else if (gsr.status === "PENDING_RECEIPT") {
        isAllowed = gsr.receivedById === userId;
      }

      if (!isAllowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Only the assignee for the current stage can reject this form.",
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        await tx.approvalEvent.create({
          data: {
            kind: "GSR_REJECTED",
            gsrFormId: gsr.id,
            actorId: userId,
            comment: input.comment ?? null,
          },
        });
        return tx.gSRForm.update({
          where: { id: gsr.id },
          data: {
            status: "DRAFT",
            authorizedAt: null,
            receivedAt: null,
            rejectedAt: new Date(),
            rejectedById: userId,
            rejectionComment: input.comment ?? null,
          },
          include: gsrInclude,
        });
      });
    }),

  // PDF payload — same as getByNum plus a base64 signature map for each
  // signatory whose stage has been approved. Pre-fetching server-side keeps
  // SharePoint URLs out of the browser and avoids react-pdf doing blocking
  // HTTP during render.
  pdfPayload: permissionProcedure("gsr:read")
    .input(getGsrByNumSchema)
    .query(async ({ ctx, input }) => {
      const gsr = await ctx.prisma.gSRForm.findUnique({
        where: { gsrFormNum: input.gsrFormNum },
        include: gsrInclude,
      });
      if (!gsr) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `GSR form ${input.gsrFormNum} not found`,
        });
      }

      // Requested-by has no `*At` column — gate on "past DRAFT" instead:
      // once the form has been sent, the requested-by signature is final.
      const includeRequested = gsr.status !== "DRAFT" && !!gsr.requestedById;

      const [requestedBy, authorizedBy, receivedBy] = await Promise.all([
        includeRequested
          ? getSignatureDataUrl(ctx.prisma, gsr.requestedById)
          : Promise.resolve(null),
        gsr.authorizedAt
          ? getSignatureDataUrl(ctx.prisma, gsr.authorizedById)
          : Promise.resolve(null),
        gsr.receivedAt
          ? getSignatureDataUrl(ctx.prisma, gsr.receivedById)
          : Promise.resolve(null),
      ]);

      return {
        ...gsr,
        signatures: {
          requestedBy,
          authorizedBy,
          receivedBy,
        },
      };
    }),
});
