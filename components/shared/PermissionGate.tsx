"use client";

import React from "react";
import { Lock, Hourglass } from "lucide-react";
import { signOut } from "next-auth/react";
import {
  useHasPermission,
  useHasNoPermissions,
} from "@/hooks/use-permissions";
import type { Permission } from "@/lib/permissions";

interface PermissionGateProps {
  permission: Permission;
  children: React.ReactNode;
  /**
   * Optional override for the denied-state UI. When omitted, the standard
   * NoAccessCard is rendered.
   */
  fallback?: React.ReactNode;
}

/**
 * Client-side permission gate. Renders `children` if the signed-in user
 * has the named permission, otherwise renders a friendly NoAccessCard
 * (or a custom `fallback`).
 *
 * This is cosmetic — server-side `requirePermission` / `permissionProcedure`
 * remain authoritative. Use both layers.
 */
const PermissionGate: React.FC<PermissionGateProps> = ({
  permission,
  children,
  fallback,
}) => {
  const allowed = useHasPermission(permission);
  if (allowed) return <>{children}</>;
  if (fallback) return <>{fallback}</>;
  return <NoAccessCard />;
};

export default PermissionGate;

/**
 * Friendly empty-state card shown when the signed-in user lacks access.
 * Branches on whether they have *no* permissions at all (likely a freshly
 * provisioned account that hasn't been assigned a role yet) versus
 * "missing this specific permission" (they have other access).
 */
export function NoAccessCard() {
  const noPermissions = useHasNoPermissions();
  return (
    <div className="font-poppins flex h-full flex-col items-center justify-center pb-20 pt-32 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        {noPermissions ? (
          <Hourglass className="size-5 text-muted-foreground" />
        ) : (
          <Lock className="size-5 text-muted-foreground" />
        )}
      </div>

      {noPermissions ? (
        <>
          <h2 className="mt-5 text-base font-semibold">
            Access pending
          </h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            You&apos;re signed in, but no roles have been assigned to your
            account yet. Ask an administrator to grant you access.
          </p>
        </>
      ) : (
        <>
          <h2 className="mt-5 text-base font-semibold">
            You don&apos;t have access to this section
          </h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Your role doesn&apos;t include the permission needed for this
            page. Use the sidebar to navigate to a section you can access,
            or contact an administrator.
          </p>
        </>
      )}

      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="mt-6 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        Sign out
      </button>
    </div>
  );
}
