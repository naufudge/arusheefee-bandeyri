"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Secondary text shown muted after the label (e.g. a GL account's name). Searchable. */
  hint?: string;
}

interface SearchableSelectProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "value" | "onSelect" | "children"
  > {
  options: SearchableSelectOption[];
  value: string | null | undefined;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  /** Shown in the list when there are no options at all. */
  emptyMessage?: string;
  /** Shows a spinner in the trigger, e.g. while a pick is being applied. */
  loading?: boolean;
  /**
   * Set when rendered inside a Radix Dialog. The dialog locks pointer
   * events to its own content, which also catches this portaled popover;
   * a modal popover becomes its own interactive layer above that lock.
   */
  modal?: boolean;
  /**
   * Classes for the dropdown panel. It matches the trigger's width by
   * default; pass e.g. a wider width when option labels are long.
   */
  contentClassName?: string;
}

/**
 * Single-select dropdown with a search box — use instead of Radix Select
 * when the list is long enough to need filtering. Type to filter, arrow
 * keys to move, Enter to pick.
 *
 * Extra props (id, aria-*, ref) land on the trigger button, so it works
 * inside shadcn's <FormControl>, which injects them via Slot.
 */
export const SearchableSelect = React.forwardRef<
  HTMLButtonElement,
  SearchableSelectProps
>(
  (
    {
      options,
      value,
      onValueChange,
      placeholder = "Select…",
      searchPlaceholder = "Search…",
      emptyMessage = "No options",
      loading,
      modal,
      contentClassName,
      disabled,
      className,
      ...triggerProps
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const [active, setActive] = React.useState(0);
    const listRef = React.useRef<HTMLUListElement>(null);
    const listId = React.useId();

    const filtered = React.useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!q) return options;
      return options.filter((o) =>
        `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q),
      );
    }, [options, query]);

    // Fall back to the raw value so a stored entry that isn't in the list
    // (e.g. a renamed staff member) still shows instead of looking blank.
    const selected = options.find((o) => o.value === value);
    const display = selected?.label ?? value;

    function handleOpenChange(next: boolean) {
      if (next) {
        // Fresh search each time, with the current pick highlighted.
        setQuery("");
        setActive(
          Math.max(
            0,
            options.findIndex((o) => o.value === value),
          ),
        );
      }
      setOpen(next);
    }

    function pick(option: SearchableSelectOption) {
      onValueChange(option.value);
      setOpen(false);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        // Never let Enter reach an enclosing <form>.
        e.preventDefault();
        const option = filtered[active];
        if (option) pick(option);
      }
    }

    // Keep the keyboard-highlighted row in view while arrowing.
    React.useEffect(() => {
      if (!open) return;
      listRef.current
        ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
        ?.scrollIntoView({ block: "nearest" });
    }, [active, open]);

    return (
      <Popover open={open} onOpenChange={handleOpenChange} modal={modal}>
        <PopoverTrigger asChild>
          <button
            {...triggerProps}
            ref={ref}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            disabled={disabled}
            className={cn(
              "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              className,
            )}
          >
            {loading && (
              <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
            )}
            <span
              className={cn(
                "flex-1 truncate",
                !display && "text-muted-foreground",
              )}
            >
              {display || placeholder}
              {selected?.hint && <OptionHint hint={selected.hint} />}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={4}
          className={cn(
            "w-[--radix-popover-trigger-width] min-w-[220px] p-0",
            contentClassName,
          )}
        >
          <div className="relative border-b">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="w-full bg-transparent py-2 pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            className="max-h-60 overflow-auto py-1 text-sm"
          >
            {options.length === 0 ? (
              <li className="px-3 py-2 text-xs text-muted-foreground">
                {emptyMessage}
              </li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-muted-foreground">
                No matches for &quot;{query}&quot;
              </li>
            ) : (
              filtered.map((option, i) => {
                const isSelected = option.value === value;
                return (
                  <li
                    key={`${option.value}-${i}`}
                    role="option"
                    aria-selected={isSelected}
                    data-index={i}
                    onMouseEnter={() => setActive(i)}
                    // Keep focus in the search box so arrows + Enter keep working.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(option)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 px-3 py-2",
                      i === active && "bg-muted",
                    )}
                  >
                    <Check
                      className={cn(
                        "size-3.5 shrink-0",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">
                      {option.label}
                      {option.hint && <OptionHint hint={option.hint} />}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        </PopoverContent>
      </Popover>
    );
  },
);
SearchableSelect.displayName = "SearchableSelect";

function OptionHint({ hint }: { hint: string }) {
  return <span className="text-muted-foreground"> · {hint}</span>;
}
