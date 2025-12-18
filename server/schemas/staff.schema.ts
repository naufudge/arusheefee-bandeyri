import { z } from "zod";

// Input for creating staff
export const createStaffSchema = z.object({
  name: z.string().min(1, "Name is required"),
  designation: z.string().min(1, "Designation is required"),
});

// Input for updating staff
export const updateStaffSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).optional(),
  designation: z.string().min(1).optional(),
});

// Input for deleting staff
export const deleteStaffSchema = z.object({
  id: z.string().cuid(),
});

// Types
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type DeleteStaffInput = z.infer<typeof deleteStaffSchema>;
