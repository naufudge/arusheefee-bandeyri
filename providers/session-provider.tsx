"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

interface AuthSessionProviderProps {
  children: React.ReactNode;
  session?: Session | null;
}

// Thin wrapper so server components can render <AuthSessionProvider>
// without pulling next-auth/react into a server bundle.
export default function AuthSessionProvider({
  children,
  session,
}: AuthSessionProviderProps) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
