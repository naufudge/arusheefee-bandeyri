"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Search as SearchIcon,
  SquarePen,
  Trash2,
  Users,
  IdCard,
  UserPlus,
  Plus,
  KeyRound,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AddStaff from "@/components/Settings/Staff/AddStaff";
import SyncFromTenant from "@/components/Settings/Staff/SyncFromTenant";
import { KpiCard, KpiSkeleton } from "@/components/Dashboard/KpiCard";
import { useToast } from "@/hooks/use-toast";
import { useTRPC } from "@/lib/trpc";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const StaffPage = () => {
  const { toast } = useToast();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQuery(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: staffs, isLoading } = useQuery(trpc.staff.list.queryOptions());

  const deleteMutation = useMutation(
    trpc.staff.delete.mutationOptions({
      onSuccess: () => {
        toast({
          title: "Success",
          description: "Successfully deleted the staff.",
        });
        queryClient.invalidateQueries({ queryKey: trpc.staff.list.queryKey() });
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message || "An unknown error occurred.",
        });
      },
    })
  );

  const refetchStaffs = () => {
    queryClient.invalidateQueries({ queryKey: trpc.staff.list.queryKey() });
  };

  const handleDeleteClick = (staffId: string) => {
    deleteMutation.mutate({ id: staffId });
  };

  const filteredStaffs = useMemo(() => {
    if (!staffs) return [];
    if (!query) return staffs;
    const q = query.trim().toLowerCase();
    return staffs.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.designation.toLowerCase().includes(q)
    );
  }, [staffs, query]);

  const stats = useMemo(() => {
    if (!staffs) return null;
    const designations = new Set(
      staffs.map((s) => s.designation).filter((d) => d && d.trim() !== "")
    );
    const loggedIn = staffs.filter((s) => s.lastLoginAt != null).length;
    return {
      total: staffs.length,
      designations: designations.size,
      loggedIn,
    };
  }, [staffs]);

  const filtersActive = Boolean(query);

  return (
    <div className="font-poppins h-full">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Settings &middot; Staff
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Manage Staff
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add or edit staff that can be selected as signatories on payment vouchers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <SyncFromTenant onSynced={refetchStaffs} />
          <AddStaff
            refetchStaffs={refetchStaffs}
            button={
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted"
              >
                <UserPlus className="size-4" />
                Add staff
              </button>
            }
          />
        </div>
      </header>

      {/* KPI strip */}
      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading || !stats ? (
          Array.from({ length: 3 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              label="Total Staff"
              icon={Users}
              value={stats.total.toString()}
              sub={
                stats.total === 0
                  ? "no staff yet"
                  : `${stats.total === 1 ? "employee" : "employees"} on file`
              }
            />
            <KpiCard
              label="Designations"
              icon={IdCard}
              value={stats.designations.toString()}
              sub={
                stats.designations === 1 ? "unique role" : "unique roles"
              }
            />
            <KpiCard
              label="Logged In"
              icon={KeyRound}
              value={stats.loggedIn.toString()}
              sub={
                stats.total === 0
                  ? "—"
                  : `${stats.loggedIn} of ${stats.total} via Microsoft SSO`
              }
            />
          </>
        )}
      </section>

      {/* Toolbar */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or designation..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>
        {filtersActive && (
          <button
            type="button"
            onClick={() => setSearchInput("")}
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      {/* Result count */}
      {!isLoading && (
        <div className="mt-4 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Showing{" "}
          <span className="font-mono tabular-nums text-foreground">
            {filteredStaffs.length}
          </span>{" "}
          of{" "}
          <span className="font-mono tabular-nums">{staffs?.length ?? 0}</span>
        </div>
      )}

      {/* Staff table */}
      <div className="mt-4 rounded-md border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : filteredStaffs.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Users className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">
              {filtersActive
                ? "No staff match your search"
                : "No staff added yet"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtersActive
                ? "Try a different name or designation."
                : "Add your first staff member to enable signatory selection on PVs."}
            </p>
            {filtersActive ? (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
              >
                Clear search
              </button>
            ) : (
              <AddStaff
                refetchStaffs={refetchStaffs}
                button={
                  <button
                    type="button"
                    className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
                  >
                    <Plus className="size-4" />
                    Add staff
                  </button>
                }
              />
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 w-[60px] pl-6 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  #
                </TableHead>
                <TableHead className="h-9 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Name
                </TableHead>
                <TableHead className="h-9 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Designation
                </TableHead>
                <TableHead className="h-9 pr-6 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStaffs.map((staff, index) => (
                <TableRow
                  key={staff.id}
                  className="transition hover:bg-muted/40"
                >
                  <TableCell className="pl-6 font-mono text-xs tabular-nums text-muted-foreground">
                    {(index + 1).toString().padStart(2, "0")}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <span>{staff.name}</span>
                      {staff.isActive === false && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Inactive
                        </span>
                      )}
                    </div>
                    {staff.email && (
                      <div className="mt-0.5 truncate text-[11px] font-normal text-muted-foreground">
                        {staff.email}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {staff.designation && staff.designation.trim() !== ""
                      ? staff.designation
                      : (staff.jobTitle ?? "")}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <div className="flex items-center justify-end gap-3 text-muted-foreground">
                      <AddStaff
                        refetchStaffs={refetchStaffs}
                        staff={{
                          _id: staff.id,
                          name: staff.name,
                          designation: staff.designation,
                        }}
                        button={
                          <button
                            type="button"
                            aria-label="Edit"
                            className="transition hover:text-blue-600"
                          >
                            <SquarePen className="size-4" />
                          </button>
                        }
                      />

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            type="button"
                            aria-label="Delete"
                            className="transition hover:text-red-600"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-card">
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Are you absolutely sure?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will
                              permanently delete{" "}
                              <span className="font-medium text-foreground">
                                {staff.name}
                              </span>{" "}
                              from the staff register.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="gap-2">
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteClick(staff.id)}
                              className="bg-red-700 hover:bg-red-800"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default StaffPage;
