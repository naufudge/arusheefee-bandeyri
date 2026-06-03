"use client";

import React, { useId, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search as SearchIcon, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type SelectableRole = {
  id: string;
  name: string;
  isSystem: boolean;
};

interface RoleMultiSelectProps {
  roles: SelectableRole[] | undefined;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  placeholder?: string;
  /** Shown inside the popover when there are no roles in the system. */
  emptyMessage?: React.ReactNode;
}

/**
 * Combobox-style multi-select for roles. Shows selected roles as removable
 * chips inside the trigger; clicking the trigger opens a popover with a
 * searchable, checkable list.
 */
const RoleMultiSelect: React.FC<RoleMultiSelectProps> = ({
  roles,
  selected,
  onChange,
  placeholder = "Select roles…",
  emptyMessage,
}) => {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const listboxId = useId();

  const selectedRoles = useMemo(
    () => (roles ?? []).filter((r) => selected.has(r.id)),
    [roles, selected],
  );

  const filtered = useMemo(() => {
    if (!roles) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) => r.name.toLowerCase().includes(q));
  }, [roles, filter]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const remove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const next = new Set(selected);
    next.delete(id);
    onChange(next);
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onChange(new Set());
  };

  const isLoading = roles === undefined;
  const isEmpty = !isLoading && (roles?.length ?? 0) === 0;

  return (
    // modal={true}: this Popover is rendered inside a Radix Dialog. Dialog
    // sets `pointer-events: none` on <body> to lock interaction to its
    // own content; the portaled popover content gets caught in that lock
    // even though it sits visually on top. modal makes the Popover its
    // own pointer-event layer that supersedes the dialog's lock.
    <Popover open={open} onOpenChange={setOpen} modal>
      {/*
        Trigger is a div (not a button) because it contains nested buttons
        for removing individual chips and clearing all selections. A
        <button> cannot legally contain another <button> — browsers
        auto-close the outer one mid-parse, which breaks event delegation
        on items inside the popover and produces a hydration mismatch.
      */}
      <PopoverTrigger asChild>
        <div
          role="combobox"
          tabIndex={0}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              (e.currentTarget as HTMLElement).click();
            }
          }}
          className="flex min-h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-background px-2 py-1 text-left text-sm ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {selectedRoles.length === 0 ? (
              <span className="px-1 text-muted-foreground">{placeholder}</span>
            ) : (
              selectedRoles.map((r) => (
                <span
                  key={r.id}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
                    r.isSystem
                      ? "bg-foreground text-background"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {r.name}
                  <button
                    type="button"
                    onClick={(e) => remove(r.id, e)}
                    aria-label={`Remove ${r.name}`}
                    className={`-mr-0.5 rounded transition ${
                      r.isSystem
                        ? "hover:text-background/70"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
            {selectedRoles.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                aria-label="Clear all roles"
                title="Clear all"
                className="rounded p-0.5 transition hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
            <ChevronsUpDown className="size-3.5" />
          </div>
        </div>
      </PopoverTrigger>

      <PopoverContent
        id={listboxId}
        align="start"
        sideOffset={4}
        className="w-[--radix-popover-trigger-width] gap-0 p-0"
      >
        {/* Search */}
        <div className="relative border-b">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search roles…"
            className="w-full bg-transparent py-2 pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* List */}
        <div className="max-h-56 overflow-auto py-1">
          {isLoading ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Loading roles…
            </div>
          ) : isEmpty ? (
            <div className="px-3 py-3 text-xs text-muted-foreground">
              {emptyMessage ?? "No roles defined yet."}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No roles match &quot;{filter}&quot;
            </div>
          ) : (
            <ul role="listbox" aria-multiselectable className="text-sm">
              {filtered.map((r) => {
                const checked = selected.has(r.id);
                return (
                  <li key={r.id} role="option" aria-selected={checked}>
                    <button
                      type="button"
                      onClick={() => toggle(r.id)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-muted/60"
                    >
                      <span
                        className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                          checked
                            ? "border-foreground bg-foreground text-background"
                            : "border-input"
                        }`}
                      >
                        {checked && <Check className="size-3" />}
                      </span>
                      <span className="flex-1 truncate">{r.name}</span>
                      {r.isSystem && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          System
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default RoleMultiSelect;
