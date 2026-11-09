import { z } from "zod";
import {
  SEARCH_MAX_LENGTH,
  SEARCH_MIN_LENGTH,
  SEARCH_MODULES,
} from "@/lib/search";

export const globalSearchSchema = z.object({
  q: z.string().trim().min(SEARCH_MIN_LENGTH).max(SEARCH_MAX_LENGTH),
  module: z.enum(SEARCH_MODULES).optional(),
});

export type GlobalSearchInput = z.infer<typeof globalSearchSchema>;
