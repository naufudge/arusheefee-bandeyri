import { prisma } from "@/lib/prisma";

export async function createContext() {
  return {
    prisma,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
