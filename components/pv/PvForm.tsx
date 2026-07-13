"use client";

import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { PvSchema } from "@/schemas/PvSchema";
import GLForm from "@/components/pv/GLForm";
import {
  PVDropDownField,
  PvInputField,
  StaffDropDownField,
} from "@/components/pv/PvInputField";
import { ExchangeRates, Staff } from "@/types";
import { Currencies } from "@/lib/constants/currencies";
import { useTRPC } from "@/lib/trpc";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AttachmentSection } from "@/components/attachments/AttachmentSection";
import {
  AttachmentQueue,
  type AttachmentQueueHandle,
} from "@/components/attachments/AttachmentQueue";
import { TemplatePicker } from "@/components/pv/TemplatePicker";
import { SaveTemplateDialog } from "@/components/pv/SaveTemplateDialog";
import type { TemplateValues } from "@/server/schemas/template.schema";
import { Save } from "lucide-react";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";

interface PvFormProps {
  // Accept either the form schema type or the tRPC response type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pv?: any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function usePvForm(pv?: any) {
  let formConfig = {};
  if (pv) {
    // Transform tRPC response format to form format
    // tRPC returns: invoices, clearingDocNum/Date, preparedBy as Staff relation
    // Form expects: invoiceDetails, clearingDoc.num/date, preparedBy as {name, designation}
    const invoiceDetails = (pv.invoices || pv.invoiceDetails || []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (inv: any) => ({
        comments: inv.comments,
        documentNumber: inv.documentNum || "",
        invoiceNumber: inv.invoiceNumber || "",
        invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate) : null,
        invoiceTotal: inv.invoiceTotal,
        glDetails: inv.glDetails.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (gl: any) => ({
            code: gl.code,
            fund: gl.fund,
            amount: gl.amount,
          })
        ),
      })
    );

    const vals = {
      pvNum: pv.pvNum,
      businessArea: pv.businessArea,
      agency: pv.agency,
      vendor: pv.vendor,
      date: new Date(pv.date),
      notes: pv.notes,
      currency: pv.currency,
      exchangeRate: pv.exchangeRate,

      invoiceDetails,

      preparedBy: {
        name: pv.preparedBy?.name || "",
        designation: pv.preparedBy?.designation || "",
      },
      verifiedBy: {
        name: pv.verifiedBy?.name || "",
        designation: pv.verifiedBy?.designation || "",
      },
      authorisedByOne: {
        name: pv.authorisedByOne?.name || "",
        designation: pv.authorisedByOne?.designation || "",
      },
      authorisedByTwo: {
        name: pv.authorisedByTwo?.name || "",
        designation: pv.authorisedByTwo?.designation || "",
      },

      poNum: pv.poNum || "",
      paymentMethod: pv.paymentMethod,
      parkedDate: pv.parkedDate ? new Date(pv.parkedDate) : null,
      postingDate: pv.postingDate ? new Date(pv.postingDate) : null,
      clearingDoc: {
        num:
          pv.clearingDocNum?.toString() ||
          pv.clearingDoc?.num?.toString() ||
          "",
        date: pv.clearingDocDate
          ? new Date(pv.clearingDocDate)
          : pv.clearingDoc?.date
            ? new Date(pv.clearingDoc.date)
            : null,
      },
      transferNum: pv.transferNum || "",
      isPettyCashReimbursement: pv.isPettyCashReimbursement ?? false,
    };

    formConfig = {
      resolver: zodResolver(PvSchema),
      defaultValues: vals,
      values: vals,
    };
  } else {
    formConfig = {
      resolver: zodResolver(PvSchema),
      defaultValues: {
        pvNum: "",
        businessArea: 1506,
        agency: "National Archives of Maldives",
        vendor: "",
        date: new Date(),
        notes: "",
        currency: "MVR",
        exchangeRate: 1,
        // numOfInvoice: 1,

        invoiceDetails: [
          {
            comments: "",
            documentNumber: "",
            invoiceNumber: "",
            invoiceDate: new Date(),
            invoiceTotal: 0,
            glDetails: [
              {
                code: 0,
                fund: "C-GOM",
                amount: 0,
              },
            ],
          },
        ],

        preparedBy: {
          name: "Sharumeela Abdul Fatah",
          designation: "Accounts Officer",
        },
        verifiedBy: { name: "", designation: "" },
        authorisedByOne: { name: "", designation: "" },
        authorisedByTwo: { name: "", designation: "" },

        poNum: "",
        paymentMethod: "",
        parkedDate: null,
        postingDate: null,
        clearingDoc: { num: "", date: null },
        transferNum: "",
        isPettyCashReimbursement: false,
      },
    };
  }
  return useForm<z.infer<typeof PvSchema>>(formConfig)
}

