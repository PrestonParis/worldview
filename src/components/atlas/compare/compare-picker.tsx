"use client";

import { useId, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { FAMILIES, familyColor } from "@/lib/quiz/families";
import type { IdeologyFamily } from "@/lib/quiz/types";
import { MarkerGlyph } from "@/components/politics/axis";
import { focusRing } from "@/components/politics/type";
import { MAX_COMPARED, SHAPES } from "./shapes";

export interface PickerOption {
  id: string;
  name: string;
  family: IdeologyFamily;
}

// The traditions under comparison as removable chips, and a searchable
// combobox to add one. The selection lives in "?ids=" so it can be shared.
export function ComparePicker({ options, selected }: { options: PickerOption[]; selected: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options
      .filter(
        (o) =>
          !selected.includes(o.id) &&
          (!q || o.name.toLowerCase().includes(q) || FAMILIES[o.family].label.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [options, query, selected]);

  const go = (ids: string[]) => {
    const next = new URLSearchParams(params);
    if (ids.length) next.set("ids", ids.join(","));
    else next.delete("ids");
    startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
  };
  const add = (id: string) => {
    go([...selected, id].slice(0, MAX_COMPARED));
    setQuery("");
    setActive(0);
    if (selected.length + 1 >= MAX_COMPARED) setOpen(false);
  };

  const full = selected.length >= MAX_COMPARED;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${pending ? "opacity-70" : ""}`} aria-busy={pending}>
      {selected.map((id, i) => {
        const o = byId.get(id);
        if (!o) return null;
        return (
          <span
            key={id}
            className="wv-fade inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white py-1 pr-1 pl-3 text-sm font-semibold text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            <MarkerGlyph shape={SHAPES[i]} color={familyColor(o.family)} />
            {o.name}
            <button
              type="button"
              onClick={() => go(selected.filter((x) => x !== id))}
              aria-label={`Remove ${o.name}`}
              className={`rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-slate-800 dark:hover:text-white ${focusRing}`}
            >
              <X size={14} aria-hidden />
            </button>
          </span>
        );
      })}
      {!full && (
        <div className="relative">
          <label htmlFor={`${listId}-input`} className="sr-only">
            Add a tradition to compare
          </label>
          <div className="flex items-center gap-2 rounded-full border border-dashed border-slate-400 bg-white px-3 py-1.5 focus-within:border-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:focus-within:border-white">
            {selected.length === 0 ? (
              <Search size={15} aria-hidden className="text-slate-500" />
            ) : (
              <Plus size={15} aria-hidden className="text-slate-500" />
            )}
            <input
              ref={input}
              id={`${listId}-input`}
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].id}` : undefined}
              value={query}
              placeholder={selected.length === 0 ? "Search traditions…" : "Add a tradition…"}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 120)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setOpen(true);
                  setActive((a) => Math.min(a + 1, matches.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter" && open && matches[active]) {
                  e.preventDefault();
                  add(matches[active].id);
                } else if (e.key === "Escape") setOpen(false);
              }}
              className="w-44 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-500 dark:text-white"
            />
          </div>
          {open && matches.length > 0 && (
            <ul
              id={listId}
              role="listbox"
              aria-label="Traditions"
              className="wv-fade absolute top-full left-0 z-40 mt-1.5 max-h-80 w-72 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
            >
              {matches.map((o, i) => (
                <li
                  key={o.id}
                  id={`${listId}-${o.id}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    add(o.id);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${i === active ? "bg-slate-100 dark:bg-slate-800" : ""}`}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: familyColor(o.family) }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-950 dark:text-white">{o.name}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{FAMILIES[o.family].label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
