import { router, protectedProcedure, permissionProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  createPvSchema,
  updatePvSchema,
  getPvByNumSchema,
  deletePvSchema,
  yearFilterSchema,
  pvWorkflowActionSchema,
  rejectPvSchema,
} from "../schemas/pv.schema";
import {
  assertActorHasSignature,
  getSignatureDataUrl,
} from "../lib/approval";

// Common include for PV queries with all relations. The approvalEvents
// array drives the timeline on the detail page.
const pvInclude = {
  preparedBy: true,
  verifiedBy: true,
  authorisedByOne: true,
  authorisedByTwo: true,
  rejectedBy: true,
  postedBy: true,
  invoices: {
    include: {
      glDetails: true,
    },
  },
  approvalEvents: {
    include: {
      actor: { select: { id: true, name: true, designation: true } },
    },
    orderBy: { createdAt: "asc" },
  },
} as const;

export const pvRouter = router({
  // GET /pvs - List all PVs with relations
  list: permissionProcedure("pv:read").query(async ({ ctx }) => {
    return ctx.prisma.pV.findMany({
      include: pvInclude,
      orderBy: { createdAt: "desc" },
    });
  }),

  // GET /pvs/{pvNum} - Get PV by number
  getByNum: permissionProcedure("pv:read")
    .input(getPvByNumSchema)
    .query(async ({ ctx, input }) => {
      const pv = await ctx.prisma.pV.findUnique({
        where: { pvNum: input.pvNum },
        include: pvInclude,
      });

      if (!pv) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `PV ${input.pvNum} not found`,
        });
      }

      return pv;
    }),

  // GET /pv/latest - Get most recent PV
  latest: permissionProcedure("pv:read").query(async ({ ctx }) => {
    const pv = await ctx.prisma.pV.findFirst({
      orderBy: { createdAt: "desc" },
      include: pvInclude,
    });

    if (!pv) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No PVs found",
      });
    }

    return pv;
  }),

  // GET /pv/year/{year} - Get PVs by fiscal year (PV.date within [year-01-01, year+1-01-01))
  byYear: permissionProcedure("pv:read")
    .input(yearFilterSchema)
    .query(async ({ ctx, input }) => {
      const yearNum = Number(input.year);
      return ctx.prisma.pV.findMany({
        where: {
          date: {
            gte: new Date(Date.UTC(yearNum, 0, 1)),
            lt: new Date(Date.UTC(yearNum + 1, 0, 1)),
          },
        },
        include: pvInclude,
        orderBy: { date: "desc" },
      });
    }),

  // GET /pv/gl/{year} - Aggregate GL totals by code for the fiscal year
  glTotalsByYear: permissionProcedure("pv:read")
    .input(yearFilterSchema)
    .query(async ({ ctx, input }) => {
      const yearNum = Number(input.year);
      const pvs = await ctx.prisma.pV.findMany({
        where: {
          date: {
            gte: new Date(Date.UTC(yearNum, 0, 1)),
            lt: new Date(Date.UTC(yearNum + 1, 0, 1)),
          },
        },
        include: {
          invoices: {
            include: {
              glDetails: true,
            },
          },
        },
      });

      // Aggregate GL totals by code
      const glTotals: Record<number, number> = {};

      for (const pv of pvs) {
        for (const invoice of pv.invoices) {
          for (const gl of invoice.glDetails) {
            if (glTotals[gl.code] === undefined) {
              glTotals[gl.code] = 0;
            }
            glTotals[gl.code] += gl.amount;
          }
        }
      }

      // Round to 2 decimal places
      for (const code in glTotals) {
        glTotals[code] = Math.round(glTotals[code] * 100) / 100;
      }

      return glTotals;
    }),

  // POST /pvs - Create PV with nested invoices/GL details
  create: permissionProcedure("pv:create")
    .input(createPvSchema)
    .mutation(async ({ ctx, input }) => {
      const { invoices, ...pvData } = input;

      // Check if pvNum already exists
      const existing = await ctx.prisma.pV.findUnique({
        where: { pvNum: pvData.pvNum },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `PV ${pvData.pvNum} already exists`,
        });
      }

      // Use nested create for PV with invoices and GL details
      return ctx.prisma.pV.create({
        data: {
          ...pvData,
          invoices: {
            create: invoices.map((invoice) => ({
              comments: invoice.comments,
              documentNum: invoice.documentNum,
              invoiceNumber: invoice.invoiceNumber,
              invoiceDate: invoice.invoiceDate,
              invoiceTotal: invoice.invoiceTotal,
              glDetails: {
                create: invoice.glDetails.map((gl) => ({
                  code: gl.code,
                  fund: gl.fund,
                  amount: gl.amount,
                })),
              },
            })),
          },
        },
        include: pvInclude,
      });
    }),

  // PUT /pvs - Update PV (delete and recreate invoices/GL).
  // Locked unless the PV is in DRAFT: post-rejection editing is unblocked
  // automatically because reject sets status back to DRAFT.
  update: permissionProcedure("pv:update")
    .input(updatePvSchema)
    .mutation(async ({ ctx, input }) => {
      const { invoices, pvNum, ...pvUpdateData } = input;

      const existing = await ctx.prisma.pV.findUnique({
        where: { pvNum },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `PV ${pvNum} not found`,
        });
      }

      // `pv:edit_locked` is an override that bypasses the DRAFT lock.
      // `pv:update` (the procedure-level gate) is still required; this
      // just relaxes the workflow check on top.
      if (
        existing.status !== "DRAFT" &&
        !ctx.session.permissions?.includes("pv:edit_locked")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "PV is locked: callback it back to DRAFT before editing.",
        });
      }

      // Use transaction to handle nested updates atomically
      return ctx.prisma.$transaction(async (tx) => {
        // Delete existing invoices (cascade deletes GL details)
        await tx.invoice.deleteMany({
          where: { pvId: existing.id },
        });

        // Update PV and recreate invoices
        return tx.pV.update({
          where: { pvNum },
          data: {
            ...pvUpdateData,
            invoices: {
              create: invoices.map((invoice) => ({
                comments: invoice.comments,
                documentNum: invoice.documentNum,
                invoiceNumber: invoice.invoiceNumber,
                invoiceDate: invoice.invoiceDate,
                invoiceTotal: invoice.invoiceTotal,
                glDetails: {
                  create: invoice.glDetails.map((gl) => ({
                    code: gl.code,
                    fund: gl.fund,
                    amount: gl.amount,
                  })),
                },
              })),
            },
          },
          include: pvInclude,
        });
      });
    }),

  // DELETE /pvs/{pvNum} - Delete PV
  delete: permissionProcedure("pv:delete")
    .input(deletePvSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.pV.findUnique({
        where: { pvNum: input.pvNum },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `PV ${input.pvNum} not found`,
        });
      }

      // Cascade delete handles invoices and glDetails
      await ctx.prisma.pV.delete({
        where: { pvNum: input.pvNum },
      });

      return { success: true };
    }),

  // ----- Approval workflow mutations -----

  // Move DRAFT → PENDING_VERIFICATION. Requires `pv:update` and a verifier
  // assigned (without one there's no possible next step).
  send: permissionProcedure("pv:update")
    .input(pvWorkflowActionSchema)
    .mutation(async ({ ctx, input }) => {
      const pv = await ctx.prisma.pV.findUnique({
        where: { pvNum: input.pvNum },
      });
      if (!pv) {
        throw new TRPCError({ code: "NOT_FOUND", message: `PV ${input.pvNum} not found` });
      }
      if (pv.status !== "DRAFT") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only DRAFT PVs can be sent for verification.",
        });
      }
      if (!pv.verifiedById) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Assign a verifier before sending for verification.",
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        await tx.approvalEvent.create({
          data: {
            kind: "SENT_FOR_VERIFICATION",
            pvId: pv.id,
            actorId: ctx.session.user.id,
          },
        });
        return tx.pV.update({
          where: { id: pv.id },
          data: { status: "PENDING_VERIFICATION" },
          include: pvInclude,
        });
      });
    }),

  // Callback a PENDING_VERIFICATION PV back to DRAFT. Only legal while the
  // verifier hasn't acted yet — once verified, the flow is past callback.
  callback: permissionProcedure("pv:update")
    .input(pvWorkflowActionSchema)
    .mutation(async ({ ctx, input }) => {
      const pv = await ctx.prisma.pV.findUnique({
        where: { pvNum: input.pvNum },
      });
      if (!pv) {
        throw new TRPCError({ code: "NOT_FOUND", message: `PV ${input.pvNum} not found` });
      }
      if (pv.status !== "PENDING_VERIFICATION") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Callback is only allowed while awaiting verification.",
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        await tx.approvalEvent.create({
          data: {
            kind: "CALLED_BACK",
            pvId: pv.id,
            actorId: ctx.session.user.id,
          },
        });
        return tx.pV.update({
          where: { id: pv.id },
          data: { status: "DRAFT" },
          include: pvInclude,
        });
      });
    }),

  // Verifier action. Strict assignee gate. Advances to authorisation stage.
  verify: protectedProcedure
    .input(pvWorkflowActionSchema)
    .mutation(async ({ ctx, input }) => {
      const pv = await ctx.prisma.pV.findUnique({
        where: { pvNum: input.pvNum },
      });
      if (!pv) {
        throw new TRPCError({ code: "NOT_FOUND", message: `PV ${input.pvNum} not found` });
      }
      if (pv.status !== "PENDING_VERIFICATION") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "PV is not awaiting verification.",
        });
      }
      if (pv.verifiedById !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the assigned verifier can verify this PV.",
        });
      }
      await assertActorHasSignature(ctx.prisma, ctx.session.user.id);

      return ctx.prisma.$transaction(async (tx) => {
        await tx.approvalEvent.create({
          data: {
            kind: "VERIFIED",
            pvId: pv.id,
            actorId: ctx.session.user.id,
          },
        });
        return tx.pV.update({
          where: { id: pv.id },
          data: {
            status: "PENDING_AUTHORISATION_ONE",
            verifiedAt: new Date(),
          },
          include: pvInclude,
        });
      });
    }),

  // Authoriser stage 1. Advances to stage 2 if a second authoriser is
  // assigned; otherwise jumps straight to APPROVED.
  authoriseOne: protectedProcedure
    .input(pvWorkflowActionSchema)
    .mutation(async ({ ctx, input }) => {
      const pv = await ctx.prisma.pV.findUnique({
        where: { pvNum: input.pvNum },
      });
      if (!pv) {
        throw new TRPCError({ code: "NOT_FOUND", message: `PV ${input.pvNum} not found` });
      }
      if (pv.status !== "PENDING_AUTHORISATION_ONE") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "PV is not awaiting first authorisation.",
        });
      }
      if (pv.authorisedByOneId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the assigned first authoriser can authorise this PV.",
        });
      }
      await assertActorHasSignature(ctx.prisma, ctx.session.user.id);

      const nextStatus = pv.authorisedByTwoId
        ? "PENDING_AUTHORISATION_TWO"
        : "APPROVED";

      return ctx.prisma.$transaction(async (tx) => {
        await tx.approvalEvent.create({
          data: {
            kind: "AUTHORISED_ONE",
            pvId: pv.id,
            actorId: ctx.session.user.id,
          },
        });
        return tx.pV.update({
          where: { id: pv.id },
          data: {
            status: nextStatus,
            authorisedByOneAt: new Date(),
          },
          include: pvInclude,
        });
      });
    }),

  // Authoriser stage 2. Final step → APPROVED.
  authoriseTwo: protectedProcedure
    .input(pvWorkflowActionSchema)
    .mutation(async ({ ctx, input }) => {
      const pv = await ctx.prisma.pV.findUnique({
        where: { pvNum: input.pvNum },
      });
      if (!pv) {
        throw new TRPCError({ code: "NOT_FOUND", message: `PV ${input.pvNum} not found` });
      }
      if (pv.status !== "PENDING_AUTHORISATION_TWO") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "PV is not awaiting second authorisation.",
        });
      }
      if (pv.authorisedByTwoId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the assigned second authoriser can authorise this PV.",
        });
      }
      await assertActorHasSignature(ctx.prisma, ctx.session.user.id);

      return ctx.prisma.$transaction(async (tx) => {
        await tx.approvalEvent.create({
          data: {
            kind: "AUTHORISED_TWO",
            pvId: pv.id,
            actorId: ctx.session.user.id,
          },
        });
        return tx.pV.update({
          where: { id: pv.id },
          data: {
            status: "APPROVED",
            authorisedByTwoAt: new Date(),
          },
          include: pvInclude,
        });
      });
    }),

  // Post an APPROVED PV. Permission-gated (`pv:post`) rather than
  // assignee-gated — any holder can post. Requires the actor to have a
  // signature on file (stamped onto the PDF). Terminal: POSTED.
  post: permissionProcedure("pv:post")
    .input(pvWorkflowActionSchema)
    .mutation(async ({ ctx, input }) => {
      const pv = await ctx.prisma.pV.findUnique({
        where: { pvNum: input.pvNum },
      });
      if (!pv) {
        throw new TRPCError({ code: "NOT_FOUND", message: `PV ${input.pvNum} not found` });
      }
      if (pv.status !== "APPROVED") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only an approved PV can be posted.",
        });
      }
      await assertActorHasSignature(ctx.prisma, ctx.session.user.id);

      const now = new Date();
      return ctx.prisma.$transaction(async (tx) => {
        await tx.approvalEvent.create({
          data: {
            kind: "POSTED",
            pvId: pv.id,
            actorId: ctx.session.user.id,
          },
        });
        return tx.pV.update({
          where: { id: pv.id },
          data: {
            status: "POSTED",
            postedAt: now,
            postedById: ctx.session.user.id,
            // Mirror onto the legacy `postingDate` column so existing
            // display/exports (e.g. the lifecycle "Posted" step) reflect it.
            postingDate: now,
          },
          include: pvInclude,
        });
      });
    }),

  // Reject from any pending stage. The current-stage assignee is the only
  // one allowed to reject. Drops the PV back to DRAFT, clears the `*At`
  // columns so the PDF doesn't render stale signatures, and records the
  // rejection with optional comment.
  reject: protectedProcedure
    .input(rejectPvSchema)
    .mutation(async ({ ctx, input }) => {
      const pv = await ctx.prisma.pV.findUnique({
        where: { pvNum: input.pvNum },
      });
      if (!pv) {
        throw new TRPCError({ code: "NOT_FOUND", message: `PV ${input.pvNum} not found` });
      }

      const userId = ctx.session.user.id;
      let isAllowed = false;
      if (pv.status === "PENDING_VERIFICATION") {
        isAllowed = pv.verifiedById === userId;
      } else if (pv.status === "PENDING_AUTHORISATION_ONE") {
        isAllowed = pv.authorisedByOneId === userId;
      } else if (pv.status === "PENDING_AUTHORISATION_TWO") {
        isAllowed = pv.authorisedByTwoId === userId;
      }

      if (!isAllowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Only the assignee for the current stage can reject this PV.",
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        await tx.approvalEvent.create({
          data: {
            kind: "REJECTED",
            pvId: pv.id,
            actorId: userId,
            comment: input.comment ?? null,
          },
        });
        return tx.pV.update({
          where: { id: pv.id },
          data: {
            status: "DRAFT",
            verifiedAt: null,
            authorisedByOneAt: null,
            authorisedByTwoAt: null,
            rejectedAt: new Date(),
            rejectedById: userId,
            rejectionComment: input.comment ?? null,
          },
          include: pvInclude,
        });
      });
    }),

  // PDF payload — same as getByNum plus a base64 signature map for each
  // signatory whose stage has been approved. Pre-fetching server-side
  // keeps SharePoint URLs out of the browser and avoids react-pdf doing
  // blocking HTTP during render.
  pdfPayload: permissionProcedure("pv:read")
    .input(getPvByNumSchema)
    .query(async ({ ctx, input }) => {
      const pv = await ctx.prisma.pV.findUnique({
        where: { pvNum: input.pvNum },
        include: pvInclude,
      });
      if (!pv) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `PV ${input.pvNum} not found`,
        });
      }

      // Prepared-by has no `*At` column — gate on "past DRAFT" instead:
      // once a PV has been sent, the prepared-by signature is final.
      const includePrepared = pv.status !== "DRAFT" && !!pv.preparedById;

      const [preparedBy, verifiedBy, authorisedByOne, authorisedByTwo, postedBy] =
        await Promise.all([
          includePrepared
            ? getSignatureDataUrl(ctx.prisma, pv.preparedById)
            : Promise.resolve(null),
          pv.verifiedAt
            ? getSignatureDataUrl(ctx.prisma, pv.verifiedById)
            : Promise.resolve(null),
          pv.authorisedByOneAt
            ? getSignatureDataUrl(ctx.prisma, pv.authorisedByOneId)
            : Promise.resolve(null),
          pv.authorisedByTwoAt
            ? getSignatureDataUrl(ctx.prisma, pv.authorisedByTwoId)
            : Promise.resolve(null),
          pv.postedAt
            ? getSignatureDataUrl(ctx.prisma, pv.postedById)
            : Promise.resolve(null),
        ]);

      return {
        ...pv,
        signatures: {
          preparedBy,
          verifiedBy,
          authorisedByOne,
          authorisedByTwo,
          postedBy,
        },
      };
    }),
});
