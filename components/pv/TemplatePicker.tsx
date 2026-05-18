"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTRPC } from "@/lib/trpc";
import type { TemplateValues } from "@/server/schemas/template.schema";

interface AppliedTemplateMeta {
  id: string;
  name: string;
}

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
 * Dropdown for choosing a saved PV template. Lists templates from
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const { data: templates, isLoading } = useQuery({
    ...trpc.templates.list.queryOptions(),
  });

  async function handleSelect(id: string) {
    setLoadingId(id);
    try {
      const tpl = await queryClient.fetchQuery(
        trpc.templates.getById.queryOptions({ id }),
      );
      onApply(tpl.values as TemplateValues, { id: tpl.id, name: tpl.name });
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
      <Select
        // Bound to the applied template's id so the trigger displays
        // the loaded template's name. Radix Select skips a re-fire
        // when the same value is picked again — that's fine here,
        // re-applying an already-loaded template is a no-op anyway.
        value={appliedId ?? ""}
        onValueChange={(id) => {
          if (id) void handleSelect(id);
        }}
        disabled={isLoading || empty || loadingId !== null}
      >
        <SelectTrigger
          className="h-auto min-h-11 w-full justify-start py-1.5 text-left text-sm [&>span]:line-clamp-none [&>span]:flex-1 [&>span]:text-left"
          aria-label="Apply template"
        >
          {loadingId ? (
            <Loader2 className="mr-2 size-3.5 shrink-0 animate-spin text-muted-foreground" />
          ) : null}
          <SelectValue
            placeholder={
              isLoading
                ? "Loading templates…"
                : empty
                  ? "No templates saved"
                  : "Apply template…"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {templates?.map((tpl) => (
            <SelectItem key={tpl.id} value={tpl.id}>
              <span className="flex flex-col gap-0.5 py-0.5 leading-tight">
                <span className="text-sm">{tpl.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  by {tpl.createdBy?.name ?? "—"}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
