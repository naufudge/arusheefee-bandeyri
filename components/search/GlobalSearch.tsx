"use client";

import React, { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { History, Loader2, Search, X } from "lucide-react";
import { useTRPC } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { visibleNavGroups } from "@/components/layout/nav";
import {
  SEARCH_MIN_LENGTH,
  SEARCH_MODULES,
  SEARCH_MODULE_LABEL,
  SEARCH_MODULE_PERMISSION,
  type SearchModule,
} from "@/lib/search";
import { Highlight, Line, MODULE_ICON, RecordRow } from "./result-row";
import type { RecentRecord, SearchGroup } from "./types";

// ----- Recently opened records (per user, this browser only) -----

const RECENT_MAX = 6;
const recentKey = (userId: string) => `bandeyri:recent-search:${userId}`;

// Stored values are untrusted: keep only well-formed, same-site links.
function isRecent(x: unknown): x is RecentRecord {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    SEARCH_MODULES.includes(r.module as SearchModule) &&
    typeof r.href === "string" &&
    r.href.startsWith("/") &&
    !r.href.startsWith("//") &&
    typeof r.title === "string" &&
    (r.num === null || typeof r.num === "string")
  );
}

function loadRecents(userId: string): RecentRecord[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(recentKey(userId)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isRecent) : [];
  } catch {
    return [];
  }
}