const PvForm: React.FC<PvFormProps> = ({ pv }) => {
  // Attachment perms are independent of the PV's workflow status now.
  // Server enforces the same; this just keeps the UI in sync.
  const canUploadAttachments = useHasPermission(PERMISSIONS.ATTACHMENT_UPLOAD);
  const canDeleteAttachments = useHasPermission(PERMISSIONS.ATTACHMENT_DELETE);
  const [submitBtnState, setSubmitBtnState] = useState<boolean>(true);

  // Most-recently-applied template, so the Save dialog can offer to
  // overwrite it. Cleared on a fresh page mount (default); sticky once
  // set so the user can keep iterating on the same template.
  const [appliedTemplate, setAppliedTemplate] = useState<
    { id: string; name: string } | null
  >(null);

  const { toast } = useToast();
  const trpc = useTRPC();

  // Fetch exchange rates
  const { data: exchangeRates } = useQuery(
    trpc.exchangeRates.get.queryOptions()
  );

  // Fetch staff list
  const { data: staffData } = useQuery(trpc.staff.list.queryOptions());
  const staff: Staff[] | undefined = staffData?.map((s) => ({
    _id: s.id,
    name: s.name,
    designation: s.designation,
  }));

  // Latest PV — used in create mode to suggest the next pvNum
  // (`YYYY-NNN` incremented from the highest existing one for the
  // current year; resets to `YYYY-001` when the year rolls over or the
  // DB is empty). The query throws NOT_FOUND on an empty DB, hence
  // `retry: false` + handling the error case as "start from 001".
  const { data: latestPV, isLoading: isLatestLoading } = useQuery({
    ...trpc.pv.latest.queryOptions(),
    enabled: !pv,
    retry: false,
  });

  const form = usePvForm(pv);

  const control = form.control;
  const register = form.register;
  const setValue = form.setValue;
  const getValue = form.getValues;

  // Auto-fill pvNum in create mode once we know the latest PV. We only
  // overwrite an empty field, so a user who has already typed something
  // (or restored a draft) keeps their input.
  useEffect(() => {
    if (pv) return;
    if (isLatestLoading) return;
    if (getValue("pvNum")) return;

    const currentYear = new Date().getFullYear();
    let nextNum = 1;
    if (latestPV?.pvNum) {
      const match = latestPV.pvNum.match(/^(\d{4})-(\d+)$/);
      if (match) {
        const [, yearStr, numStr] = match;
        if (parseInt(yearStr, 10) === currentYear) {
          nextNum = parseInt(numStr, 10) + 1;
        }
      }
    }
    setValue(
      "pvNum",
      `${currentYear}-${nextNum.toString().padStart(3, "0")}`,
    );
  }, [pv, latestPV, isLatestLoading, getValue, setValue]);

  // Handles currency dropdown selection
  const handleCurrencyChange = (currency: string) => {
    setValue("currency", currency);
    if (currency === "MVR") {
      setValue("exchangeRate", 1);
    }
    if (exchangeRates) {
      setValue("exchangeRate", exchangeRates[currency as keyof ExchangeRates]);
    }
    return;
  };

  const { fields, append, remove } = useFieldArray({
    control,
    name: "invoiceDetails",
  });

  // Holds queued attachments while the PV doesn't exist yet (create
  // mode). On successful create we flush the queue against the new id.
  const attachmentQueueRef = useRef<AttachmentQueueHandle | null>(null);

  // Create PV mutation. The ref is read inside the post-success callback
  // (not during render); the lint rule's wary of refs in
  // `mutationOptions` because the options object is constructed during
  // render, but the callback itself only runs after the mutation
  // settles. Suppress here rather than route around it with state.
  const createMutation = useMutation(
    // eslint-disable-next-line react-hooks/refs
    trpc.pv.create.mutationOptions({
      onSuccess: async (data) => {
        // Flush any queued reference docs against the new PV id. We toast
        // success even if some uploads fail — the PV itself was created;
        // AttachmentQueue.flush will have toasted per-file failures.
        if (attachmentQueueRef.current && !attachmentQueueRef.current.isEmpty()) {
          await attachmentQueueRef.current.flush("pv", data.id);
        }
        toast({
          title: "Success",
          description: "Successfully created a new PV!",
        });
        setSubmitBtnState(true);
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message || "There was an error. Please try again later.",
        });
        setSubmitBtnState(true);
      },
    })
  );

  // Update PV mutation
  const updateMutation = useMutation(
    trpc.pv.update.mutationOptions({
      onSuccess: (data) => {
        toast({
          title: "Success",
          description: `Successfully updated PV ${data.pvNum}!`,
        });
        setSubmitBtnState(true);
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message || "There was an error. Please try again later.",
        });
        setSubmitBtnState(true);
      },
    })
  );

  // Helper function to find staff ID by name
  const findStaffId = (staffName: string | undefined): string | null => {
    if (!staffName || !staffData) return null;
    const found = staffData.find((s) => s.name === staffName);
    return found?.id ?? null;
  };

  // Resolve a signatory field to a staff ID for the API payload without
  // silently dropping a still-assigned signatory. `findStaffId` returns null
  // for BOTH "field cleared" and "name couldn't be resolved" (staff
  // renamed/deactivated, or `staffData` not loaded yet at submit) — writing
  // that null would blank the FK while the workflow-written signature date
  // survives, showing "UNASSIGNED" next to "Signed on". So: a present-but-
  // unresolved name keeps the original FK; only a genuinely cleared field
  // becomes null.
  const resolveSignatoryId = (
    field: { name?: string } | undefined,
    originalId: string | null | undefined,
  ): string | null => {
    const name = field?.name?.trim();
    if (!name) return null; // user cleared the field → intentional unassign
    return findStaffId(name) ?? originalId ?? null;
  };

  // Reverse of findStaffId — used by the template apply flow to turn a
  // saved staffId back into { name, designation } for the form fields.
  const findStaffById = (
    staffId: string | null | undefined,
  ): { name: string; designation: string } | null => {
    if (!staffId || !staffData) return null;
    const found = staffData.find((s) => s.id === staffId);
    return found
      ? { name: found.name, designation: found.designation }
      : null;
  };

  // Apply a template to the form. "Overwrite only fields the template
  // defines" rule: we iterate keys present in the template and call
  // setValue for each; anything the user has already typed but the
  // template doesn't define is preserved. `pvNum` is never touched
  // because it isn't part of `TemplateValues`. The `meta` arg (from
  // the picker) is remembered so the Save dialog can offer an
  // "update existing" save flow.
  const applyTemplate = (
    values: TemplateValues,
    meta?: { id: string; name: string },
  ) => {
    if (meta) setAppliedTemplate(meta);
    if (values.businessArea != null) setValue("businessArea", values.businessArea, { shouldDirty: true });
    if (values.agency != null) setValue("agency", values.agency, { shouldDirty: true });
    if (values.vendor != null) setValue("vendor", values.vendor, { shouldDirty: true });
    if (values.date != null) setValue("date", new Date(values.date), { shouldDirty: true });
    if (values.notes != null) setValue("notes", values.notes, { shouldDirty: true });
    if (values.currency != null) setValue("currency", values.currency, { shouldDirty: true });
    if (values.exchangeRate != null) setValue("exchangeRate", values.exchangeRate, { shouldDirty: true });
    if (values.poNum != null) setValue("poNum", values.poNum, { shouldDirty: true });
    if (values.paymentMethod != null) setValue("paymentMethod", values.paymentMethod, { shouldDirty: true });
    if (values.parkedDate != null) setValue("parkedDate", new Date(values.parkedDate), { shouldDirty: true });
    if (values.postingDate != null) setValue("postingDate", new Date(values.postingDate), { shouldDirty: true });
    if (values.transferNum != null) setValue("transferNum", values.transferNum, { shouldDirty: true });

    // Form nests clearingDoc; template stores it flat — translate.
    if (values.clearingDocNum != null) setValue("clearingDoc.num", values.clearingDocNum, { shouldDirty: true });
    if (values.clearingDocDate != null) setValue("clearingDoc.date", new Date(values.clearingDocDate), { shouldDirty: true });

    // Signatories: template stores IDs (stable); form uses name +
    // designation. Look each one up; skip + count if the staff has
    // since been deleted.
    let missing = 0;
    const applyRole = (
      id: string | null | undefined,
      key: "preparedBy" | "verifiedBy" | "authorisedByOne" | "authorisedByTwo",
    ) => {
      if (!id) return;
      const staff = findStaffById(id);
      if (!staff) {
        missing++;
        return;
      }
      setValue(key, staff, { shouldDirty: true });
    };
    applyRole(values.preparedById, "preparedBy");
    applyRole(values.verifiedById, "verifiedBy");
    applyRole(values.authorisedByOneId, "authorisedByOne");
    applyRole(values.authorisedByTwoId, "authorisedByTwo");
    if (missing > 0) {
      toast({
        title: `${missing} role${missing > 1 ? "s" : ""} skipped`,
        description: "Template references staff that no longer exist.",
      });
    }

    // Invoices: wholesale replace if the template defines any. The
    // template stores the same nested shape the form uses.
    if (values.invoiceDetails && values.invoiceDetails.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setValue("invoiceDetails", values.invoiceDetails as any, {
        shouldDirty: true,
      });
    }
  };

  // Build the save-template payload from the current form. "Every
  // non-empty field minus pvNum" — empty strings, null, undefined, and
  // invoice rows that look like the empty-default are filtered out.
  const getTemplateValues = (): TemplateValues => {
    const v = getValue();
    const result: TemplateValues = {};

    const isNonEmptyStr = (s: string | null | undefined): s is string =>
      typeof s === "string" && s.trim() !== "";

    if (typeof v.businessArea === "number") result.businessArea = v.businessArea;
    if (isNonEmptyStr(v.agency)) result.agency = v.agency;
    if (isNonEmptyStr(v.vendor)) result.vendor = v.vendor;
    if (v.date instanceof Date) result.date = v.date;
    if (isNonEmptyStr(v.notes)) result.notes = v.notes;
    if (isNonEmptyStr(v.currency)) result.currency = v.currency;
    if (typeof v.exchangeRate === "number") result.exchangeRate = v.exchangeRate;
    if (isNonEmptyStr(v.poNum)) result.poNum = v.poNum;
    if (isNonEmptyStr(v.paymentMethod)) result.paymentMethod = v.paymentMethod;
    if (v.parkedDate instanceof Date) result.parkedDate = v.parkedDate;
    if (v.postingDate instanceof Date) result.postingDate = v.postingDate;
    if (isNonEmptyStr(v.transferNum)) result.transferNum = v.transferNum;
    if (isNonEmptyStr(v.clearingDoc?.num)) result.clearingDocNum = v.clearingDoc.num;
    if (v.clearingDoc?.date instanceof Date) result.clearingDocDate = v.clearingDoc.date;

    const idFor = (name: string | undefined) => findStaffId(name);
    const preparedId = idFor(v.preparedBy?.name);
    if (preparedId) result.preparedById = preparedId;
    const verifiedId = idFor(v.verifiedBy?.name);
    if (verifiedId) result.verifiedById = verifiedId;
    const auth1Id = idFor(v.authorisedByOne?.name);
    if (auth1Id) result.authorisedByOneId = auth1Id;
    const auth2Id = idFor(v.authorisedByTwo?.name);
    if (auth2Id) result.authorisedByTwoId = auth2Id;

    // Invoices: keep only rows the user actually engaged with. The
    // form's create-mode default is one empty row with code=0/total=0;
    // filtering out rows with no comments AND no positive total AND no
    // meaningful GL avoids saving template invoices that boil down to
    // the empty defaults.
    const invoices = (v.invoiceDetails ?? []).filter((inv) => {
      const hasComments = isNonEmptyStr(inv.comments);
      const hasTotal =
        typeof inv.invoiceTotal === "number" && inv.invoiceTotal > 0;
      const hasGL = (inv.glDetails ?? []).some(
        (g) =>
          (typeof g.code === "number" && g.code > 100000) ||
          (typeof g.amount === "number" && g.amount > 0),
      );
      return hasComments || hasTotal || hasGL;
    });
    if (invoices.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.invoiceDetails = invoices as any;
    }

    return result;
  };

  const onSubmit = (values: z.infer<typeof PvSchema>) => {
    setSubmitBtnState(false);

    // Transform form values to match tRPC schema
    // The form uses embedded staff objects, but API expects staff IDs
    const transformedData = {
      pvNum: values.pvNum,
      businessArea: values.businessArea,
      agency: values.agency,
      vendor: values.vendor,
      date: values.date,
      notes: values.notes,
      currency: values.currency,
      exchangeRate: values.exchangeRate,

      // Map staff names to IDs. Keep the original assignment when a name is
      // present but unresolved, so an edit never nulls a still-assigned
      // signatory (see resolveSignatoryId). In create mode pv is undefined,
      // so the fallback is undefined → null, matching prior behaviour.
      preparedById: resolveSignatoryId(values.preparedBy, pv?.preparedById),
      verifiedById: resolveSignatoryId(values.verifiedBy, pv?.verifiedById),
      authorisedByOneId: resolveSignatoryId(
        values.authorisedByOne,
        pv?.authorisedByOneId,
      ),
      authorisedByTwoId: resolveSignatoryId(
        values.authorisedByTwo,
        pv?.authorisedByTwoId,
      ),

      // Transform invoiceDetails to invoices
      invoices: values.invoiceDetails.map((invoice) => ({
        comments: invoice.comments,
        documentNum: invoice.documentNumber || null,
        invoiceNumber: invoice.invoiceNumber || null,
        invoiceDate: invoice.invoiceDate,
        invoiceTotal: invoice.invoiceTotal,
        glDetails: invoice.glDetails.map((gl) => ({
          code: gl.code,
          fund: gl.fund,
          amount: gl.amount,
        })),
      })),

      poNum: values.poNum || null,
      paymentMethod: values.paymentMethod,
      parkedDate: values.parkedDate,
      postingDate: values.postingDate,
      clearingDocNum: values.clearingDoc?.num || null,
      clearingDocDate: values.clearingDoc?.date,
      transferNum: values.transferNum || null,
      isPettyCashReimbursement: values.isPettyCashReimbursement ?? false,
    };

    if (!pv) {
      // Create new PV
      createMutation.mutate(transformedData);
    } else {
      // Update existing PV
      updateMutation.mutate(transformedData);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Template picker — only in create mode. Edit mode is for
            tweaking an existing PV; templates only seed new ones. The
            "Save as template" trigger lives down in the form footer
            next to the submit button. */}
        {!pv && (
          <div className="flex flex-col gap-2 rounded-md border bg-card p-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Templates
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Pick a saved template to pre-fill the form. The PV
                number is always left blank for you to fill in.
              </p>
            </div>
            <TemplatePicker
              onApply={applyTemplate}
              appliedId={appliedTemplate?.id ?? null}
              onClear={() => setAppliedTemplate(null)}
            />
          </div>
        )}

        <section className="rounded-md border bg-card p-6">
          <div className="mb-5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Voucher Details
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <PvInputField
              control={control}
              name={"businessArea"}
              label="Business Area"
            />
            <PvInputField control={control} name={"vendor"} label="Vendor" />
            <PvInputField
              control={control}
              name={"pvNum"}
              label="PV Number"
              required={pv ? false : true}
              register={register}
              description={pv ? "" : "PV Number Eg: 2024-03"}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PvInputField control={control} name={"agency"} label="Agency" />
            <PvInputField control={control} name={"date"} label="Date" />
          </div>

          <div className="mt-4">
            <PvInputField control={control} name={"notes"} label="Note(s)" />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <PvInputField control={control} name={"poNum"} label="PO Number" />
            <PVDropDownField
              control={control}
              name={"currency"}
              label="Currency"
              options={Currencies.sort()}
              placeholder="Select a currency"
              customHandler={handleCurrencyChange}
              description="All the available currencies in MMA website."
            />
            <PvInputField
              control={control}
              name={"exchangeRate"}
              label="Exchange Rate"
              disabled={true}
              description="Rate is taken from MMA website."
            />
          </div>
        </section>

        {/* Invoice Section */}
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Invoices &amp; GL Distribution
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {fields.length} {fields.length === 1 ? "invoice" : "invoices"} on this voucher
              </p>
            </div>
          </div>

          <div className="transition-all duration-150">
          {fields.map((item, index) => (
            <div
              key={item.id}
              className="mb-6 grid grid-cols-4 gap-4 rounded-md border bg-card p-6"
            >
              <div className="col-span-4 flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Invoice
                  </span>
                  <span className="font-mono text-sm font-medium tabular-nums">
                    #{(index + 1).toString().padStart(2, "0")}
                  </span>
                </div>
                {index != 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(index)}
                    className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-red-600"
                  >
                    <Trash2 className="size-3.5" />
                    Remove
                  </Button>
                )}
              </div>
              {/* Comment(s) */}
              <PvInputField
                control={control}
                name={`invoiceDetails.${index}.comments`}
                label="Comments"
                className="flex flex-col gap-2 col-span-4"
              />

              {/* Invoice Date */}
              <PvInputField
                control={control}
                name={`invoiceDetails.${index}.invoiceDate`}
                label="Invoice Date"
                className="flex flex-col justify-start gap-2"
              />

              {/* Document Number */}
              <PvInputField
                control={control}
                name={`invoiceDetails.${index}.documentNumber`}
                label="Document Number"
                className="flex flex-col gap-2"
              />

              {/* Invoice Number */}
              <PvInputField
                control={control}
                name={`invoiceDetails.${index}.invoiceNumber`}
                label="Invoice Number"
                className="flex flex-col gap-2"
              />

              {/* Invoice Total */}
              <PvInputField
                disabled={true}
                control={control}
                name={`invoiceDetails.${index}.invoiceTotal`}
                label="Invoice Total"
                className="flex flex-col gap-2"
              />

              {/* GL Section */}
              <GLForm
                className="col-span-4"
                nestIndex={index}
                control={control}
                setValue={setValue}
                formValues={getValue}
              />
            </div>
          ))}
          {/* Add invoice button */}
          <button
            type="button"
            onClick={() => {
              append({
                comments: "",
                documentNumber: "",
                invoiceNumber: "",
                invoiceDate: new Date(),
                invoiceTotal: 0,
                glDetails: [
                  {
                    code: 0,
                    fund: "C-GOM",
                    amount: 0,
                  },
                ],
              });
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed bg-background px-4 text-sm font-medium text-muted-foreground transition hover:border-solid hover:bg-muted hover:text-foreground"
          >
            <Plus className="size-4" />
            Add invoice
          </button>
          </div>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Signatories
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Staff who prepared, verified, and authorised this voucher
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Prepared By Section */}
          <div className="flex flex-col gap-4 rounded-md border bg-card p-6">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Prepared By
            </div>
            <StaffDropDownField
              control={control}
              name="preparedBy"
              label="Name"
              staffs={staff ?? []}
              formSetValue={setValue}
            />
            <PvInputField
              control={control}
              name={"preparedBy.designation"}
              label="Designation"
              disabled={true}
            />
          </div>

          {/* Verified By Section */}
          <div className="flex flex-col gap-4 rounded-md border bg-card p-6">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Verified By
            </div>
            <StaffDropDownField
              control={control}
              name="verifiedBy"
              label="Name"
              staffs={staff ?? []}
              formSetValue={setValue}
            />
            <PvInputField
              control={control}
              name={"verifiedBy.designation"}
              label="Designation"
              disabled={true}
            />
          </div>

          {/* Authorised By Section One */}
          <div className="flex flex-col gap-4 rounded-md border bg-card p-6">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Authorised By
            </div>
            <StaffDropDownField
              control={control}
              name="authorisedByOne"
              label="Name"
              staffs={staff ?? []}
              formSetValue={setValue}
            />
            <PvInputField
              control={control}
              name={"authorisedByOne.designation"}
              label="Designation"
              disabled={true}
            />
          </div>

          {/* Authorised By Section Two */}
          <div className="flex flex-col gap-4 rounded-md border bg-card p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Authorised By <span className="font-mono normal-case tracking-normal">· 2</span>
              </div>
              {form.watch("authorisedByTwo.name") && (
                <button
                  type="button"
                  onClick={() => {
                    setValue("authorisedByTwo.name", "", { shouldDirty: true });
                    setValue("authorisedByTwo.designation", "", { shouldDirty: true });
                  }}
                  className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground transition hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
            <StaffDropDownField
              control={control}
              name="authorisedByTwo"
              label="Name"
              staffs={staff ?? []}
              formSetValue={setValue}
            />
            <PvInputField
              control={control}
              name={"authorisedByTwo.designation"}
              label="Designation"
              disabled={true}
            />
          </div>
          </div>
        </section>

        <section className="rounded-md border bg-card p-6">
          <div className="mb-5">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Payment &amp; Clearing
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Disbursement and document tracking details
            </p>
          </div>

          <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-3">
            <PvInputField
              control={control}
              name={"paymentMethod"}
              label="Payment Method"
            />
            <PvInputField
              control={control}
              name={"parkedDate"}
              label="Parking Date"
            />
            {/* Posting Date is no longer entered here — it's recorded
                automatically when a user posts the PV (see the Post action). */}
            <PvInputField
              control={control}
              name={"clearingDoc.num"}
              label="Clearing Doc. Number"
            />
            <PvInputField
              control={control}
              name={"clearingDoc.date"}
              label="Clearing Doc. Date"
            />
            <PvInputField
              control={control}
              name={"transferNum"}
              label="Transfer Number"
            />
          </div>

          <Controller
            control={control}
            name="isPettyCashReimbursement"
            render={({ field }) => (
              <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-md border bg-background p-3 transition hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={!!field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    Petty Cash Reimbursement
                  </span>
                  <span className="text-xs text-muted-foreground">
                    This voucher reimburses / tops up the petty cash float. It
                    appears as a &ldquo;Received&rdquo; row in the petty cash
                    register export.
                  </span>
                </span>
              </label>
            )}
          />
        </section>

        {/* Reference documents — queued in create mode (uploaded after the
            PV is created so we have an id), live in edit mode. Delete is
            gated server-side; here we surface canDelete based on status
            so the UI doesn't tempt users into a 403. */}
        {pv?.id ? (
          <AttachmentSection
            referenceType="pv"
            referenceId={pv.id}
            canAdd={canUploadAttachments}
            canDelete={canDeleteAttachments}
          />
        ) : (
          <AttachmentQueue ref={attachmentQueueRef} />
        )}

        <div className="flex items-center justify-end gap-3 border-t pt-6">
          {!pv && (
            <SaveTemplateDialog
              getCurrentValues={getTemplateValues}
              appliedTemplate={appliedTemplate}
              trigger={
                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-2 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
                >
                  <Save className="size-3.5" />
                  {appliedTemplate
                    ? `Save "${appliedTemplate.name}"`
                    : "Save as template"}
                </button>
              }
            />
          )}
          <button
            type="submit"
            disabled={!submitBtnState}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-6 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pv ? "Save changes" : "Create"}
          </button>
        </div>
      </form>
    </Form>
  );
};

export default PvForm;
