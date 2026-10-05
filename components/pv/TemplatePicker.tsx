"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { useTRPC, useTRPCClient } from "@/lib/trpc";
import type { TemplateValues } from "@/server/schemas/template.schema";

interface AppliedTemplateMeta {
  id: string;
  name: string;
}

// Narrow local row shapes. Prisma's `JsonValue` on the `values` column
// is recursive and trips the build-time TS instantiation depth limit
// when used through tRPC's `queryOptions` inference. We use the raw
// tRPC client + explicit queryFn return types to keep the type surface
// shallow at the consumer.
type TemplateListRow = {
  id: string;
  name: string;
};

type TemplateDetailRow = {
  id: string;
  name: string;
  values: TemplateValues;
};

interface TemplatePickerProps {
  /**
   * Called once a template is fetched. `meta` carries the applied
   * template's id + name so the form can offer an "update existing"
   * save flow alongside "save as new".
   */
  onApply: (values: TemplateValues, meta: AppliedTemplateMeta) => void;
  /**
   * Id of the template currently loaded into the form (if any). When
   * set, the Select shows that template as its current value.
   */
  appliedId?: string | null;
  /**
   * Fired when the user clears the selection (the small "X" next to
   * the dropdown). Form values stay intact — only the
   * "I am editing template X" tracking is cleared, so the next save
   * is treated as a brand-new template.
   */
  onClear?: () => void;
}

/**
 * Searchable dropdown for choosing a saved PV template. Lists templates from
 * `templates.list`; on select, fetches the freshest copy with
 * `templates.getById` and hands the values payload to `onApply` so the
 * parent (`PvForm`) can merge them into react-hook-form state.
 */
export function TemplatePicker({
  onApply,
  appliedId,
  onClear,
}: TemplatePickerProps) {
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const { toast } = useToast();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: trpc.templates.list.queryKey(),
    queryFn: async (): Promise<TemplateListRow[]> => {
      const result = (await trpcClient.templates.list.query()) as unknown;
      return result as TemplateListRow[];
    },
  });

  async function handleSelect(id: string) {
    setLoadingId(id);
    try {
      const result = (await trpcClient.templates.getById.query({ id })) as unknown;
      const tpl = result as TemplateDetailRow;
      onApply(tpl.values, { id: tpl.id, name: tpl.name });
      toast({
        title: "Template applied",
        description: `"${tpl.name}" loaded into the form.`,
      });
    } catch (err) {
      toast({
        title: "Could not apply template",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoadingId(null);
    }
  }

  const empty = !isLoading && (templates?.length ?? 0) === 0;

  return (
    <div className="flex min-w-[240px] items-center gap-2">
      <SearchableSelect
        // Bound to the applied template's id so the trigger shows the
        // loaded template's name.
        value={appliedId ?? ""}
        onValueChange={(id) => {
          // Re-picking the template that's already loaded would re-fetch
          // it and overwrite any edits made since applying it.
          if (id && id !== appliedId) void handleSelect(id);
        }}
        options={(templates ?? []).map((tpl) => ({
          value: tpl.id,
          label: tpl.name,
        }))}
        disabled={isLoading || empty || loadingId !== null}
        loading={loadingId !== null}
        placeholder={
          isLoading
            ? "Loading templates…"
            : empty
              ? "No templates saved"
              : "Apply template…"
        }
        searchPlaceholder="Search templates…"
        className="h-11"
        aria-label="Apply template"
      />
      {appliedId && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selected template"
          title="Clear selected template"
          className="inline-flex h-11 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
