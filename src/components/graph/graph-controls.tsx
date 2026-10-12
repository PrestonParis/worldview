"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";

// Compact toolbar pieces for the People graph: a segmented switch and a
// popover menu, so a dozen filters fit on one row instead of stacking up
// as chip rows above the canvas.

export function Segmented<T extends string | null>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; dot?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex h-9 items-center rounded-lg border border-slate-200 p-0.5 text-sm dark:border-slate-800">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`flex h-full items-center gap-1.5 rounded-md px-3 font-medium transition-colors ${
              active
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            }`}
          >
            {o.dot ? <span className="h-2 w-2 rounded-full" style={{ background: o.dot }} /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Multi-select sibling of Segmented: each option toggles on its own.
export function ToggleGroup<T extends string>({
  options,
  active,
  onToggle,
}: {
  options: { value: T; label: string; dot?: string; disabled?: boolean }[];
  active: ReadonlySet<T>;
  onToggle: (value: T) => void;
}) {
  return (
    <div className="inline-flex h-9 items-center gap-0.5 rounded-lg border border-slate-200 p-0.5 text-sm dark:border-slate-800">
      {options.map((o) => {
        const on = active.has(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            disabled={o.disabled}
            onClick={() => onToggle(o.value)}
            className={`flex h-full items-center gap-1.5 rounded-md px-2.5 font-medium transition-colors disabled:cursor-not-allowed ${
              on
                ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                : "text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
            }`}
          >
            {o.dot ? (
              <span
                className="h-2 w-2 rounded-full border"
                style={{ borderColor: o.dot, background: on ? o.dot : "transparent" }}
              />
            ) : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Menu({
  label,
  badge,
  align = "left",
  children,
}: {
  label: ReactNode;
  /** Shown as a count pill when filters in this menu are active. */
  badge?: number;
  align?: "left" | "right";
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors ${
          open || badge
            ? "border-slate-400 text-slate-900 dark:border-slate-500 dark:text-slate-100"
            : "border-slate-200 text-slate-600 hover:border-slate-400 dark:border-slate-800 dark:text-slate-300"
        }`}
      >
        {label}
        {badge ? (
          <span className="rounded-full bg-slate-900 px-1.5 text-[11px] leading-5 text-white tabular-nums dark:bg-slate-100 dark:text-slate-900">
            {badge}
          </span>
        ) : null}
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div
          className={`absolute top-full z-20 mt-1.5 min-w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({
  checked,
  onClick,
  dot,
  label,
  hint,
}: {
  checked: boolean;
  onClick: () => void;
  dot?: string;
  label: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {checked ? <Check className="h-3.5 w-3.5" /> : null}
      </span>
      {dot ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} /> : null}
      <span className="flex-1 first-letter:uppercase">{label}</span>
      {hint !== undefined ? <span className="text-xs text-slate-400 tabular-nums">{hint}</span> : null}
    </button>
  );
}

export function MenuFooter({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1 border-t border-slate-100 px-2 pt-1.5 pb-0.5 text-xs text-slate-400 dark:border-slate-800">
      {children}
    </div>
  );
}
