import { z } from 'zod'

const userSchema = z.object({
  name: z.string().min(10),
  designation: z.string().min(10),
})

export const PvSchema = z.object({
    pvNum: z.number().gt(0),
    businessArea: z.coerce.number().default(1506),
    agency: z.string().default("National Archives of Maldives"),
    vendor: z.string().min(1),
    date: z.date(),
    notes: z.string().min(10),
    currency: z.string().default("MVR"),
    exchangeRate: z.coerce.number().default(1),
  
    numOfInvoice: z.coerce.number().default(1), // Number of invoices for which the user is making the PV for
  
    invoiceDetails: z.array(
      z.object({
        comments: z.string().min(10),
        invoiceNumber: z.string().min(1),
        invoiceDate: z.date(),
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
    authorisedByTwo: userSchema,
  })
  
  export type PvValues = z.infer<typeof PvSchema>