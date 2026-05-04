"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
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
      },
    };
  }
  return useForm<z.infer<typeof PvSchema>>(formConfig)
}

const PvForm: React.FC<PvFormProps> = ({ pv }) => {
  const [submitBtnState, setSubmitBtnState] = useState<boolean>(true);

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

  // Fetch latest PV (only when creating new PV)
  // Note: latestPV can be used for auto-generating PV numbers if needed
  useQuery({
    ...trpc.pv.latest.queryOptions(),
    enabled: !pv,
  });

  const form = usePvForm(pv);

  const control = form.control;
  const register = form.register;
  const setValue = form.setValue;
  const getValue = form.getValues;

  /* eslint-disable react-hooks/exhaustive-deps */
  // useEffect(() => {
  //   if (!pv && latestPVnum)
  //     setValue("pvNum", `2025-${latestPVnum.toString().padStart(3, "0")}`);
  // }, [latestPVnum, pv]);
  /* eslint-enable react-hooks/exhaustive-deps */

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

  // Create PV mutation
  const createMutation = useMutation(
    trpc.pv.create.mutationOptions({
      onSuccess: () => {
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

      // Map staff names to IDs
      preparedById: findStaffId(values.preparedBy?.name),
      verifiedById: findStaffId(values.verifiedBy?.name),
      authorisedByOneId: findStaffId(values.authorisedByOne?.name),
      authorisedByTwoId: findStaffId(values.authorisedByTwo?.name),

      // Transform invoiceDetails to invoices
      invoices: values.invoiceDetails.map((invoice) => ({
        comments: invoice.comments,
        documentNum: null,
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
                className="flex flex-col justify-start gap-2 col-span-2"
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
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Authorised By <span className="font-mono normal-case tracking-normal">· 2</span>
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
            <PvInputField
              control={control}
              name={"postingDate"}
              label="Posting Date"
            />
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
        </section>

        <div className="flex items-center justify-end gap-3 border-t pt-6">
          <button
            type="submit"
            disabled={!submitBtnState}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-6 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pv ? "Save changes" : "Create voucher"}
          </button>
        </div>
      </form>
    </Form>
  );
};

export default PvForm;
