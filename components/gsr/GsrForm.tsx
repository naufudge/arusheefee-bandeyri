"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Form } from "@/components/ui/form";
import { GsrSchema } from "@/schemas/GsrSchema";
import { GsrInputField, GsrStaffDropDownField } from "@/components/gsr/GsrInputField";
import { RtlDhivehiInput } from "@/components/gsr/RtlDhivehiInput";
import GsrItemsForm from "@/components/gsr/GsrItemsForm";
import { Staff } from "@/types";
import { useTRPC } from "@/lib/trpc";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface GsrFormProps {
  // Accept either the form schema type or the tRPC response type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gsr?: any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useGsrForm(gsr?: any) {
  let formConfig = {};
  if (gsr) {
    const items = (gsr.items || []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (it: any) => ({
        particulars: it.particulars,
        requestedQty: it.requestedQty,
        issuedQty: it.issuedQty ?? null,
        rqdDate: it.rqdDate ? new Date(it.rqdDate) : null,
        remarks: it.remarks ?? "",
      }),
    );

    const vals = {
      gsrFormNum: gsr.gsrFormNum,
      section: gsr.section,
      date: new Date(gsr.date),
      items: items.length
        ? items
        : [
            {
              particulars: "",
              requestedQty: 0,
              issuedQty: null,
              rqdDate: null,
              remarks: "",
            },
          ],
      requestedBy: {
        name: gsr.requestedBy?.name || "",
        designation: gsr.requestedBy?.designation || "",
      },
      authorizedBy: {
        name: gsr.authorizedBy?.name || "",
        designation: gsr.authorizedBy?.designation || "",
      },
      receivedBy: {
        name: gsr.receivedBy?.name || "",
        designation: gsr.receivedBy?.designation || "",
      },
    };

    formConfig = {
      resolver: zodResolver(GsrSchema),
      defaultValues: vals,
      values: vals,
    };
  } else {
    formConfig = {
      resolver: zodResolver(GsrSchema),
      defaultValues: {
        gsrFormNum: "",
        section: "",
        date: new Date(),
        items: [
          {
            particulars: "",
            requestedQty: 0,
            issuedQty: null,
            rqdDate: null,
            remarks: "",
          },
        ],
        requestedBy: { name: "", designation: "" },
        authorizedBy: { name: "", designation: "" },
        receivedBy: { name: "", designation: "" },
      },
    };
  }
  return useForm<z.infer<typeof GsrSchema>>(formConfig);
}