function storeRecent(userId: string, item: RecentRecord) {
  try {
    const list = [item, ...loadRecents(userId).filter((r) => r.href !== item.href)];
    localStorage.setItem(recentKey(userId), JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    // Storage blocked or full: recents are a convenience only.
  }
}

// ----- Options: every selectable row, in display order -----

type PageOption = {
  kind: "page";
  href: string;
  title: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
};
type Option =
  | PageOption
  | { kind: "recent"; href: string; recent: RecentRecord }
  | { kind: "hit"; href: string; group: SearchGroup; index: number }
  | { kind: "more"; module: SearchModule };

type Section = { key: string; label: string; icon?: React.ComponentType<{ className?: string }>; options: Option[] };

const subscribeNoop = () => () => {};
const NO_PERMISSIONS: string[] = [];

function isEditable(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

export function GlobalSearch() {
  const trpc = useTRPC();
  const router = useRouter();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const permissions = session?.permissions ?? NO_PERMISSIONS;

  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchModule | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [recents, setRecents] = useState<RecentRecord[]>([]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const optionId = (i: number) => `${listId}-option-${i}`;

  // Hydration-safe platform check for the shortcut hint.
  const isMac = useSyncExternalStore(
    subscribeNoop,
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => false,
  );

  // Debounce typing into the server query.
  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 200);
    return () => clearTimeout(t);
  }, [input]);

  const serverEnabled = query.length >= SEARCH_MIN_LENGTH;
  const { data, isPlaceholderData, isError, isFetching } = useQuery({
    ...trpc.search.global.queryOptions({ q: query, module: scope ?? undefined }),
    enabled: serverEnabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const groups = useMemo(() => (serverEnabled ? (data ?? []) : []), [serverEnabled, data]);
  // Results on screen don't belong to what's typed yet.
  const stale = input.trim() !== query || isPlaceholderData;

  const pages = useMemo<PageOption[]>(
    () =>
      visibleNavGroups(permissions).flatMap((g) =>
        g.items.flatMap((item) =>
          item.items
            ? item.items.map((sub) => ({
                kind: "page" as const,
                href: sub.url,
                title: sub.title,
                group: item.title,
                icon: sub.icon ?? item.icon,
              }))
            : [{ kind: "page" as const, href: item.url, title: item.title, group: g.label, icon: item.icon }],
        ),
      ),
    [permissions],
  );

  const typed = input.trim();
  const sections = useMemo<Section[]>(() => {
    const out: Section[] = [];
    if (!scope) {
      if (!typed && recents.length > 0) {
        out.push({
          key: "recent",
          label: "Recent",
          icon: History,
          options: recents.map((r) => ({ kind: "recent", href: r.href, recent: r })),
        });
      }
      const needle = typed.toLowerCase();
      // "new pv" should find "Create PV".
      const matchPages = pages.filter((p) =>
        `${p.title} ${p.group} ${p.title.replace(/^Create/, "New")}`.toLowerCase().includes(needle),
      );
      if (matchPages.length > 0) out.push({ key: "pages", label: "Go to", options: matchPages });
    }
    for (const g of groups) {
      const options: Option[] = g.items.map((_, index) => ({
        kind: "hit",
        href: g.items[index].href,
        group: g,
        index,
      }));
      if (g.hasMore && !scope) options.push({ kind: "more", module: g.module });
      out.push({ key: g.module, label: SEARCH_MODULE_LABEL[g.module], icon: MODULE_ICON[g.module], options });
    }
    return out;
  }, [scope, typed, recents, pages, groups]);

  const options = useMemo(() => sections.flatMap((s) => s.options), [sections]);
  // Index of each section's first option within `options`.
  const sectionStart = useMemo(() => {
    let n = 0;
    return sections.map((s) => {
      const start = n;
      n += s.options.length;
      return start;
    });
  }, [sections]);
  const activeIndex = Math.min(active, Math.max(options.length - 1, 0));

  // Close when clicking anywhere outside the search.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Ctrl/⌘ K from anywhere, or "/" when not typing, jumps to the search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (k === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !isEditable(e.target)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Keep the keyboard-highlighted row in view.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function reset() {
    setInput("");
    setQuery("");
    setScope(null);
    setActive(0);
    setOpen(false);
  }

  function remember(option: Option) {
    if (!userId) return;
    if (option.kind === "recent") storeRecent(userId, option.recent);
    if (option.kind !== "hit") return;
    const hit = option.group.items[option.index];
    storeRecent(userId, { module: option.group.module, href: hit.href, num: hit.num, title: hit.title });
  }

  function choose(option: Option, newTab: boolean) {
    if (option.kind === "more") {
      setScope(option.module);
      setActive(0);
      inputRef.current?.focus();
      return;
    }
    remember(option);
    if (newTab) {
      window.open(option.href, "_blank", "noopener");
      return;
    }
    reset();
    inputRef.current?.blur();
    router.push(option.href);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      const last = options.length - 1;
      setActive(e.key === "ArrowDown" ? Math.min(activeIndex + 1, last) : Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = options[activeIndex];
      // Never open a result left over from the previous text: fetch now and
      // let the next Enter pick from the fresh list.
      if (stale && option?.kind !== "page" && option?.kind !== "recent") {
        setQuery(typed);
        return;
      }
      if (option) choose(option, e.ctrlKey || e.metaKey);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (open) setOpen(false);
      else reset();
    } else if (e.key === "Backspace" && input === "" && scope) {
      e.preventDefault();
      setScope(null);
      setActive(0);
    }
  }

  // A click that opens in this tab closes the search; modified clicks keep it.
  function handleLinkClick(e: React.MouseEvent, option: Option) {
    remember(option);
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    reset();
  }

  const showPanel = open && (sections.length > 0 || typed.length > 0 || scope !== null);
  const hitCount = groups.reduce((n, g) => n + g.items.length, 0);
  let status: string | null = null;
  if (isError) status = "Search failed. Check your connection and try again.";
  else if (scope && !typed) status = `Type to search ${SEARCH_MODULE_LABEL[scope].toLowerCase()}.`;
  else if (typed.length > 0 && typed.length < SEARCH_MIN_LENGTH)
    status = `Type at least ${SEARCH_MIN_LENGTH} characters to search records.`;
  else if (serverEnabled && !stale && !isFetching && hitCount === 0)
    status = `Nothing matches “${typed}”. Search looks at record numbers, vendors, descriptions and item names.`;

  return (
    <div ref={wrapperRef} className="relative w-full min-w-0 max-w-2xl">
      <div
        className={cn(
          "flex h-9 items-center gap-2 rounded-md border bg-muted/50 px-3 transition-colors",
          "focus-within:border-foreground/30 focus-within:bg-background focus-within:ring-2 focus-within:ring-ring/20",
        )}
      >
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        {scope && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-foreground/[0.07] py-0.5 pl-1.5 pr-0.5 text-[11px] font-medium">
            {SEARCH_MODULE_LABEL[scope]}
            <button
              type="button"
              onClick={() => {
                setScope(null);
                setActive(0);
                inputRef.current?.focus();
              }}
              className="rounded-sm p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
              aria-label={`Search everything, not just ${SEARCH_MODULE_LABEL[scope].toLowerCase()}`}
            >
              <X className="size-3" />
            </button>
          </span>
        )}
        <input
          ref={inputRef}
          type="text"
          dir="auto"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && options.length > 0 ? optionId(activeIndex) : undefined}
          aria-label="Search records and pages"
          autoComplete="off"
          spellCheck={false}
          maxLength={100}
          value={input}
          placeholder={scope ? "Search within…" : "Search Procurements, PVs, Assets, Forms..."}
          onFocus={() => {
            if (userId) {
              setRecents(
                loadRecents(userId).filter((r) => permissions.includes(SEARCH_MODULE_PERMISSION[r.module])),
              );
            }
            setOpen(true);
          }}
          onChange={(e) => {
            setInput(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {isFetching && serverEnabled ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        ) : input ? (
          <button
            type="button"
            onClick={() => {
              setInput("");
              setActive(0);
              inputRef.current?.focus();
            }}
            className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <kbd className="hidden shrink-0 rounded border bg-background px-1.5 font-sans text-[10px] font-medium text-muted-foreground sm:inline-block">
            {isMac ? "⌘K" : "Ctrl K"}
          </kbd>
        )}
      </div>

      {showPanel && (
        <div className="absolute inset-x-0 top-[calc(100%+0.375rem)] z-50 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-100">
          <div className="sr-only" aria-live="polite">
            {serverEnabled && !stale ? `${hitCount} records found` : ""}
          </div>
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Search results"
            className={cn(
              "max-h-[min(70vh,34rem)] overflow-y-auto overscroll-contain py-1 transition-opacity",
              stale && serverEnabled && "opacity-60",
            )}
          >
            {sections.map((section, s) => (
              <div key={section.key} role="group" aria-label={section.label} className="pb-1">
                <div className="flex items-center gap-1.5 px-3 pb-1 pt-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
                  {section.icon && <section.icon className="size-3" />}
                  {section.label}
                </div>
                {section.options.map((option, j) => {
                  const i = sectionStart[s] + j;
                  const isActive = i === activeIndex;
                  const rowClass = cn(
                    "mx-1 flex cursor-pointer items-center gap-3 rounded-[5px] px-2.5 py-2",
                    isActive && "bg-muted",
                  );
                  const common = {
                    id: optionId(i),
                    role: "option" as const,
                    "aria-selected": isActive,
                    "data-index": i,
                    onMouseMove: () => !isActive && setActive(i),
                    // Keep focus in the input so the keys keep working.
                    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
                  };
                  if (option.kind === "more") {
                    return (
                      <div key={`more-${option.module}`} {...common} onClick={() => choose(option, false)} className={rowClass}>
                        <span className="text-[12.5px] text-muted-foreground">
                          More {SEARCH_MODULE_LABEL[option.module].toLowerCase()} matching “{typed}”
                        </span>
                      </div>
                    );
                  }
                  return (
                    <Link
                      key={`${option.kind}-${option.href}`}
                      href={option.href}
                      tabIndex={-1}
                      {...common}
                      onClick={(e) => handleLinkClick(e, option)}
                      className={rowClass}
                    >
                      {option.kind === "page" && (
                        <>
                          <option.icon className="size-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate text-[13px]">
                            <Highlight text={option.title} query={typed} />
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{option.group}</span>
                        </>
                      )}
                      {option.kind === "recent" && (
                        <RecentRow recent={option.recent} />
                      )}
                      {option.kind === "hit" && (
                        <RecordRow group={option.group} index={option.index} query={query} />
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
            {status && (
              <p className="px-4 py-6 text-center text-[12.5px] leading-relaxed text-muted-foreground">
                {status}
              </p>
            )}
          </div>
          <div className="hidden items-center gap-4 border-t bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground sm:flex">
            <span><Key>↑</Key><Key>↓</Key> move</span>
            <span><Key>↵</Key> open</span>
            <span><Key>{isMac ? "⌘" : "Ctrl"}</Key><Key>↵</Key> new tab</span>
            <span><Key>esc</Key> close</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mr-0.5 inline-block min-w-[1.25rem] rounded border bg-background px-1 text-center font-sans text-[10px] font-medium">
      {children}
    </kbd>
  );
}

function RecentRow({ recent }: { recent: RecentRecord }) {
  const Icon = MODULE_ICON[recent.module];
  return (
    <>
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4">
        {recent.num && (
          <span className="truncate font-mono text-[12.5px] font-medium tracking-tight sm:w-40 sm:shrink-0">
            {recent.num}
          </span>
        )}
        <Line text={recent.title} query="" className="min-w-0 flex-1 text-[13px]" />
      </span>
      <span className="shrink-0 text-[11px] text-muted-foreground">
        {SEARCH_MODULE_LABEL[recent.module]}
      </span>
    </>
  );
}
