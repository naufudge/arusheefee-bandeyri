"use client";

import React, { useMemo } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  Plus,
  SquarePen,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard, KpiSkeleton } from "@/components/Dashboard/KpiCard";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import RoleDialog from "@/components/Settings/Roles/RoleDialog";
import DeleteRoleButton from "@/components/Settings/Roles/DeleteRoleButton";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const RolesPage = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const hasAccess = useHasPermission(PERMISSIONS.ROLES_MANAGE);

  const { data: roles, isLoading } = useQuery({
    ...trpc.role.list.queryOptions(),
    enabled: hasAccess,
  });

  const refetchRoles = () => {
    queryClient.invalidateQueries({ queryKey: trpc.role.list.queryKey() });
  };

  const stats = useMemo(() => {
    if (!roles) return null;
    const system = roles.filter((r) => r.isSystem).length;
    return {
      total: roles.length,
      system,
      custom: roles.length - system,
    };
  }, [roles]);

  if (!hasAccess) return <NoAccessCard />;

  return (
    <div className="font-poppins h-full">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Settings &middot; Roles
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Manage Roles
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bundle permissions into roles, then assign them to staff to
            control what each person can do.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <RoleDialog
            onSaved={refetchRoles}
            trigger={
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted"
              >
                <Plus className="size-4" />
                Create role
              </button>
            }
          />
        </div>
      </header>

      {/* KPI strip */}
      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {isLoading || !stats ? (
          Array.from({ length: 3 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              label="Total Roles"
              icon={ShieldCheck}
              value={stats.total.toString()}
              sub={
                stats.total === 0
                  ? "no roles yet"
                  : `${stats.total === 1 ? "role" : "roles"} defined`
              }
            />
            <KpiCard
              label="System Roles"
              icon={ShieldAlert}
              value={stats.system.toString()}
              sub="cannot be deleted"
            />
            <KpiCard
              label="Custom Roles"
              icon={Users}
              value={stats.custom.toString()}
              sub={
                stats.custom === 1 ? "user-created" : "user-created"
              }
            />
          </>
        )}
      </section>

      {/* Roles table */}
      <div className="mt-6 rounded-md border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : !roles || roles.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <ShieldCheck className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">No roles defined</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first role to start managing access.
            </p>
            <RoleDialog
              onSaved={refetchRoles}
              trigger={
                <button
                  type="button"
                  className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
                >
                  <Plus className="size-4" />
                  Create role
                </button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[480px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 pl-6 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Name
                  </TableHead>
                  <TableHead className="hidden h-9 text-[10px] font-medium uppercase tracking-wider text-muted-foreground md:table-cell">
                    Description
                  </TableHead>
                  <TableHead className="h-9 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Permissions
                  </TableHead>
                  <TableHead className="hidden h-9 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground md:table-cell">
                    Staff
                  </TableHead>
                  <TableHead className="h-9 pr-6 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow
                    key={role.id}
                    className="transition hover:bg-muted/40"
                  >
                    <TableCell className="pl-6 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <span>{role.name}</span>
                        {role.isSystem && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            System
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      <div className="line-clamp-1 max-w-[420px]">
                        {role.description ?? (
                          <span className="italic">No description</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {role.permissions.length}
                    </TableCell>
                    <TableCell className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground md:table-cell">
                      {role._count.staff}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <div className="flex items-center justify-end gap-3 text-muted-foreground">
                        <RoleDialog
                          role={role}
                          onSaved={refetchRoles}
                          trigger={
                            <button
                              type="button"
                              aria-label="Edit"
                              className="transition hover:text-blue-600"
                            >
                              <SquarePen className="size-4" />
                            </button>
                          }
                        />
                        <DeleteRoleButton
                          role={role}
                          onDeleted={refetchRoles}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RolesPage;