const GsrForm: React.FC<GsrFormProps> = ({ gsr }) => {
  const { toast } = useToast();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const { data: staffData } = useQuery(trpc.staff.list.queryOptions());
  const staff: Staff[] | undefined = staffData?.map((s) => ({
    _id: s.id,
    name: s.name,
    designation: s.designation,
  }));

  const form = useGsrForm(gsr);
  const control = form.control;
  const setValue = form.setValue;

  // Map a selected staff name back to its id for the API.
  const findStaffId = (staffName: string | undefined): string | null => {
    if (!staffName || !staffData) return null;
    return staffData.find((s) => s.name === staffName)?.id ?? null;
  };

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: trpc.gsr.list.queryKey() });

  const createMutation = useMutation(
    trpc.gsr.create.mutationOptions({
      onSuccess: (data) => {
        toast({ title: "Success", description: "GSR form created." });
        invalidate();
        router.push(`/gsr/${encodeURIComponent(data.gsrFormNum)}`);
      },
      onError: (error) => {
        toast({
          title: "Could not create GSR form",
          description: error.message || "An unknown error occurred.",
        });
        setSubmitting(false);
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.gsr.update.mutationOptions({
      onSuccess: (data) => {
        toast({
          title: "Success",
          description: `GSR form ${data.gsrFormNum} updated.`,
        });
        invalidate();
        queryClient.invalidateQueries({
          queryKey: trpc.gsr.getByNum.queryKey({
            gsrFormNum: data.gsrFormNum,
          }),
        });
        router.push(`/gsr/${encodeURIComponent(data.gsrFormNum)}`);
      },
      onError: (error) => {
        toast({
          title: "Could not update GSR form",
          description: error.message || "An unknown error occurred.",
        });
        setSubmitting(false);
      },
    }),
  );

  const onSubmit = (values: z.infer<typeof GsrSchema>) => {
    setSubmitting(true);

    const payload = {
      gsrFormNum: values.gsrFormNum,
      section: values.section,
      date: values.date,
      requestedById: findStaffId(values.requestedBy?.name),
      authorizedById: findStaffId(values.authorizedBy?.name),
      receivedById: findStaffId(values.receivedBy?.name),
      items: values.items.map((item) => ({
        particulars: item.particulars,
        requestedQty: item.requestedQty,
        issuedQty: item.issuedQty ?? null,
        rqdDate: item.rqdDate ?? null,
        remarks: item.remarks || null,
      })),
    };

    if (!gsr) {
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate(payload);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Form details */}
        <section className="rounded-md border bg-card p-6">
          <div className="mb-5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Form Details
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GsrInputField
              control={control}
              name={"gsrFormNum"}
              label="Form Number"
              placeholder="e.g. (FRM)433-CA/433/2026/101"
              description="Entered manually; must be unique."
              disabled={!!gsr}
            />
            <GsrInputField control={control} name={"date"} label="Date" />
          </div>

          <div className="mt-4">
            <RtlDhivehiInput
              control={control}
              name={"section"}
              label="Section (Dhivehi)"
              placeholder="އެޑްމިން، ފައިނޭންސް އެންޑް އައި.ޓީ."
            />
          </div>
        </section>

        {/* Line items */}
        <section>
          <div className="mb-4">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Requisition Items
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Goods or services being requested
            </p>
          </div>
          <GsrItemsForm control={control} />
        </section>

        {/* Approvers */}
        <section>
          <div className="mb-4">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Approvers
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Staff who requested, authorize, and receive this form. Form
              Received By is optional.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="rounded-md border bg-card p-6">
              <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Requested By
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <GsrStaffDropDownField
                  control={control}
                  name="requestedBy"
                  label="Name"
                  staffs={staff ?? []}
                  formSetValue={setValue}
                />
                <GsrInputField
                  control={control}
                  name={"requestedBy.designation"}
                  label="Designation"
                  disabled
                />
              </div>
            </div>

            <div className="rounded-md border bg-card p-6">
              <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Authorized By
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <GsrStaffDropDownField
                  control={control}
                  name="authorizedBy"
                  label="Name"
                  staffs={staff ?? []}
                  formSetValue={setValue}
                />
                <GsrInputField
                  control={control}
                  name={"authorizedBy.designation"}
                  label="Designation"
                  disabled
                />
              </div>
            </div>

            <div className="rounded-md border bg-card p-6">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Form Received By{" "}
                  <span className="ml-1 normal-case tracking-normal text-muted-foreground/70">
                    (optional)
                  </span>
                </div>
                {form.watch("receivedBy.name") && (
                  <button
                    type="button"
                    onClick={() => {
                      setValue("receivedBy.name", "", { shouldDirty: true });
                      setValue("receivedBy.designation", "", {
                        shouldDirty: true,
                      });
                    }}
                    className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground transition hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <GsrStaffDropDownField
                  control={control}
                  name="receivedBy"
                  label="Name"
                  staffs={staff ?? []}
                  formSetValue={setValue}
                />
                <GsrInputField
                  control={control}
                  name={"receivedBy.designation"}
                  label="Designation"
                  disabled
                />
              </div>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3 border-t pt-6">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-6 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {gsr ? "Save changes" : "Create"}
          </button>
        </div>
      </form>
    </Form>
  );
};

export default GsrForm;
