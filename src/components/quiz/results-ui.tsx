// Layout primitives and tokens for the quiz results page. Four surfaces:
// the hero, analytical sections, compact tiles, and slim status strips. No
// hooks, so both server and client components can use them.

import type { ReactNode } from "react";
import { FAMILIES, familyColor } from "@/lib/quiz/families";
import type { Confidence } from "@/lib/quiz/results";
import type { IdeologyFamily } from "@/lib/quiz/types";

// Sections clear the sticky site header (3.5rem) and, below lg, the sticky
// section bar under it.
export const sectionCard =
  "scroll-mt-32 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 lg:scroll-mt-20 dark:border-slate-800 dark:bg-slate-950";
export const tile =
  "block rounded-xl border border-slate-200 p-4 transition-colors hover:border-slate-400 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-900/40";
export const strip =
  "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900/50";

export const kicker = "text-sm font-medium text-slate-600 dark:text-slate-400";
export const h2 = "text-2xl leading-tight font-semibold tracking-tight text-slate-950 dark:text-white";
export const h3 = "text-base font-semibold text-slate-950 dark:text-white";
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

// -1…+1 to a percentage along a track, rounded so server and client styles match.
export const trackPos = (x: number) => `${Number((((Math.max(-1, Math.min(1, x)) + 1) / 2) * 100).toFixed(2))}%`;

// A marker label sits centred over its marker, except near the ends where
// it anchors inward so it never overflows the track.
function labelAnchor(x: number) {
  const p = (x + 1) / 2;
  return p < 0.15 ? "translate-x-0" : p > 0.85 ? "-translate-x-full" : "-translate-x-1/2";
}

// One axis: a fill from the centre to your position, an optional
// uncertainty band, and an optional comparison marker (a diamond). With
// labels, yours sits above the track and the comparison's below, so the two
// never collide however close they are.
export function Track({
  you,
  them,
  band,
  color,
  size = "md",
  youLabel,
  themLabel,
}: {
  you: number;
  them?: number;
  band?: [number, number];
  color: string;
  size?: "sm" | "md";
  youLabel?: string;
  themLabel?: string;
}) {
  const md = size === "md";
  return (
    <div className={`relative ${youLabel ? "pt-5" : ""} ${themLabel ? "pb-5" : ""}`}>
      {youLabel && (
        <span
          className={`absolute top-0 text-xs font-semibold whitespace-nowrap text-slate-900 dark:text-white ${labelAnchor(you)}`}
          style={{ left: trackPos(you) }}
        >
          {youLabel}
        </span>
      )}
      <div className={`relative ${md ? "h-5" : "h-3.5"}`}>
        <div className={`absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full bg-slate-100 dark:bg-slate-800 ${md ? "h-1.5" : "h-1"}`} />
        <div className="absolute top-1/2 left-1/2 h-3 w-px -translate-y-1/2 bg-slate-300 dark:bg-slate-600" />
        {band && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 rounded-full ${md ? "h-4" : "h-3"}`}
            style={{ left: trackPos(band[0]), width: `calc(${trackPos(band[1])} - ${trackPos(band[0])})`, backgroundColor: `${color}2e` }}
          />
        )}
        <div
          className={`absolute top-1/2 -translate-y-1/2 rounded-full ${md ? "h-1.5" : "h-1"}`}
          style={{
            left: you < 0 ? trackPos(you) : "50%",
            right: you < 0 ? "50%" : `calc(100% - ${trackPos(you)})`,
            backgroundColor: color,
          }}
        />
        {them !== undefined && (
          <div
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-slate-600 bg-white dark:border-slate-300 dark:bg-slate-950 ${md ? "size-3" : "size-2.5"}`}
            style={{ left: trackPos(them) }}
          />
        )}
        <div
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm dark:bg-slate-950 ${md ? "size-4 border-[3px]" : "size-3 border-2"}`}
          style={{ left: trackPos(you), borderColor: color }}
        />
      </div>
      {themLabel && them !== undefined && (
        <span
          className={`absolute bottom-0 text-xs whitespace-nowrap text-slate-600 dark:text-slate-400 ${labelAnchor(them)}`}
          style={{ left: trackPos(them) }}
        >
          {themLabel}
        </span>
      )}
    </div>
  );
}

// A track with its two pole labels: beside it from xl up, beneath it on
// phones so the track keeps its full width.
export function LabeledTrack({ negative, positive, children }: { negative: string; positive: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 items-center gap-x-3 gap-y-1 text-xs text-slate-600 xl:grid-cols-[7.5rem_minmax(0,1fr)_7.5rem] dark:text-slate-400">
      <div className="col-span-2 xl:order-2 xl:col-span-1">{children}</div>
      <span className="xl:order-1 xl:text-right">{negative}</span>
      <span className="text-right xl:order-3 xl:text-left">{positive}</span>
    </div>
  );
}

// Legend markers, matching Track.
export function YouMarker({ color }: { color: string }) {
  return <span className="inline-block size-3 rounded-full border-[3px] bg-white dark:bg-slate-950" style={{ borderColor: color }} />;
}
export function ThemMarker() {
  return <span className="inline-block size-2.5 rotate-45 border-2 border-slate-600 bg-white dark:border-slate-300 dark:bg-slate-950" />;
}
