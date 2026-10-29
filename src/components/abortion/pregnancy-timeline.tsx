"use client";

import { useRef } from "react";
import { DEVELOPMENT_MILESTONES, GESTATION_SOURCES, MEDICAL_CONTEXT, TRIMESTERS } from "@/lib/abortion/gestation";

export type IncidenceBin = {
  label: string;
  startWeek: number;
  endWeek: number;
  value: number;
  metric: string;
};

export type TimelineState = {
  abbr: string;
  name: string;
  category: number | null;
  limitWeeks: number | null;
  detail: string | null;
};

const WEEKS = 40;
const FDA_WEEKS = 10;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const pos = (week: number) => `${(clamp(week, 0, WEEKS) / WEEKS) * 100}%`;
const span = (start: number, end: number) => `${((Math.min(end, WEEKS) - start) / WEEKS) * 100}%`;

type Law =
  | { kind: "ban" | "none" | "unknown"; label: string; tone: string; detail: string }
  | { kind: "limit" | "marker"; weeks: number; label: string; tone: string; detail: string };

const RESTRICTED = "text-rose-700 dark:text-rose-300";
const ALLOWED = "text-emerald-700 dark:text-emerald-300";
const MIXED = "text-amber-700 dark:text-amber-300";

// How the selected state's recorded limit reads at a given week. Viability,
// third-trimester and fertilization-dated rules are placed on the axis but
// not treated as a fixed LMP week.
export function lawAt(state: TimelineState | undefined, week: number): Law {
  if (!state) return { kind: "unknown", label: "No state selected", tone: "text-slate-500", detail: "" };
  const detail = (state.detail ?? "").replace(/\.?$/, state.detail ? "." : "");
  if (state.category === 1 || state.limitWeeks === 0) return { kind: "ban", label: "Banned at every week", tone: RESTRICTED, detail };
  if (state.category === 5) return { kind: "none", label: "No gestational limit", tone: ALLOWED, detail };
  if (state.limitWeeks === null) return { kind: "unknown", label: "No week recorded", tone: "text-slate-500", detail };
  if (/viability|third trimester/i.test(detail)) {
    const rule = /viability/i.test(detail) ? "viability" : "the third trimester";
    return { kind: "marker", weeks: state.limitWeeks, label: `Banned after ${rule}`, tone: MIXED, detail: `${detail} Shown at week ${state.limitWeeks}; the law sets no fixed week.` };
  }
  if (/since fertilization|commencement of pregnancy/i.test(detail)) {
    return { kind: "marker", weeks: state.limitWeeks, label: `Limit counted from ${/fertilization/i.test(detail) ? "fertilization" : "conception"}`, tone: MIXED, detail: `${detail} Plotted as recorded, not shifted to the LMP axis.` };
  }
  const restricted = week >= state.limitWeeks;
  return { kind: "limit", weeks: state.limitWeeks, label: restricted ? `Banned from week ${state.limitWeeks}` : `Allowed until week ${state.limitWeeks}`, tone: restricted ? RESTRICTED : ALLOWED, detail };
}

function SourceLink({ id }: { id: string }) {
  const source = GESTATION_SOURCES.find((s) => s.id === id);
  return source ? <a href={source.href} className="mt-3 inline-block text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:decoration-slate-600 dark:hover:text-white">{source.publisher}</a> : null;
}

function Rule({ week, label, className, dashed = false, align = "left" }: { week: number; label: string; className: string; dashed?: boolean; align?: "left" | "right" }) {
  return (
    <div className="pointer-events-none absolute inset-y-0" style={{ left: pos(week) }} aria-hidden>
      <div className={`absolute inset-y-0 -translate-x-1/2 border-l-2 ${dashed ? "border-dashed" : ""} ${className}`} />
      <span className={`absolute top-1 whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold dark:bg-slate-950/90 ${align === "left" ? "left-1.5" : "right-1.5"} ${className.replace(/border-\S+/g, "")}`}>{label}</span>
    </div>
  );
}

