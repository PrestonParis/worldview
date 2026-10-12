"use client";

import { useId, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import {
  STATUS_LABEL,
  STATUS_MEANING,
  type DataStatus,
  type YearProvenance,
} from "@/lib/demographics/provenance";

const TONE: Record<DataStatus, string> = {
  reported: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20",
  estimated: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20",
  modeled: "bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/25",
  projected: "bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/20",
};

// A small (i) that reveals an explanation on hover, focus or tap.
export function InfoTip({
  label,
  children,
  align = "left",
}: {
  label: string;
  children: ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      className="relative inline-flex align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="rounded-full p-0.5 text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:text-slate-200"
      >
        <Info size={13} />
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className={`absolute top-full z-40 mt-1.5 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-3 text-left text-xs leading-5 font-normal tracking-normal text-slate-600 normal-case shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}

export function StatusBadge({
  provenance,
  align,
  size = "sm",
}: {
  provenance: YearProvenance;
  align?: "left" | "right";
  size?: "sm" | "xs";
}) {
  const { status, by, detail } = provenance;
  return (
    <span className="inline-flex items-center gap-0.5">
      <span
        className={`inline-flex items-center gap-1 rounded-full font-bold tracking-[0.1em] uppercase ring-1 ring-inset ${TONE[status]} ${
          size === "xs" ? "px-1.5 py-0.5 text-[8px]" : "px-2 py-1 text-[9px]"
        }`}
      >
        {STATUS_LABEL[status]}
        <span className="font-semibold tracking-normal normal-case opacity-75">· {by}</span>
      </span>
      <InfoTip label={`What “${STATUS_LABEL[status]}” means`} align={align}>
        <span className="block font-semibold text-slate-900 dark:text-white">
          {STATUS_LABEL[status]} · {by}
        </span>
        <span className="mt-1 block">{detail}</span>
        <span className="mt-2 block border-t border-slate-100 pt-2 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {STATUS_MEANING[status]}
        </span>
      </InfoTip>
    </span>
  );
}
