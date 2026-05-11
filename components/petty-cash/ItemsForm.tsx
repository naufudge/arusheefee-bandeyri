import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Control, useFieldArray } from "react-hook-form";
import { PettyCashValues } from "@/schemas/PettyCashSchema";

interface ItemsFormProps {
  control: Control<PettyCashValues>;
  className?: string;
}

const ItemsForm: React.FC<ItemsFormProps> = ({ control, className }) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  return (
    <div className={className}>
      {fields.map((item, index) => (
        <div
          key={item.id}
          className={`mb-3 grid items-end gap-3 ${
            index !== 0 ? "grid-cols-[80px_1fr_auto]" : "grid-cols-[80px_1fr]"
          }`}
        >
          <FormField
            control={control}
            name={`items.${index}.qty`}
            render={({ field }) => (
              <FormItem>
                {index === 0 && <FormLabel>Qty</FormLabel>}
                <FormControl>
                  <Input type="number" placeholder="1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`items.${index}.name`}
            render={({ field }) => (
              <FormItem>
                {index === 0 && <FormLabel>Item</FormLabel>}
                <FormControl>
                  <Input placeholder="Item description" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {index !== 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => remove(index)}
              className="h-9 px-2 text-muted-foreground hover:text-red-600"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => append({ qty: 1, name: "" })}
        className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed bg-background px-4 text-sm font-medium text-muted-foreground transition hover:border-solid hover:bg-muted hover:text-foreground"
      >
        <Plus className="size-4" />
        Add item
      </button>
    </div>
  );
};

export default ItemsForm;
