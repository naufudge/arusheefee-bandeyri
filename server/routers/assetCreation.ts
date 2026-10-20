import { router, protectedProcedure, permissionProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import type {
  Prisma,
  PrismaClient,
  AssetCreationStatus,
  ApprovalEventKind,
} from "@prisma/client";
import {
  createAssetCreationSchema,
  updateAssetCreationSchema,
  assetCreationByNumSchema,
  nextFormNumsSchema,
  sapUpdateSchema,
  rejectAssetCreationSchema,
} from "../schemas/assetCreation.schema";
import { assertActorHasSignature, getSignatureDataUrl } from "../lib/approval";
import { resolveGlAccountIds } from "../lib/glAccounts";
import { getAssetCoding } from "../lib/settings";
import { assertProcurementSlot, procurementBackLink } from "../lib/procurement";
import { nextAssetItem } from "../lib/assetNumbers";
import {
  STAGE_ROLE,
  isPendingStatus,
  nextFormNums,
  perPiecePrice,
  type AcRole,
} from "@/lib/asset-creation";
import { assetClassByCode, lvaProblem } from "@/lib/asset-classes";
import { buildPrefix } from "@/lib/assetNumber";

const staffSelect = {
  select: { id: true, name: true, designation: true, idCardNo: true },
} as const;

const baseInclude = {
  glAccount: { select: { code: true, longTextEn: true } },
  requestedBy: staffSelect,
  authorizedBy: staffSelect,
  sapUpdatedBy: staffSelect,
  rejectedBy: staffSelect,
  forms: {
    orderBy: { position: "asc" },
    include: {
      // Register entries made from the form once the set was completed.
      assets: { select: { id: true, assetNum: true }, orderBy: { assetNum: "asc" } },
    },
  },
  procurement: procurementBackLink,
} as const;

const fullInclude = {
  ...baseInclude,
  approvalEvents: {
    include: {
      actor: { select: { id: true, name: true, designation: true } },
    },
    orderBy: { createdAt: "asc" },
  },
} as const;

const roleField = {
  requestedBy: "requestedById",
  authorizedBy: "authorizedById",
  sapUpdatedBy: "sapUpdatedById",
} as const satisfies Record<AcRole, string>;

// Register entries for a large set are one bulk insert; the headroom covers a
// slow link.
const TX_OPTIONS = { timeout: 15000 } as const;

export const assetCreationRouter = router({
  list: permissionProcedure("assetcreation:read").query(async ({ ctx }) => {
    return ctx.prisma.assetCreation.findMany({
      include: baseInclude,
      orderBy: { createdAt: "desc" },
    });
  }),

  // Any of the set's form numbers finds it.
  getByNum: permissionProcedure("assetcreation:read")
    .input(assetCreationByNumSchema)
    .query(async ({ ctx, input }) => {
      const ac = await ctx.prisma.assetCreation.findFirst({
        where: { forms: { some: { formNum: input.formNum } } },
        include: fullInclude,
      });
      if (!ac) throw notFound(input.formNum);
      return ac;
    }),

  // The next free form numbers for this year, for the create form. Editable
  // there.
  nextNumbers: permissionProcedure("assetcreation:create")
    .input(nextFormNumsSchema)
    .query(async ({ ctx, input }) => {
      const { businessArea } = await getAssetCoding(ctx.prisma);
      const year = new Date().getFullYear();
      const rows = await ctx.prisma.assetCreationForm.findMany({
        where: { formNum: { startsWith: `${businessArea}/${year}/` } },
        select: { formNum: true },
      });
      return nextFormNums(
        businessArea,
        year,
        rows.map((r) => r.formNum),
        input.count,
      );
    }),

  create: permissionProcedure("assetcreation:create")
    .input(createAssetCreationSchema)
    .mutation(async ({ ctx, input }) => {
      const { forms, procurementId, ...fields } = input;

      await assertFormNumsFree(ctx.prisma, forms.map((f) => f.formNum));
      const glAccountId = await glAccountForClass(ctx.prisma, fields.requestedAssetClass);
      await assertProcurementSlot(
        ctx.prisma,
        procurementId,
        "assetCreation",
        ctx.session.permissions,
      );

      const ac = await ctx.prisma.assetCreation.create({
        data: {
          ...fields,
          glAccountId,
          procurementId: procurementId ?? null,
          forms: {
            create: forms.map((f, position) => ({
              position,
              formNum: f.formNum,
              sapAssetNum: f.sapAssetNum || null,
            })),
          },
        },
        select: { id: true },
      });
      return { id: ac.id, formNum: forms[0].formNum };
    }),

  // Only drafts, unless the editor holds the edit_locked override. Forms are
  // matched by position, so a completed set's register entries stay linked
  // to their forms.
  update: permissionProcedure("assetcreation:update")
    .input(updateAssetCreationSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, forms, ...fields } = input;

      const existing = await ctx.prisma.assetCreation.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          forms: { select: { id: true, position: true, formNum: true } },
        },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Asset creation form not found" });
      }
      if (
        existing.status !== "DRAFT" &&
        !ctx.session.permissions?.includes("assetcreation:edit_locked")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This set has been sent: call it back to draft before editing.",
        });
      }

      await assertFormNumsFree(ctx.prisma, forms.map((f) => f.formNum), id);
      const glAccountId = await glAccountForClass(ctx.prisma, fields.requestedAssetClass);

      await ctx.prisma.$transaction(async (tx) => {
        const byPosition = new Map(existing.forms.map((f) => [f.position, f]));
        await tx.assetCreationForm.deleteMany({
          where: { assetCreationId: id, position: { gte: forms.length } },
        });
        // Park renumbered forms on a placeholder first, so swapping two
        // numbers doesn't trip the unique index.
        const renumbered = forms
          .map((f, position) => ({ f, row: byPosition.get(position) }))
          .filter(({ f, row }) => row && row.formNum !== f.formNum);
        for (const { row } of renumbered) {
          await tx.assetCreationForm.update({
            where: { id: row!.id },
            data: { formNum: `~${row!.id}` },
          });
        }
        for (const [position, f] of forms.entries()) {
          const row = byPosition.get(position);
          const data = { formNum: f.formNum, sapAssetNum: f.sapAssetNum || null };
          if (row) {
            await tx.assetCreationForm.update({ where: { id: row.id }, data });
          } else {
            await tx.assetCreationForm.create({
              data: { ...data, position, assetCreationId: id },
            });
          }
        }
        await tx.assetCreation.update({
          where: { id },
          data: { ...fields, glAccountId },
        });
      }, TX_OPTIONS);

      return { formNum: forms[0].formNum };
    }),

  // Register entries made from the set are kept (their link is cleared).
  delete: permissionProcedure("assetcreation:delete")
    .input(assetCreationByNumSchema)
    .mutation(async ({ ctx, input }) => {
      const ac = await findOr404(ctx.prisma, input.formNum);
      await ctx.prisma.assetCreation.delete({ where: { id: ac.id } });
      return { success: true };
    }),

  // DRAFT → PENDING_AUTHORIZATION. Sending is the requester's signature, so
  // only the assigned requester can do it.
  send: protectedProcedure
    .input(assetCreationByNumSchema)
    .mutation(async ({ ctx, input }) => {
      const ac = await findOr404(ctx.prisma, input.formNum);
      const userId = ctx.session.user.id;

      if (ac.status !== "DRAFT") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only a draft set can be sent.",
        });
      }
      if (!ac.requestedById) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Choose who is requesting this before sending it.",
        });
      }
      if (ac.requestedById !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the requester can send this set.",
        });
      }

      const problem = sendProblem(ac);
      if (problem) throw new TRPCError({ code: "BAD_REQUEST", message: problem });

      await assertActorHasSignature(ctx.prisma, userId);

      return transition(ctx.prisma, ac.id, userId, "AC_SENT", {
        status: "PENDING_AUTHORIZATION",
        sentAt: new Date(),
        rejectedAt: null,
        rejectedById: null,
        rejectionComment: null,
      });
    }),

  // Any pending stage → DRAFT. The requester, or anyone who may edit.
  callback: protectedProcedure
    .input(assetCreationByNumSchema)
    .mutation(async ({ ctx, input }) => {
      const ac = await findOr404(ctx.prisma, input.formNum);
      const userId = ctx.session.user.id;

      if (!isPendingStatus(ac.status)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only a set that is awaiting a signature can be called back.",
        });
      }
      const canEdit = ctx.session.permissions?.includes("assetcreation:update");
      if (ac.requestedById !== userId && !canEdit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the requester can call this set back.",
        });
      }

      return transition(ctx.prisma, ac.id, userId, "AC_CALLED_BACK", {
        status: "DRAFT",
        ...CLEARED_STAMPS,
      });
    }),

  // Authoriser. → PENDING_SAP_UPDATE.
  authorize: protectedProcedure
    .input(assetCreationByNumSchema)
    .mutation(async ({ ctx, input }) => {
      const ac = await assertStage(ctx, input.formNum, "PENDING_AUTHORIZATION");
      return transition(ctx.prisma, ac.id, ctx.session.user.id, "AC_AUTHORIZED", {
        status: "PENDING_SAP_UPDATE",
        authorizedAt: new Date(),
      });
    }),

  // SAP updater: records each form's SAP asset number and the confirmed asset
  // class, then signs. Final step → COMPLETED. A Create set also adds its
  // asset register entries, one per piece, in the same transaction.
  sapUpdate: protectedProcedure
    .input(sapUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const ac = await assertStage(ctx, input.formNum, "PENDING_SAP_UPDATE");
      const forms = await ctx.prisma.assetCreationForm.findMany({
        where: { assetCreationId: ac.id },
        orderBy: { position: "asc" },
      });

      const sapNums = new Map(input.sapAssetNums.map((s) => [s.formId, s.sapAssetNum]));
      const missing = forms.find((f) => !sapNums.get(f.id));
      if (missing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Enter the SAP asset number for form ${missing.formNum}.`,
        });
      }

      // The confirmed class may differ from the requested one.
      const lva = lvaProblem(input.assetClass, ac.originalValue);
      if (lva) throw new TRPCError({ code: "BAD_REQUEST", message: lva });

      const register = ac.requestType === "CREATE" ? registerPrefix(ac) : null;
      if (ac.requestType === "CREATE" && !register) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "The asset register category is incomplete, so the register entries can't be numbered. Ask the requester to fix it.",
        });
      }

      const actorId = ctx.session.user.id;
      const entries = register ? forms.length * ac.quantity : 0;
      const nums = forms.map((f) => sapNums.get(f.id)!);
      const comment =
        `SAP asset no. ${nums.length === 1 ? nums[0] : `${nums[0]} … ${nums[nums.length - 1]}`}` +
        (entries > 0 ? ` · ${entries} register ${entries === 1 ? "entry" : "entries"} added` : "");

      await ctx.prisma.$transaction(async (tx) => {
        for (const f of forms) {
          await tx.assetCreationForm.update({
            where: { id: f.id },
            data: { sapAssetNum: sapNums.get(f.id) },
          });
        }

        if (register) {
          let item = await nextAssetItem(tx, register.item);
          const price = perPiecePrice(ac.originalValue, ac.quantity);
          await tx.asset.createMany({
            data: forms.flatMap((f) =>
              Array.from({ length: ac.quantity }, () => ({
                assetNum: `${register.prefix}${item++}`,
                SAPassetNum: sapNums.get(f.id)!,
                assetName: ac.description1,
                classification: input.assetClass,
                presentLocation: ac.location,
                date: ac.acquisitionDate,
                datePrecision: ac.acquisitionPrecision,
                price,
                condition: "Good",
                category: ac.registerCategory!,
                subcategory: ac.registerSubcategory,
                assetType: ac.registerAssetType,
                procurementId: ac.procurementId,
                assetCreationFormId: f.id,
              })),
            ),
          });
        }

        await tx.approvalEvent.create({
          data: { kind: "AC_SAP_UPDATED", assetCreationId: ac.id, actorId, comment },
        });
        await tx.assetCreation.update({
          where: { id: ac.id },
          data: {
            status: "COMPLETED",
            sapUpdatedAt: new Date(),
            assetClass: input.assetClass,
          },
        });
      }, TX_OPTIONS);

      return { status: "COMPLETED" as const, registered: entries };
    }),

  // The current stage's assignee sends it back to DRAFT with a comment.
  reject: protectedProcedure
    .input(rejectAssetCreationSchema)
    .mutation(async ({ ctx, input }) => {
      const ac = await findOr404(ctx.prisma, input.formNum);
      const userId = ctx.session.user.id;

      const role = isPendingStatus(ac.status) ? STAGE_ROLE[ac.status] : null;
      if (!role || ac[roleField[role]] !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the person whose signature is awaited can reject this set.",
        });
      }

      return transition(
        ctx.prisma,
        ac.id,
        userId,
        "AC_REJECTED",
        {
          status: "DRAFT",
          ...CLEARED_STAMPS,
          rejectedAt: new Date(),
          rejectedById: userId,
          rejectionComment: input.comment ?? null,
        },
        input.comment ?? null,
      );
    }),

  // The set plus each signatory's signature, included only once they've
  // signed.
  pdfPayload: permissionProcedure("assetcreation:read")
    .input(assetCreationByNumSchema)
    .query(async ({ ctx, input }) => {
      const ac = await ctx.prisma.assetCreation.findFirst({
        where: { forms: { some: { formNum: input.formNum } } },
        include: baseInclude,
      });
      if (!ac) throw notFound(input.formNum);

      const signed = (at: Date | null, staffId: string | null) =>
        at && staffId ? getSignatureDataUrl(ctx.prisma, staffId) : Promise.resolve(null);
      const [requestedBy, authorizedBy, sapUpdatedBy] = await Promise.all([
        signed(ac.sentAt, ac.requestedById),
        signed(ac.authorizedAt, ac.authorizedById),
        signed(ac.sapUpdatedAt, ac.sapUpdatedById),
      ]);

      return { ...ac, signatures: { requestedBy, authorizedBy, sapUpdatedBy } };
    }),
});

// ----- helpers -----

type Db = PrismaClient;
type AssetCreationRow = NonNullable<Awaited<ReturnType<Db["assetCreation"]["findFirst"]>>>;

// Back to draft: every signature is cleared.
const CLEARED_STAMPS = {
  sentAt: null,
  authorizedAt: null,
  sapUpdatedAt: null,
} as const;

const notFound = (formNum: string) =>
  new TRPCError({
    code: "NOT_FOUND",
    message: `Asset creation form ${formNum} not found`,
  });

async function findOr404(db: Db, formNum: string) {
  const ac = await db.assetCreation.findFirst({
    where: { forms: { some: { formNum } } },
  });
  if (!ac) throw notFound(formNum);
  return ac;
}

// Every number must be unused by other sets.
async function assertFormNumsFree(db: Db, formNums: string[], exceptSetId?: string) {
  const taken = await db.assetCreationForm.findMany({
    where: {
      formNum: { in: formNums },
      ...(exceptSetId ? { assetCreationId: { not: exceptSetId } } : {}),
    },
    select: { formNum: true },
  });
  if (taken.length > 0) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        taken.length === 1
          ? `Form ${taken[0].formNum} already exists.`
          : `Forms ${taken.map((t) => t.formNum).join(", ")} already exist.`,
    });
  }
}

// The asset class decides the GL code the asset is capitalised under.
async function glAccountForClass(db: Db, classCode: string) {
  const assetClass = assetClassByCode(classCode)!;
  const ids = await resolveGlAccountIds(db, [assetClass.glCode]);
  return ids.get(assetClass.glCode)!;
}

/**
 * The asset-number prefix the set's register entries are numbered under, or
 * null when its register category doesn't resolve to one. The year is the
 * acquisition year, else this year.
 */
function registerPrefix(ac: AssetCreationRow) {
  const year = (ac.acquisitionDate ?? new Date()).getUTCFullYear();
  const built = buildPrefix({
    year: String(year),
    category: ac.registerCategory ?? "",
    subcategory: ac.registerSubcategory ?? "",
    assetType: ac.registerAssetType ?? "",
  });
  if (!built.prefix || !built.yy) return null;
  return {
    prefix: built.prefix,
    item: {
      yy: built.yy,
      mainNum: built.path.mainNum!,
      subNum: built.path.subNum!,
      typeNum: built.path.typeNum,
      variantNum: built.path.variantNum ?? null,
      noType: built.leafSubcategory,
    },
  };
}

// The set must be at `status`, and the caller must be that stage's assigned
// signatory with a signature on file.
async function assertStage(
  ctx: { prisma: Db; session: { user: { id: string } } },
  formNum: string,
  status: keyof typeof STAGE_ROLE,
) {
  const ac = await findOr404(ctx.prisma, formNum);
  if (ac.status !== status) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This set isn't awaiting that signature.",
    });
  }
  if (ac[roleField[STAGE_ROLE[status]]] !== ctx.session.user.id) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the assigned signatory can sign at this stage.",
    });
  }
  await assertActorHasSignature(ctx.prisma, ctx.session.user.id);
  return ac;
}

// One workflow step: an approval-timeline event plus the status change.
async function transition(
  db: Db,
  id: string,
  actorId: string,
  kind: ApprovalEventKind,
  data: Prisma.AssetCreationUncheckedUpdateInput & { status: AssetCreationStatus },
  comment: string | null = null,
) {
  await db.$transaction([
    db.approvalEvent.create({
      data: { kind, assetCreationId: id, actorId, comment },
    }),
    db.assetCreation.update({ where: { id }, data }),
  ]);
  return { status: data.status };
}

// Why a set can't be sent yet, or null when it's ready.
function sendProblem(ac: AssetCreationRow): string | null {
  if (!ac.authorizedById) return "Choose who authorises this before sending.";
  if (!ac.sapUpdatedById) return "Choose who updates the SAP asset master before sending.";

  const assetClass = assetClassByCode(ac.requestedAssetClass);
  if (
    ac.usefulLifeYears != null &&
    assetClass &&
    ac.usefulLifeYears !== assetClass.defaultLife &&
    !ac.usefulLifeReason?.trim()
  ) {
    return `Give the reason for changing the useful life from ${assetClass.defaultLife} years before sending.`;
  }

  const lva = lvaProblem(ac.requestedAssetClass, ac.originalValue);
  if (lva) return lva;

  if (ac.requestType === "CREATE" && !registerPrefix(ac)) {
    return "Choose where the asset goes in the asset register (category, subcategory and type) before sending.";
  }
  return null;
}
