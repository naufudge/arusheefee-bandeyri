import { z } from 'zod'

const userSchema = z.object({
  name: z.string().min(10),
  designation: z.string().min(10),
})

export const PvSchema = z.object({
  pvNum: z.coerce.number().gt(0),
  businessArea: z.coerce.number().default(1506),
  agency: z.string().default("National Archives of Maldives"),
  vendor: z.string().min(1),
  date: z.date(),
  notes: z.string().min(10),
  currency: z.string().default("MVR"),
  exchangeRate: z.coerce.number().default(1),

  // numOfInvoice: z.coerce.number().default(1), // Number of invoices for which the user is making the PV for

  invoiceDetails: z.array(
    z.object({
      comments: z.string().min(10),
      invoiceNumber: z.string().min(1),
      invoiceDate: z.date().optional().nullable(),
      invoiceTotal: z.coerce.number().gt(0),
      glDetails: z.array(z.object({
        code: z.coerce.number().gt(100000),
        fund: z.string().default("C-GOM"),
        amount: z.coerce.number().gt(0)
      })),
    })
  ),

  preparedBy: userSchema,
  verifiedBy: userSchema,
  authorisedByOne: userSchema,
  authorisedByTwo: z.object({
    name: z.string().optional(),
    designation: z.string().optional()
  }),

  poNum: z.string().optional(),
  paymentMethod: z.string(),
  parkedDate: z.date().optional().nullable(),
  postingDate: z.date().optional().nullable(),
  clearingDoc: z.object({num: z.string().optional(), date: z.date().optional().nullable()}),
  transferNum: z.string().optional()
})

export type PvValues = z.infer<typeof PvSchema>