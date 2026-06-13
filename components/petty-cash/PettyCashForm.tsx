"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { Form } from "@/components/ui/form";
import { AttachmentSection } from "@/components/attachments/AttachmentSection";
import {
  AttachmentQueue,
  type AttachmentQueueHandle,
} from "@/components/attachments/AttachmentQueue";
import {
  PettyCashSchema,
  PettyCashCreateSchema,
  PettyCashValues,
  PettyCashRoleName,
} from "@/schemas/PettyCashSchema";
import {
  PettyCashInputField,
  PettyCashStaffDropDownField,
} from "@/components/petty-cash/PettyCashInputField";
import ItemsForm from "@/components/petty-cash/ItemsForm";
import { Staff } from "@/types";
import { useTRPC } from "@/lib/trpc";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Control } from "react-hook-form";

interface PettyCashFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pettyCash?: any;
}

// Handled By is the primary signatory — rendered full-width above the
// other four roles. Procurement / Budget approvers don't transfer money
// (`showAmount: false`), they just sign off.
const HANDLED_BY_ROLE: { key: PettyCashRoleName; label: string } = {
  key: "handledBy",
  label: "Handled By",
};

const SECONDARY_ROLES: {
  key: PettyCashRoleName;
  label: string;
  showAmount: boolean;
}[] = [
  { key: "procurementApprovedBy", label: "Procurement Approved By", showAmount: false },
  { key: "budgetCheckedBy", label: "Budget Checked By", showAmount: false },
  { key: "balanceHandedOverBy", label: "Balance Handed Over By", showAmount: true },
  { key: "balanceCollectedBy", label: "Balance Collected By", showAmount: true },
];

