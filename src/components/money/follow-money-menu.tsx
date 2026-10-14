"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

export interface FollowOption {
  href: string;
  name: string;
  /** Short party tag, e.g. "D". */
  party: string;
  color: string;
  raised: string;
}

// "Follow the money" for a race: the reader picks whose money to follow
// instead of the link choosing a candidate (and so a party) for them.
export function FollowMoneyMenu({ label, options, className }: { label: string; options: FollowOption[]; className: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (options.length === 0) return null;
  if (options.length === 1) return <Link href={options[0].href} className={className}>{label}</Link>;

  return (
    <div ref={ref} className="relative inline-block">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={`inline-flex items-center gap-1 ${className}`}>
        {label.replace(/\s*→$/, "")}
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left text-sm shadow-lg dark:border-slate-700 dark:bg-slate-950">
          <p className="px-3 pb-1 pt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Whose money?</p>
          {options.map((option) => (
            <Link
              key={option.href}
              href={option.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-900"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: option.color }} />
              <span className="min-w-0 flex-1 truncate font-medium">{option.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-slate-500">{option.party} · {option.raised}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