// One 0–40 week axis (weeks since the last menstrual period). The curve is the
// cumulative share of abortions by the end of each CDC interval; the selected
// state's limit is drawn over it; development stages run along the bottom.
export function PregnancyTimeline({
  bins,
  cdcYear,
  week,
  onWeek,
  state,
  lawPeriod,
}: {
  bins: IncidenceBin[];
  cdcYear: string | null;
  week: number;
  onWeek: (week: number) => void;
  state: TimelineState | undefined;
  lawPeriod: string | null;
}) {
  const plot = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const cumulative = bins.map((bin, i) => ({ ...bin, cum: bins.slice(0, i + 1).reduce((sum, b) => sum + b.value, 0), end: Math.min(bin.endWeek + 1, WEEKS) }));
  const total = cumulative.at(-1)?.cum || 100;
  const points = [{ end: 0, cum: 0 }, ...cumulative].map((p) => [p.end, 100 - (p.cum / total) * 100] as const);
  const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  const area = `${line} L${WEEKS},100 L0,100 Z`;

  const bin = cumulative.find((b) => week >= b.startWeek && week <= b.endWeek);
  const stage = DEVELOPMENT_MILESTONES.find((m) => week >= m.startWeek && week <= m.endWeek);
  const medical = MEDICAL_CONTEXT.filter((m) => week >= m.startWeek && week <= m.endWeek);
  const law = lawAt(state, week);
  const trimester = TRIMESTERS.find((t) => week >= t.startWeek && week <= t.endWeek);

  const weekAt = (clientX: number) => {
    const rect = plot.current?.getBoundingClientRect();
    if (!rect) return week;
    return clamp(Math.round(((clientX - rect.left) / rect.width) * WEEKS), 0, WEEKS);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">When abortions happen, by week of pregnancy</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Cumulative share of abortions · CDC {cdcYear ?? ""}</p>
        </div>

        <div className="mt-5 pl-9">
          <div className="relative h-6 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {TRIMESTERS.map((t) => (
              <div key={t.label} className={`absolute inset-y-0 flex items-center justify-center border-x border-white dark:border-slate-950 ${t === trimester ? "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white" : "bg-slate-100 dark:bg-slate-900"}`} style={{ left: pos(t.startWeek), width: span(t.startWeek, t.endWeek + 1) }}>
                <span className="truncate px-1"><span className="sm:hidden">{t.label.split(" ")[0]}</span><span className="hidden sm:inline">{t.label}</span></span>
              </div>
            ))}
          </div>

          <div
            ref={plot}
            className="relative mt-2 h-60 cursor-ew-resize touch-none select-none"
            onPointerDown={(e) => {
              dragging.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              onWeek(weekAt(e.clientX));
            }}
            onPointerMove={(e) => dragging.current && onWeek(weekAt(e.clientX))}
            onPointerUp={() => (dragging.current = false)}
            onPointerCancel={() => (dragging.current = false)}
          >
            {[0, 25, 50, 75, 100].map((v) => (
              <div key={v} className="pointer-events-none absolute inset-x-0 border-t border-slate-100 dark:border-slate-800" style={{ top: `${100 - v}%` }}>
                <span className="absolute -left-9 -translate-y-1/2 text-[11px] tabular-nums text-slate-400">{v}%</span>
              </div>
            ))}

            {law.kind === "ban" && <div className="absolute inset-0 bg-rose-500/10" aria-hidden />}
            {law.kind === "limit" && <div className="absolute inset-y-0 right-0 bg-rose-500/10" style={{ left: pos(law.weeks) }} aria-hidden />}

            <svg viewBox={`0 0 ${WEEKS} 100`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
              <path d={area} fill="var(--viz-series-1)" opacity={0.14} />
              <path d={line} fill="none" stroke="var(--viz-series-1)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            </svg>

            {cumulative.map((b) => (
              <span
                key={b.metric}
                className={`pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white dark:border-slate-950 ${b === bin ? "bg-slate-950 dark:bg-white" : "bg-[var(--viz-series-1)]"}`}
                style={{ left: pos(b.end), top: `${100 - (b.cum / total) * 100}%` }}
                aria-hidden
              />
            ))}

            {law.kind === "ban" && <span className={`pointer-events-none absolute right-2 top-8 rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold dark:bg-slate-950/90 ${RESTRICTED}`}>{state?.name}: banned at every week</span>}
            {law.kind === "limit" && <Rule week={law.weeks} label={`${state?.abbr} limit · ${law.weeks} wks`} className={`border-rose-600 ${RESTRICTED}`} align={law.weeks > 30 ? "right" : "left"} />}
            {law.kind === "marker" && <Rule week={law.weeks} label={`${state?.abbr} · ${law.label.replace("Banned after ", "")}`} className={`border-amber-500 ${MIXED}`} dashed align={law.weeks > 30 ? "right" : "left"} />}
            <Rule week={FDA_WEEKS} label="FDA pill limit" className="border-slate-400 text-slate-500 dark:text-slate-400" dashed />

            <div className="pointer-events-none absolute inset-y-0" style={{ left: pos(week) }} aria-hidden>
              <div className="absolute inset-y-0 -translate-x-1/2 border-l-2 border-slate-950 dark:border-white" />
              <span className="absolute bottom-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-950 px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums dark:bg-white dark:text-slate-950">Week {week}</span>
            </div>
          </div>

          <div className="relative mt-1 h-6 text-[11px] tabular-nums text-slate-400">
            {[0, 5, 10, 15, 20, 25, 30, 35, 40].map((w) => <span key={w} className="absolute -translate-x-1/2" style={{ left: pos(w) }}>{w}</span>)}
          </div>

          <div className="relative mt-2 h-8">
            {DEVELOPMENT_MILESTONES.map((m) => {
              const on = m === stage;
              return (
                <button
                  key={m.title}
                  type="button"
                  onClick={() => onWeek(m.startWeek)}
                  title={m.title}
                  className={`absolute inset-y-0 truncate border-x border-white px-1 text-[11px] font-medium dark:border-slate-950 ${on ? "bg-sky-600 text-white" : "bg-sky-50 text-sky-900 hover:bg-sky-100 dark:bg-sky-950/60 dark:text-sky-100 dark:hover:bg-sky-900"}`}
                  style={{ left: pos(m.startWeek), width: span(m.startWeek, m.endWeek + 1) }}
                >
                  {m.short ?? m.title}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Weeks since the last menstrual period · fetal development (ACOG)</p>
        </div>

        <label className="mt-4 block">
          <span className="sr-only">Week of pregnancy</span>
          <input type="range" min={0} max={WEEKS} step={1} value={week} onChange={(e) => onWeek(Number(e.target.value))} className="w-full accent-slate-900 dark:accent-white" />
        </label>
      </div>

      <div aria-live="polite" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Week {week} · {trimester?.label}</p>
          <h4 className="mt-1 font-semibold text-slate-950 dark:text-white">{stage?.title}</h4>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{stage?.detail}</p>
          {stage && <SourceLink id={stage.source} />}
        </article>

        <article className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Abortions by this point</p>
          {bin ? (
            <>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-950 dark:text-white">{Math.round((bin.cum / total) * 1000) / 10}%</p>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">of abortions happen by the end of week {bin.endWeek >= WEEKS ? WEEKS : bin.endWeek}. {bin.value}% happen at {bin.label.toLowerCase()}.</p>
            </>
          ) : <p className="mt-1 text-sm text-slate-500">No CDC interval covers this week.</p>}
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Abortions with a known gestational age, in the areas that reported to CDC continuously since 2013.</p>
          <SourceLink id="cdc-surveillance-2022" />
        </article>

        <article className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{state ? `Law in ${state.name}` : "State law"}</p>
          {state ? (
            <>
              <h4 className={`mt-1 font-semibold ${law.tone}`}>{law.label}</h4>
              {law.detail && <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{law.detail}</p>}
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">As of {lawPeriod ?? "—"}</p>
            </>
          ) : <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Pick a state above to draw its gestational limit on the timeline.</p>}
        </article>

        <article className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Method</p>
          {medical.map((m) => (
            <div key={m.title} className="mt-1">
              <h4 className="font-semibold text-slate-950 dark:text-white">{m.title}</h4>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{m.detail}</p>
              <SourceLink id={m.source} />
            </div>
          ))}
        </article>
      </div>
    </div>
  );
}
