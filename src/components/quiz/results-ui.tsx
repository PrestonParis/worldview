// Layout primitives and tokens for the quiz results page. No hooks, so both
// server and client components can use them.

import type { ReactNode } from "react";
import { FAMILIES, familyColor } from "@/lib/quiz/families";
import type { Confidence } from "@/lib/quiz/results";
import type { IdeologyFamily } from "@/lib/quiz/types";

// Sections clear the sticky site header (3.5rem) and, below lg, the sticky
// section bar under it.
export const sectionCard =
  "scroll-mt-32 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 lg:scroll-mt-20 dark:border-slate-800 dark:bg-slate-950";
export const kicker = "text-sm font-medium text-slate-600 dark:text-slate-400";
export const h2 = "text-2xl leading-tight font-semibold tracking-tight text-slate-950 dark:text-white";
export const body = "text-base leading-7 text-slate-700 dark:text-slate-300";
export const meta = "text-sm text-slate-600 dark:text-slate-400";
export const small = "text-xs text-slate-600 dark:text-slate-400";

// Primary, secondary and tertiary actions. 40px tall for touch.
export const btnPrimary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200";
export const btnSecondary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:border-slate-500 hover:text-slate-950 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:text-white";
export const btnTertiary =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-950/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white";
export const textLink =
  "font-semibold text-slate-950 underline decoration-slate-300 underline-offset-4 hover:decoration-current dark:text-white dark:decoration-slate-600";

export function Section({ id, className = "", children }: { id: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} className={`${sectionCard} ${className}`}>
      {children}
    </section>
  );
}

export function SectionHeader({
  kicker: k,
  title,
  description,
  actions,
}: {
  kicker?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 max-w-3xl">
        {k && <p className={kicker}>{k}</p>}
        <h2 className={`${h2} mt-0.5 text-balance`}>{title}</h2>
        {description && <p className={`mt-1.5 ${meta}`}>{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function FamilyChip({ family }: { family: IdeologyFamily }) {
  const color = familyColor(family);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-slate-800 dark:text-slate-100"
      style={{ backgroundColor: `${color}1f` }}
    >
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {FAMILIES[family].label}
    </span>
  );
}

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

// Three rising bars, filled to the confidence level.
export function ConfidenceMeter({ level, withLabel = false }: { level: Confidence; withLabel?: boolean }) {
  const filled = { high: 3, medium: 2, low: 1 }[level];
  const tone = { high: "bg-slate-700 dark:bg-slate-300", medium: "bg-amber-500", low: "bg-rose-500" }[level];
  return (
    <span className="inline-flex items-center gap-1.5" title={CONFIDENCE_LABEL[level]}>
      <span className="inline-flex items-end gap-0.5" aria-hidden>
        {["h-1.5", "h-2.5", "h-3.5"].map((h, i) => (
          <span key={h} className={`w-1 rounded-sm ${h} ${i < filled ? tone : "bg-slate-200 dark:bg-slate-700"}`} />
        ))}
      </span>
      {withLabel ? <span className={small}>{CONFIDENCE_LABEL[level]}</span> : <span className="sr-only">{CONFIDENCE_LABEL[level]}</span>}
    </span>
  );
}

