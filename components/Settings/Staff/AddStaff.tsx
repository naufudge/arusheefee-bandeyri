"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Staff } from "@/types";
import { useTRPC } from "@/lib/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import RoleMultiSelect from "@/components/Settings/Staff/RoleMultiSelect";
import Link from "next/link";

interface AddStaffProps {
  button: React.ReactNode;
  refetchStaffs: () => void;
  staff?: Staff;
}

const staffFormSchema = z.object({
  name: z.string().min(8, "Please write the full name of the staff."),
  designation: z.string().min(3, "Please write a valid designation."),
});

const AddStaff: React.FC<AddStaffProps> = ({
  button,
  refetchStaffs,
  staff,
}) => {
  const { toast } = useToast();
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(
    new Set(),
  );

  // Only show role-assignment UI if the current user can manage roles.
  // Otherwise the section is hidden and existing assignments are
  // preserved untouched (we don't send roleIds in the mutation).
  const canManageRoles = useHasPermission(PERMISSIONS.ROLES_MANAGE);

  // Fetch the role list only when the dialog is open *and* the user can
  // manage roles, so we don't burn a Graph DB read on every dialog mount.
  const { data: roles } = useQuery({
    ...trpc.role.list.queryOptions(),
    enabled: open && canManageRoles,
  });

  const form = useForm<z.infer<typeof staffFormSchema>>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: {
      name: staff?.name ?? "",
      designation: staff?.designation ?? "",
    },
  });

  // Reset form + role selection to current staff values only on the
  // open->true transition. The parent passes `staff` as an inline object
  // literal, so its reference changes on every parent render — depending
  // on `staff` here would re-fire mid-edit and wipe in-flight changes
  // (notably role toggles). `open` is the only dep we actually want.
  useEffect(() => {
    if (open) {
      form.reset({
        name: staff?.name ?? "",
        designation: staff?.designation ?? "",
      });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedRoleIds(new Set(staff?.roleIds ?? []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const createMutation = useMutation(
    trpc.staff.create.mutationOptions({
      onSuccess: () => {
        toast({
          title: "Success",
          description: "Successfully added new staff.",
        });
        refetchStaffs();
        setOpen(false);
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message || "An unknown error occurred.",
        });
      },
    })
  );

  const updateMutation = useMutation(
    trpc.staff.update.mutationOptions({
      onSuccess: () => {
        toast({
          title: "Updated",
          description: "Successfully updated staff details.",
        });
        refetchStaffs();
        setOpen(false);
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message || "An unknown error occurred.",
        });
      },
    })
  );

  const onSubmit = (values: z.infer<typeof staffFormSchema>) => {
    const roleIds = canManageRoles ? Array.from(selectedRoleIds) : undefined;
    if (staff) {
      updateMutation.mutate({
        id: staff._id,
        name: values.name,
        designation: values.designation,
        roleIds,
      });
    } else {
      createMutation.mutate({
        ...values,
        roleIds,
      });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isEdit = Boolean(staff);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{button}</DialogTrigger>
      <DialogContent className="max-w-md gap-0 p-0 sm:rounded-md">
        {/* Header */}
        <div className="border-b px-6 py-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {isEdit ? "Edit" : "New"}
          </div>
          <DialogTitle className="mt-1 text-xl font-semibold tracking-tight">
            {isEdit ? "Edit staff details" : "Add a staff member"}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            {isEdit
              ? "Update name, designation, or assigned roles."
              : "They'll be selectable as a signatory on payment vouchers."}
          </DialogDescription>
        </div>

        {/* Body */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-5 px-6 py-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Full Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Sharumeela Abdul Fatah"
                        className="h-9 text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="designation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Designation
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Accounts Officer"
                        className="h-9 text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              {canManageRoles && (
                <div className="grid gap-1.5">
                  <label className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    <span>
                      Roles{" "}
                      <span className="ml-1 font-mono normal-case tracking-normal">
                        ({selectedRoleIds.size})
                      </span>
                    </span>
                  </label>
                  <RoleMultiSelect
                    roles={roles}
                    selected={selectedRoleIds}
                    onChange={setSelectedRoleIds}
                    placeholder="Select roles…"
                    emptyMessage={
                      <>
                        No roles defined yet.{" "}
                        <Link
                          href="/settings/roles"
                          className="font-medium text-foreground transition hover:underline"
                        >
                          Create one
                        </Link>
                        .
                      </>
                    }
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting
                  ? isEdit
                    ? "Saving..."
                    : "Adding..."
                  : isEdit
                    ? "Save changes"
                    : "Add staff"}
              </button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AddStaff;
