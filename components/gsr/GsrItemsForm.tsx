import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Control, useFieldArray } from "react-hook-form";
import { GsrValues } from "@/schemas/GsrSchema";
import { GsrInputField } from "@/components/gsr/GsrInputField";
import { RtlDhivehiInput } from "@/components/gsr/RtlDhivehiInput";

interface GsrItemsFormProps {
  control: Control<GsrValues>;
  className?: string;
}

const GsrItemsForm: React.FC<GsrItemsFormProps> = ({ control, className }) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  return (
    <div className={className}>
      {fields.map((item, index) => (
        <div
          key={item.id}
          className="mb-4 grid grid-cols-1 items-start gap-4 rounded-md border bg-card p-5 sm:grid-cols-12"
        >
          <div className="col-span-1 flex items-center justify-between sm:col-span-12">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Item #{(index + 1).toString().padStart(2, "0")}
            </span>
            {index !== 0 && (
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

          {/* Row 1 — particulars (full width) */}
          <GsrInputField
            control={control}
            name={`items.${index}.particulars`}
            label="Particulars"
            placeholder="e.g. Wired USB Headphones"
            className="sm:col-span-12"
          />
          {/* Row 2 — quantities + required date */}
          <GsrInputField
            control={control}
            name={`items.${index}.requestedQty`}
            label="Requested Qty"
            type="number"
            placeholder="1"
            className="sm:col-span-4"
          />
          <GsrInputField
            control={control}
            name={`items.${index}.issuedQty`}
            label="Issued Qty"
            type="number"
            placeholder="0"
            className="sm:col-span-4"
          />
          <GsrInputField
            control={control}
            name={`items.${index}.rqdDate`}
            label="Required Date"
            className="sm:col-span-4"
          />
          {/* Row 3 — remarks (full width) */}
          <RtlDhivehiInput
            control={control}
            name={`items.${index}.remarks`}
            label="Remarks (Dhivehi)"
            multiline
            className="sm:col-span-12"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          append({
            particulars: "",
            requestedQty: 0,
            issuedQty: null,
            rqdDate: null,
            remarks: "",
          })
        }
        className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed bg-background px-4 text-sm font-medium text-muted-foreground transition hover:border-solid hover:bg-muted hover:text-foreground"
      >
        <Plus className="size-4" />
        Add item
      </button>
    </div>
  );
};

export default GsrItemsForm;
