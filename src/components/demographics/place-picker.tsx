"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";

export interface PlaceOption {
  id: string;
  name: string;
  short?: string;
  disabled?: boolean;
}

export function PlacePicker({
  id,
  label,
  value,
  placeholder,
  clearLabel,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  clearLabel?: string;
  options: PlaceOption[];
  onChange: (value: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const selected = options.find((option) => option.id === value);
  const matches = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return options.filter((option) => !term || `${option.name} ${option.short ?? ""}`.toLocaleLowerCase().includes(term));
  }, [options, query]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => input.current?.focus());
  }, [open]);

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div ref={root} className="relative z-30">
      <button
        id={id}
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={`${id}-options`}
        onClick={() =>
          setOpen((current) => {
            if (!current) {
              setQuery("");
              setActive(Math.max(0, options.findIndex((option) => option.id === value)));
            }
            return !current;
          })
        }
        className="flex h-8 w-44 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-900"
      >
        <span className="truncate">{selected?.name ?? placeholder}</span>
        <ChevronsUpDown size={13} className="shrink-0 text-slate-400" aria-hidden="true" />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-950/15 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40">
          <label className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 dark:bg-slate-800">
            <Search size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
            <span className="sr-only">Search {label.toLowerCase()}</span>
            <input
              ref={input}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActive((current) => Math.min(current + 1, matches.length - 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActive((current) => Math.max(current - 1, 0));
                } else if (event.key === "Enter" && matches[active] && !matches[active].disabled) {
                  event.preventDefault();
                  choose(matches[active].id);
                } else if (event.key === "Escape") {
                  setOpen(false);
                }
              }}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="h-10 min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400 dark:text-white"
            />
          </label>

          <div id={`${id}-options`} role="listbox" aria-label={label} className="mt-2 max-h-72 overflow-y-auto">
            {clearLabel && value ? (
              <button
                type="button"
                role="option"
                aria-selected="false"
                onClick={() => choose("")}
                className="mb-1 flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10"
              >
                {clearLabel}
              </button>
            ) : null}
            {matches.length ? (
              matches.map((option, index) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={option.id === value}
                  disabled={option.disabled}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    index === active
                      ? "bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-white"
                      : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{option.name}</span>
                  {option.short ? <span className="text-[10px] font-semibold text-slate-400">{option.short}</span> : null}
                  {option.id === value ? <Check size={14} className="shrink-0 text-blue-600" aria-hidden="true" /> : null}
                </button>
              ))
            ) : (
              <p className="px-3 py-6 text-center text-sm text-slate-500">No matches</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