const emptyRole = () => ({
  name: "",
  designation: "",
  amount: null,
  isApproved: false,
  date: new Date(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rolePresetFromServer(role: any | null | undefined) {
  if (!role) return emptyRole();
  return {
    name: role.staff?.name ?? "",
    designation: role.staff?.designation ?? "",
    amount: role.amount ?? null,
    isApproved: !!role.isApproved,
    date: role.date ? new Date(role.date) : new Date(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDefaults(pettyCash?: any): PettyCashValues {
  if (!pettyCash) {
    return {
      pettyCashNum: "",
      date: new Date(),
      formNum: "",
      sectionUnit: "",
      totalRequiredAmount: 0,
      glCode: 0,
      parkedDate: null,
      postingDate: null,
      handledBy: emptyRole(),
      procurementApprovedBy: emptyRole(),
      budgetCheckedBy: emptyRole(),
      balanceHandedOverBy: emptyRole(),
      balanceCollectedBy: emptyRole(),
      items: [{ qty: 1, name: "", nameDhivehi: "" }],
    };
  }

  return {
    pettyCashNum: pettyCash.pettyCashNum,
    date: new Date(pettyCash.date),
    formNum: pettyCash.formNum,
    sectionUnit: pettyCash.sectionUnit,
    totalRequiredAmount: pettyCash.totalRequiredAmount,
    glCode: pettyCash.glCode,
    parkedDate: pettyCash.parkedDate ? new Date(pettyCash.parkedDate) : null,
    postingDate: pettyCash.postingDate ? new Date(pettyCash.postingDate) : null,
    handledBy: rolePresetFromServer(pettyCash.handledBy),
    procurementApprovedBy: rolePresetFromServer(pettyCash.procurementApprovedBy),
    budgetCheckedBy: rolePresetFromServer(pettyCash.budgetCheckedBy),
    balanceHandedOverBy: rolePresetFromServer(pettyCash.balanceHandedOverBy),
    balanceCollectedBy: rolePresetFromServer(pettyCash.balanceCollectedBy),
    items:
      pettyCash.items && pettyCash.items.length > 0
        ? pettyCash.items.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (it: any) => ({
              qty: it.qty,
              name: it.name ?? "",
              nameDhivehi: it.nameDhivehi ?? "",
            }),
          )
        : [{ qty: 1, name: "" }],
  };
}

const PettyCashForm: React.FC<PettyCashFormProps> = ({ pettyCash }) => {
  const router = useRouter();
  const { toast } = useToast();
  const trpc = useTRPC();

  const canEditParked = useHasPermission(PERMISSIONS.PETTYCASH_EDIT_PARKED_DATE);
  const canEditPosting = useHasPermission(
    PERMISSIONS.PETTYCASH_EDIT_POSTING_DATE,
  );
  // Attachment perms are independent of the petty cash's approval state
  // now. Server enforces the same.
  const canUploadAttachments = useHasPermission(PERMISSIONS.ATTACHMENT_UPLOAD);
  const canDeleteAttachments = useHasPermission(PERMISSIONS.ATTACHMENT_DELETE);

  const [submitBtnState, setSubmitBtnState] = useState(true);

  const { data: staffData } = useQuery(trpc.staff.list.queryOptions());
  const staff: Staff[] | undefined = staffData?.map((s) => ({
    _id: s.id,
    name: s.name,
    designation: s.designation,
  }));

  // buildDefaults() seeds unfilled role rows with `new Date()` placeholders,
  // so calling it on every render would produce a fresh object whose `date`
  // fields advance by milliseconds. react-hook-form's `values` prop would
  // then trigger a reset every render — infinite loop. Memoise so the
  // values reference is stable until the underlying server record changes.
  const initialValues = useMemo(() => buildDefaults(pettyCash), [pettyCash]);

  // Strict slash-format check only applies to new records. Loading a
  // legacy record (PC-86-2025) into the edit form must not be blocked by
  // the regex — the user is editing items/dates, not renaming.
  const resolverSchema = pettyCash ? PettyCashSchema : PettyCashCreateSchema;

  const form = useForm<PettyCashValues>({
    resolver: zodResolver(resolverSchema),
    defaultValues: initialValues,
    values: pettyCash ? initialValues : undefined,
  });

  const control = form.control;
  const register = form.register;
  const setValue = form.setValue;

  const findStaffId = (staffName: string | undefined): string | null => {
    if (!staffName || !staffData) return null;
    return staffData.find((s) => s.name === staffName)?.id ?? null;
  };

  const transformRole = (role: PettyCashValues[PettyCashRoleName]) => {
    const staffId = findStaffId(role.name);
    if (!staffId) return null;
    return {
      staffId,
      amount: role.amount ?? null,
      isApproved: !!role.isApproved,
      date: role.date,
    };
  };

  // Holds queued attachments while the petty cash doesn't exist yet
  // (create mode). On successful create we flush the queue against the
  // new id before navigating away.
  const attachmentQueueRef = useRef<AttachmentQueueHandle | null>(null);

  // The ref is read inside the post-success callback (event-driven, not
  // during render); the lint rule's wary of refs in `mutationOptions`
  // because the options object is constructed during render, but the
  // callback only runs after the mutation settles.
  const createMutation = useMutation(
    // eslint-disable-next-line react-hooks/refs
    trpc.pettycash.create.mutationOptions({
      onSuccess: async (data) => {
        if (attachmentQueueRef.current && !attachmentQueueRef.current.isEmpty()) {
          await attachmentQueueRef.current.flush("petty_cash", data.id);
        }
        toast({
          title: "Created",
          description: `Petty cash ${data.pettyCashNum} saved.`,
        });
        setSubmitBtnState(true);
        router.push("/petty-cash-register");
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message ?? "Could not save petty cash.",
        });
        setSubmitBtnState(true);
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.pettycash.update.mutationOptions({
      onSuccess: (data) => {
        toast({
          title: "Saved",
          description: `Petty cash ${data.pettyCashNum} updated.`,
        });
        setSubmitBtnState(true);
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message ?? "Could not update petty cash.",
        });
        setSubmitBtnState(true);
      },
    }),
  );

  const onSubmit = (values: PettyCashValues) => {
    setSubmitBtnState(false);

    const payload = {
      pettyCashNum: values.pettyCashNum,
      date: values.date,
      formNum: values.formNum,
      sectionUnit: values.sectionUnit,
      totalRequiredAmount: values.totalRequiredAmount,
      glCode: values.glCode,
      parkedDate: values.parkedDate ?? null,
      postingDate: values.postingDate ?? null,
      handledBy: transformRole(values.handledBy),
      procurementApprovedBy: transformRole(values.procurementApprovedBy),
      budgetCheckedBy: transformRole(values.budgetCheckedBy),
      balanceHandedOverBy: transformRole(values.balanceHandedOverBy),
      balanceCollectedBy: transformRole(values.balanceCollectedBy),
      items: values.items.map((it) => ({
        qty: it.qty,
        name: it.name || null,
        nameDhivehi: it.nameDhivehi || null,
      })),
    };

    if (!pettyCash) {
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate(payload);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Request Details */}
        <section className="rounded-md border bg-card p-6">
          <div className="mb-5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Request Details
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <PettyCashInputField
              control={control}
              name="pettyCashNum"
              label="Petty Cash Number"
              required={!pettyCash}
              register={register}
              disabled={!!pettyCash}
              description={pettyCash ? "" : "Eg: PC/01/2025"}
            />
            <PettyCashInputField
              control={control}
              name="formNum"
              label="Form Number"
              description={pettyCash ? "" : "Generated from GEMS"}
            />
            <PettyCashInputField
              control={control}
              name="date"
              label="Date"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <PettyCashInputField
              control={control}
              name="sectionUnit"
              label="Section / Unit"
            />
            <PettyCashInputField
              control={control}
              name="glCode"
              label="GL Code"
              type="number"
              register={register}
            />
            <PettyCashInputField
              control={control}
              name="totalRequiredAmount"
              label="Total Required Amount"
              type="number"
              register={register}
            />
          </div>
        </section>

        {/* Items */}
        <section className="rounded-md border bg-card p-6">
          <div className="mb-4">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Items
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Things being purchased with this petty cash
            </p>
          </div>
          <ItemsForm control={control} />
        </section>

        {/* Roles */}
        <section>
          <div className="mb-4">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Signatories &amp; Approvals
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Staff handling, approving, and reconciling this petty cash
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <RoleCard
              roleKey={HANDLED_BY_ROLE.key}
              label={HANDLED_BY_ROLE.label}
              control={control}
              staff={staff ?? []}
              setValue={setValue}
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {SECONDARY_ROLES.map(({ key, label, showAmount }) => (
                <RoleCard
                  key={key}
                  roleKey={key}
                  label={label}
                  control={control}
                  staff={staff ?? []}
                  setValue={setValue}
                  showAmount={showAmount}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Parking & Posting — each field is only rendered when the user
            holds the matching permission. If they lack both, the section
            disappears entirely. Existing values on the record stay in
            form state regardless, so saving doesn't drop them. */}
        {(canEditParked || canEditPosting) && (
          <section className="rounded-md border bg-card p-6">
            <div className="mb-5">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Parking &amp; Posting
              </h2>
            </div>

            <div
              className={`grid gap-4 ${
                canEditParked && canEditPosting
                  ? "grid-cols-1 sm:grid-cols-2"
                  : "grid-cols-1"
              }`}
            >
              {canEditParked && (
                <PettyCashInputField
                  control={control}
                  name="parkedDate"
                  label="Parked Date"
                />
              )}
              {canEditPosting && (
                <PettyCashInputField
                  control={control}
                  name="postingDate"
                  label="Posting Date"
                />
              )}
            </div>
          </section>
        )}

        {/* Reference documents — queued in create mode, live in edit mode.
            Gated by the generic `attachment:*` permissions; no longer
            tied to the parent's approval state. */}
        {pettyCash?.id ? (
          <AttachmentSection
            referenceType="petty_cash"
            referenceId={pettyCash.id}
            canAdd={canUploadAttachments}
            canDelete={canDeleteAttachments}
          />
        ) : (
          <AttachmentQueue ref={attachmentQueueRef} />
        )}

        <div className="flex items-center justify-end gap-3 border-t pt-6">
          <button
            type="submit"
            disabled={!submitBtnState}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-6 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pettyCash ? "Save changes" : "Create petty cash"}
          </button>
        </div>
      </form>
    </Form>
  );
};

export default PettyCashForm;

// ----- Role card -----
// One card per role. Shows the staff dropdown, designation (auto-filled
// from the chosen staff), date, and — only for money-handling roles — an
// amount field. The `isApproved` flag still exists on the DB record but
// isn't surfaced here; the approval workflow is deferred to a later
// iteration. Submit defaults it to false for every role.
interface RoleCardProps {
  roleKey: PettyCashRoleName;
  label: string;
  control: Control<PettyCashValues>;
  staff: Staff[];
  setValue: ReturnType<typeof useForm<PettyCashValues>>["setValue"];
  /** Procurement/budget approvers don't transfer money. */
  showAmount?: boolean;
}

function RoleCard({
  roleKey,
  label,
  control,
  staff,
  setValue,
  showAmount = true,
}: RoleCardProps) {
  return (
    <div className="flex flex-col gap-4 rounded-md border bg-card p-6">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>

      <PettyCashStaffDropDownField
        control={control}
        name={roleKey}
        label="Name"
        staffs={staff}
        formSetValue={setValue}
      />

      <PettyCashInputField
        control={control}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name={`${roleKey}.designation` as any}
        label="Designation"
        disabled
      />

      <div className={`grid gap-3 ${showAmount ? "grid-cols-2" : "grid-cols-1"}`}>
        {showAmount && (
          <PettyCashInputField
            control={control}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            name={`${roleKey}.amount` as any}
            label="Amount"
            type="number"
          />
        )}
        <PettyCashInputField
          control={control}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          name={`${roleKey}.date` as any}
          label="Date"
        />
      </div>
    </div>
  );
}
