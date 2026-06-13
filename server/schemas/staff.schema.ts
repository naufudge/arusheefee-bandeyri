import { z } from "zod";

// Input for creating staff
export const createStaffSchema = z.object({
  name: z.string().min(1, "Name is required"),
  designation: z.string().min(1, "Designation is required"),
  dhivehiName: z.string().optional(),
  dhivehiDesignation: z.string().optional(),
  /** Optional list of Role ids to assign on creation. */
  roleIds: z.array(z.string().cuid()).optional(),
});

// Input for updating staff
export const updateStaffSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).optional(),
  designation: z.string().min(1).optional(),
  dhivehiName: z.string().optional(),
  dhivehiDesignation: z.string().optional(),
  /**
   * If provided, replaces the staff's role assignments with this exact set
   * (uses Prisma's `set` connection semantic).
   */
  roleIds: z.array(z.string().cuid()).optional(),
});

// Input for deleting staff
export const deleteStaffSchema = z.object({
  id: z.string().cuid(),
});

// Types
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type DeleteStaffInput = z.infer<typeof deleteStaffSchema>;
