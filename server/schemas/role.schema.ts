import { z } from "zod";
import { ALL_PERMISSIONS } from "@/lib/permissions";

const permissionEnum = z.enum(
  ALL_PERMISSIONS as unknown as [string, ...string[]],
);

export const createRoleSchema = z.object({
  name: z.string().min(1, "Name is required").max(60),
  description: z.string().max(280).optional().nullable(),
  permissions: z.array(permissionEnum).default([]),
});

export const updateRoleSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(60).optional(),
  description: z.string().max(280).optional().nullable(),
  permissions: z.array(permissionEnum).optional(),
});

export const deleteRoleSchema = z.object({
  id: z.string().cuid(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type DeleteRoleInput = z.infer<typeof deleteRoleSchema>;
