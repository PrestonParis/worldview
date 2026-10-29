"use client";

import { useId, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { formatValue } from "@/lib/format";
import { STATES_51 } from "@/lib/geo/states";
import { stateSlug } from "@/lib/states/slug";
import type { StateMeasure } from "@/components/home/state-map";
import { CardHeading, CtaLink, ShowcaseCard, focusRing, metaLine, stage } from "./showcase-ui";

const A_COLOR = "#0891b2"; // cyan-600
const B_COLOR = "#c2410c"; // orange-700

const selectClass = `h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-medium text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-white ${focusRing}`;

const nameOf = (abbr: string) => STATES_51.find((s) => s.abbr === abbr)?.name ?? abbr;
const possessive = (name: string) => (name.endsWith("s") ? `${name}’` : `${name}’s`);
const ordinal = (n: number) => {
  const tail = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${tail}`;
};

// One sentence computed from the two values: how far apart, and where each
// ranks among the states that report the measure.
function takeaway(measure: StateMeasure, a: string, b: string, ranked: string[]): string {
  const va = measure.values[a];
  const vb = measure.values[b];
  if (va == null || vb == null) return `${nameOf(va == null ? a : b)} has no ${measure.label.toLowerCase()} figure for ${measure.period}.`;
  const label = measure.label.charAt(0).toLowerCase() + measure.label.slice(1);
  const [hi, lo, vhi, vlo] = va >= vb ? [a, b, va, vb] : [b, a, vb, va];
  const rank = (abbr: string) => ordinal(ranked.indexOf(abbr) + 1);
  const ranks = `${nameOf(a)} ranks ${rank(a)} and ${nameOf(b)} ${rank(b)} of ${ranked.length}, highest first.`;
  if (vhi === vlo) return `${nameOf(a)} and ${nameOf(b)} have the same ${label}. ${ranks}`;
  const gap =
    measure.unit === "percent"
      ? `${formatValue(vhi - vlo, "per_1000")} percentage points higher`
      : vlo > 0
        ? `${Math.round(((vhi - vlo) / vlo) * 100)}% higher (${formatValue(vhi - vlo, measure.unit, { compact: true })})`
        : `${formatValue(vhi - vlo, measure.unit, { compact: true })} higher`;
  return `${possessive(nameOf(hi))} ${label} is ${gap} than ${possessive(nameOf(lo))}. ${ranks}`;
}

export function IssueViewShowcase({ measures }: { measures: StateMeasure[] }) {
  const id = useId();
  const [metricKey, setMetricKey] = useState(measures[0].key);
  const [a, setA] = useState("CA");
  const [b, setB] = useState("TX");
  const measure = measures.find((m) => m.key === metricKey) ?? measures[0];
  const reported = STATES_51.filter((s) => measure.values[s.abbr] != null);
  const ranked = [...reported].sort((x, y) => measure.values[y.abbr]! - measure.values[x.abbr]!).map((s) => s.abbr);
  const values = reported.map((s) => measure.values[s.abbr]!);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pct = (v: number) => Number((((v - min) / (max - min || 1)) * 100).toFixed(2));
  const compareHref = measure.key.includes(":") ? measure.href : "/issueview/compare";

  return (
    <ShowcaseCard>
      <CardHeading tool="issueview" title="How different are two places?">
        Put any two states side by side on any published measure, and see where each ranks against the rest of the country.
      </CardHeading>

      <div className={`mt-5 p-4 ${stage}`}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
          <label className="min-w-0">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
              <span className="size-2 rounded-full" style={{ backgroundColor: A_COLOR }} aria-hidden />First state
            </span>
            <select value={a} onChange={(e) => setA(e.target.value)} className={selectClass}>
              {STATES_51.map((s) => <option key={s.abbr} value={s.abbr}>{s.name}</option>)}
            </select>
          </label>
          <button
            type="button"
            onClick={() => { setA(b); setB(a); }}
            aria-label="Swap states"
            className={`mb-1 flex size-8 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white ${focusRing}`}
          >
            <ArrowLeftRight size={15} aria-hidden />
          </button>
          <label className="min-w-0">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
              <span className="size-2 rounded-full" style={{ backgroundColor: B_COLOR }} aria-hidden />Second state
            </span>
            <select value={b} onChange={(e) => setB(e.target.value)} className={selectClass}>
              {STATES_51.map((s) => <option key={s.abbr} value={s.abbr}>{s.name}</option>)}
            </select>
          </label>
        </div>
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Measure</span>
          <select value={measure.key} onChange={(e) => setMetricKey(e.target.value)} className={selectClass}>
            {measures.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </label>

        <dl className="mt-4 grid grid-cols-2 gap-3">
          {[[a, A_COLOR], [b, B_COLOR]].map(([abbr, color]) => (
            <div key={`${abbr}-${color}`} className="rounded-lg bg-white px-3 py-2.5 ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800">
              <dt className="flex items-center gap-1.5 truncate text-xs font-medium text-slate-600 dark:text-slate-400">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />{nameOf(abbr)}
              </dt>
              <dd className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-950 tabular-nums dark:text-white">
                {formatValue(measure.values[abbr], measure.unit, { compact: measure.unit === "usd" && (measure.values[abbr] ?? 0) >= 1_000_000 })}
              </dd>
            </div>
          ))}
        </dl>

        <figure className="mt-4" aria-labelledby={`${id}-strip`}>
          <div className="relative h-9" role="img" aria-label={`${measure.label} for ${reported.length} states, from ${formatValue(min, measure.unit)} to ${formatValue(max, measure.unit)}`}>
            <div className="absolute inset-x-0 top-1/2 h-px bg-slate-300 dark:bg-slate-700" />
            {reported.map((s) => {
              const v = measure.values[s.abbr]!;
              const isA = s.abbr === a;
              const isB = s.abbr === b;
              if (isA || isB) return null;
              return <span key={s.abbr} title={`${s.name}: ${formatValue(v, measure.unit)}`} className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400/60 dark:bg-slate-500/60" style={{ left: `${pct(v)}%` }} />;
            })}
            {[[a, A_COLOR], [b, B_COLOR]].map(([abbr, color]) => {
              const v = measure.values[abbr];
              if (v == null) return null;
              return (
                <span key={`${abbr}-${color}`} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-300" style={{ left: `${pct(v)}%` }}>
                  <span className="block size-3.5 rounded-full ring-2 ring-white dark:ring-slate-950" style={{ backgroundColor: color }} />
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-bold" style={{ color }}>{abbr}</span>
                </span>
              );
            })}
          </div>
          <figcaption id={`${id}-strip`} className="mt-0.5 flex justify-between text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
            <span>Lowest {formatValue(min, measure.unit, { compact: true })}</span>
            <span>All {reported.length} reporting states</span>
            <span>Highest {formatValue(max, measure.unit, { compact: true })}</span>
          </figcaption>
        </figure>

        <p className="mt-4 text-sm leading-6 text-slate-800 dark:text-slate-200" aria-live="polite">{takeaway(measure, a, b, ranked)}</p>
        <p className={`mt-1 ${metaLine}`}>
          Source: {measure.source} · {measure.period} · observed values, state level
        </p>
      </div>

      <table className="mt-4 w-full text-sm">
        <caption className="mb-1.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          {nameOf(a)} and {nameOf(b)} on every measure
        </caption>
        <thead className="sr-only">
          <tr><th scope="col">Measure</th><th scope="col">{nameOf(a)}</th><th scope="col">{nameOf(b)}</th></tr>
        </thead>
        <tbody>
          {measures.map((m) => {
            const va = m.values[a];
            const vb = m.values[b];
            const lead = va != null && vb != null && va !== vb ? (va > vb ? "a" : "b") : null;
            const cell = (v: number | null | undefined, side: "a" | "b") => (
              <td className={`py-1.5 pl-2 text-right tabular-nums ${lead === side ? "font-semibold text-slate-950 dark:text-white" : "text-slate-600 dark:text-slate-400"}`}>
                {formatValue(v, m.unit, { compact: true })}
              </td>
            );
            return (
              <tr key={m.key} className="border-t border-slate-200 dark:border-slate-800">
                <th scope="row" className="py-1.5 text-left font-normal">
                  <button
                    type="button"
                    onClick={() => setMetricKey(m.key)}
                    aria-pressed={m.key === measure.key}
                    className={`text-left hover:text-blue-700 dark:hover:text-blue-300 ${focusRing} ${m.key === measure.key ? "font-semibold text-slate-950 dark:text-white" : "text-slate-700 dark:text-slate-300"}`}
                  >
                    {m.label}
                  </button>
                </th>
                {cell(va, "a")}
                {cell(vb, "b")}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        <CtaLink href={compareHref} primary>Compare Places</CtaLink>
        <CtaLink href={`/states/${stateSlug(nameOf(a))}`}>{nameOf(a)} profile</CtaLink>
      </div>
    </ShowcaseCard>
  );
}
