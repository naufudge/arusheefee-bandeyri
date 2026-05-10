import { router, permissionProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  createPvSchema,
  updatePvSchema,
  getPvByNumSchema,
  deletePvSchema,
  yearFilterSchema,
} from "../schemas/pv.schema";

// Common include for PV queries with all relations
const pvInclude = {
  preparedBy: true,
  verifiedBy: true,
  authorisedByOne: true,
  authorisedByTwo: true,
  invoices: {
    include: {
      glDetails: true,
    },
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

  // PUT /pvs - Update PV (delete and recreate invoices/GL)
  update: permissionProcedure("pv:update")
    .input(updatePvSchema)
    .mutation(async ({ ctx, input }) => {
      const { invoices, pvNum, ...pvUpdateData } = input;

      // Check if PV exists
      const existing = await ctx.prisma.pV.findUnique({
        where: { pvNum },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `PV ${pvNum} not found`,
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
});
