import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function createContext() {
  const session = await auth();
  return {
    prisma,
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
