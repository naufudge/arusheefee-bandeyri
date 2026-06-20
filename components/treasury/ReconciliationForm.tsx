"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  ReconciliationSchema,
  ReconciliationValues,
} from "@/schemas/ReconciliationSchema";
import {
  ReconInputField,
  ReconStaffDropDownField,
} from "@/components/treasury/ReconciliationInputField";
import EditPcDetailDialog from "@/components/treasury/EditPcDetailDialog";
import {
  weekBoundsForDate,
  suggestReportNum,
  dhivehiPeriodText,
} from "@/lib/week";
import { formatNumberWithCommas } from "@/utils/helpers";
import { Staff } from "@/types";
import { useTRPC } from "@/lib/trpc";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface ReconciliationFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recon?: any;
}

const dhivehiStyle: React.CSSProperties = {
  fontFamily: "var(--font-faruma), sans-serif",
  direction: "rtl",
  textAlign: "right",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDefaults(recon?: any): ReconciliationValues {
  if (recon) {
    return {
      reportNum: recon.reportNum,
      weekStart: new Date(recon.weekStart),
      weekEnd: new Date(recon.weekEnd),
      periodText: recon.periodText,
      openingBalance: recon.openingBalance,
      cashInHand: recon.cashInHand,
      redepositAcc1155: recon.redepositAcc1155,
      staffWages: recon.staffWages,
      foodAllowance: recon.foodAllowance,
      heldInCheque: recon.heldInCheque,
      totalPayable: recon.totalPayable,
      total: recon.total,
      cashHeld: recon.cashHeld,
      chequeHeld: recon.chequeHeld,
      preparedBy: {
        name: recon.preparedBy?.name || "",
        designation: recon.preparedBy?.designation || "",
      },
      checkedBy: {
        name: recon.checkedBy?.name || "",
        designation: recon.checkedBy?.designation || "",
      },
      authorizedBy: {
        name: recon.authorizedBy?.name || "",
        designation: recon.authorizedBy?.designation || "",
      },
    };
  }
  const { weekStart, weekEnd } = weekBoundsForDate(new Date());
  return {
    reportNum: suggestReportNum(weekStart),
    weekStart,
    weekEnd,
    periodText: dhivehiPeriodText(weekStart, weekEnd),
    openingBalance: 0,
    cashInHand: 0,
    redepositAcc1155: 0,
    staffWages: 0,
    foodAllowance: 0,
    heldInCheque: 0,
    totalPayable: 0,
    total: 0,
    cashHeld: 0,
    chequeHeld: 0,
    preparedBy: { name: "", designation: "" },
    checkedBy: { name: "", designation: "" },
    authorizedBy: { name: "", designation: "" },
  };
}

const BREAKDOWN_FIELDS: { name: keyof ReconciliationValues; label: string }[] = [
  { name: "openingBalance", label: "Opening balance (previous week)" },
  { name: "cashInHand", label: "Cash in hand" },
  { name: "redepositAcc1155", label: "Re-deposit from A/C 1155" },
  { name: "staffWages", label: "Staff wages" },
  { name: "foodAllowance", label: "Food & allowance" },
  { name: "heldInCheque", label: "Held in cheque" },
  { name: "totalPayable", label: "Total payable to bill" },
  { name: "total", label: "Total" },
  { name: "chequeHeld", label: "Held in cheques" },
];

const ReconciliationForm: React.FC<ReconciliationFormProps> = ({ recon }) => {
  const { toast } = useToast();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(recon);

  const { data: staffData } = useQuery(trpc.staff.list.queryOptions());
  const staff: Staff[] | undefined = staffData?.map((s) => ({
    _id: s.id,
    name: s.name,
    designation: s.designation,
  }));

  const form = useForm<ReconciliationValues>({
    resolver: zodResolver(ReconciliationSchema),
    defaultValues: buildDefaults(recon),
  });
  const control = form.control;
  const setValue = form.setValue;

  const weekStart = form.watch("weekStart");
  const weekEnd = form.watch("weekEnd");

  // Live preview of the items that will be snapshotted (create), or the stored
  // snapshot (edit).
  const { data: weekPettyCash } = useQuery({
    ...trpc.pettycash.byWeek.queryOptions({ weekStart, weekEnd }),
    enabled: !isEdit && !!weekStart && !!weekEnd,
  });

  const previewRows: {
    date: string;
    details: string;
    withdrawn: string;
    pettyCashNum: string | null;
  }[] = isEdit
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (recon?.items ?? []).map((it: any) => ({
        date: format(new Date(it.date), "dd.MM.yyyy"),
        details: it.details || it.detailsEn || "",
        withdrawn: formatNumberWithCommas(it.withdrawn),
        pettyCashNum: it.sourcePettyCashNum ?? null,
      }))
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (weekPettyCash ?? []).map((pc: any) => ({
        date: format(new Date(pc.date), "dd.MM.yyyy"),
        details: pc.items
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((it: any) => it.nameDhivehi || it.name || "")
          .filter(Boolean)
          .join("، "),
        withdrawn: formatNumberWithCommas(pc.totalRequiredAmount),
        pettyCashNum: pc.pettyCashNum as string,
      }));

  // Auto-calculated like the PDF: cash held = opening balance − the week's
  // withdrawals (deposits aren't tracked yet); grand total = cash + cheque.
  const totalWithdrawn: number = isEdit
    ? (recon?.items ?? []).reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (s: number, it: any) => s + (it.withdrawn || 0),
        0,
      )
    : (weekPettyCash ?? []).reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (s: number, pc: any) => s + (pc.totalRequiredAmount || 0),
        0,
      );
  const closingBalance =
    (Number(form.watch("openingBalance")) || 0) - totalWithdrawn;

  // Keep the stored cashHeld in sync with the computed closing balance.
  useEffect(() => {
    setValue("cashHeld", closingBalance);
  }, [closingBalance, setValue]);

  const findStaffId = (name: string | undefined): string | null => {
    if (!name || !staffData) return null;
    return staffData.find((s) => s.name === name)?.id ?? null;
  };

  // Apply a picked day → its Sunday–Thursday week. Suggests reportNum/period.
  const applyWeek = (d: Date | undefined) => {
    if (!d) return;
    const { weekStart: ws, weekEnd: we } = weekBoundsForDate(
      new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())),
    );
    setValue("weekStart", ws, { shouldDirty: true });
    setValue("weekEnd", we, { shouldDirty: true });
    setValue("periodText", dhivehiPeriodText(ws, we), { shouldDirty: true });
    setValue("reportNum", suggestReportNum(ws), { shouldDirty: true });
  };

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: trpc.pcRecon.list.queryKey() });

  // After editing a record's Dhivehi detail, refresh whichever query feeds the
  // items preview: the stored snapshot (edit) or the live petty cash (create).
  const onItemDetailSaved = () => {
    if (isEdit) {
      queryClient.invalidateQueries({
        queryKey: trpc.pcRecon.getByNum.queryKey({ reportNum: recon.reportNum }),
      });
    } else {
      queryClient.invalidateQueries({
        queryKey: trpc.pettycash.byWeek.queryKey({ weekStart, weekEnd }),
      });
    }
  };

  const createMutation = useMutation(
    trpc.pcRecon.create.mutationOptions({
      onSuccess: (data) => {
        toast({ title: "Success", description: "Reconciliation report created." });
        invalidate();
        router.push(`/pc-reconciliation/${encodeURIComponent(data.reportNum)}`);
      },
      onError: (error) => {
        toast({
          title: "Could not create report",
          description: error.message || "An unknown error occurred.",
        });
        setSubmitting(false);
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.pcRecon.update.mutationOptions({
      onSuccess: (data) => {
        toast({ title: "Success", description: `Report ${data.reportNum} updated.` });
        invalidate();
        queryClient.invalidateQueries({
          queryKey: trpc.pcRecon.getByNum.queryKey({ reportNum: data.reportNum }),
        });
        router.push(`/pc-reconciliation/${encodeURIComponent(data.reportNum)}`);
      },
      onError: (error) => {
        toast({
          title: "Could not update report",
          description: error.message || "An unknown error occurred.",
        });
        setSubmitting(false);
      },
    }),
  );

  const onSubmit = (values: ReconciliationValues) => {
    setSubmitting(true);
    const payload = {
      reportNum: values.reportNum,
      weekStart: values.weekStart,
      weekEnd: values.weekEnd,
      periodText: values.periodText,
      openingBalance: values.openingBalance,
      cashInHand: values.cashInHand,
      redepositAcc1155: values.redepositAcc1155,
      staffWages: values.staffWages,
      foodAllowance: values.foodAllowance,
      heldInCheque: values.heldInCheque,
      totalPayable: values.totalPayable,
      total: values.total,
      cashHeld: values.cashHeld,
      chequeHeld: values.chequeHeld,
      preparedById: findStaffId(values.preparedBy?.name),
      checkedById: findStaffId(values.checkedBy?.name),
      authorizedById: findStaffId(values.authorizedBy?.name),
    };
    if (!recon) createMutation.mutate(payload);
    else updateMutation.mutate(payload);
  };

  const grandTotal =
    closingBalance + (Number(form.watch("chequeHeld")) || 0);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Report period */}
        <section className="rounded-md border bg-card p-6">
          <div className="mb-5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Report Period
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Week (pick any day)</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className={cn(
                      "w-full justify-between pl-3 text-left font-normal",
                    )}
                  >
                    {weekStart && weekEnd
                      ? `${format(weekStart, "dd MMM")} – ${format(weekEnd, "dd MMM yyyy")}`
                      : "Pick a week"}
                    <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={weekStart}
                    onSelect={applyWeek}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">
                Sunday → Thursday of the chosen week.
              </span>
            </div>
            <ReconInputField
              control={control}
              name="reportNum"
              label="Report Number"
              description="Auto-suggested; editable."
            />
          </div>
          <div className="mt-4">
            <ReconInputField
              control={control}
              name="periodText"
              label="Period (Dhivehi)"
              dhivehi
            />
          </div>
        </section>

        {/* Auto-sourced items preview */}
        <section>
          <div className="mb-4">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Items (auto-sourced from petty cash)
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {isEdit
                ? "The snapshot taken for this report."
                : "Petty cash records dated in this week. These are snapshotted when you send the report for approval."}
            </p>
          </div>
          <div className="overflow-hidden rounded-md border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                  <th className="px-4 py-2 text-right font-medium">Details</th>
                  <th className="px-4 py-2 text-right font-medium">Withdrawn</th>
                  <th className="w-12 px-2 py-2 text-right font-medium">
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {previewRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-xs text-muted-foreground"
                    >
                      No petty cash records found for this week.
                    </td>
                  </tr>
                ) : (
                  previewRows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 tabular-nums">{r.date}</td>
                      <td className="px-4 py-2 text-right" style={dhivehiStyle}>
                        {r.details || "—"}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums">
                        {r.withdrawn}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {r.pettyCashNum ? (
                          <EditPcDetailDialog
                            pettyCashNum={r.pettyCashNum}
                            reportNum={isEdit ? recon.reportNum : undefined}
                            onSaved={onItemDetailSaved}
                          />
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Cash composition */}
        <section className="rounded-md border bg-card p-6">
          <div className="mb-5">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Cash Composition
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Manual figures as at the end of the week.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {BREAKDOWN_FIELDS.map((f) => (
              <ReconInputField
                key={f.name}
                control={control}
                name={f.name}
                label={f.label}
                type="number"
                placeholder="0.00"
              />
            ))}
          </div>
          <div className="mt-4 space-y-2 border-t pt-4 text-sm">
            <div className="flex items-center justify-end gap-2">
              <span className="text-muted-foreground">
                Cash held (auto — closing balance):
              </span>
              <span className="font-mono font-semibold tabular-nums">
                {formatNumberWithCommas(closingBalance)}
              </span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <span className="text-muted-foreground">
                Grand total (cash + cheque):
              </span>
              <span className="font-mono font-semibold tabular-nums">
                {formatNumberWithCommas(grandTotal)}
              </span>
            </div>
          </div>
        </section>

        {/* Approvers */}
        <section>
          <div className="mb-4">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Approvers
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Prepared, checked, and authorized.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {(
              [
                { key: "preparedBy", label: "Prepared by" },
                { key: "checkedBy", label: "Checked by" },
                { key: "authorizedBy", label: "Authorized by" },
              ] as const
            ).map((role) => (
              <div
                key={role.key}
                className="flex flex-col gap-4 rounded-md border bg-card p-6"
              >
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {role.label}
                </div>
                <ReconStaffDropDownField
                  control={control}
                  name={role.key}
                  label="Name"
                  staffs={staff ?? []}
                  formSetValue={setValue}
                />
                <ReconInputField
                  control={control}
                  name={`${role.key}.designation`}
                  label="Designation"
                  disabled
                />
              </div>
            ))}
          </div>
        </section>

        <div className="flex items-center justify-end gap-3 border-t pt-6">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-6 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isEdit ? "Save changes" : "Create"}
          </button>
        </div>
      </form>
    </Form>
  );
};

export default ReconciliationForm;
