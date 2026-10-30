"use client";

import { Fragment, useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { SourceLines } from "@/components/charts/chart-card";
import {
  EVIDENCE_ROWS,
  EVIDENCE_SOURCE,
  OUTCOMES,
  OUTCOME_GROUPS,
  RATINGS,
  RATING_NOTES,
  STRENGTHS,
  parseRating,
  type EvidenceRowId,
  type OutcomeId,
  type StudyEstimate,
} from "@/lib/guns/evidence";
import { RatingPill } from "./policy-explorer";
import { useGunSelection } from "./selection";

let studiesPromise: Promise<StudyEstimate[]> | null = null;
const loadStudies = () =>
  (studiesPromise ??= fetch("/data/guns/studies.json").then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }));

const QUALITY: Record<StudyEstimate["quality"], { label: string; tone: string }> = {
  "HIGH QUALITY": { label: "High quality", tone: "var(--evidence-S)" },
  MINOR: { label: "Minor concerns", tone: "var(--evidence-M)" },
  SERIOUS: { label: "Serious concerns", tone: "var(--viz-muted)" },
  CRITICAL: { label: "Critical concerns", tone: "var(--viz-empty)" },
};

// RAND's policy × outcome grid. Each cell is the strongest rating RAND gave
// the pair (arrow = direction of the effect); selecting it opens the ratings,
// RAND's footnote, and the study-level estimates behind them.
export function EvidenceMatrix() {
  const sel = useGunSelection();
  const row = EVIDENCE_ROWS.find((r) => r.id === sel.row) ?? null;
  const outcome = OUTCOMES.find((o) => o.id === sel.outcome) ?? null;

  return (
    <div className="space-y-5">
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600 dark:text-slate-300" aria-label="Legend">
        {STRENGTHS.map((s) => (
          <li key={s.id} className="flex items-center gap-1.5" title={s.definition}>
            <span className="size-3 rounded-sm ring-1 ring-slate-300 dark:ring-slate-700" style={{ background: `var(--evidence-${s.id})` }} aria-hidden />
            {s.label}
          </li>
        ))}
        <li className="flex items-center gap-1">
          <ArrowDown className="size-3" aria-hidden /> decreases
        </li>
        <li className="flex items-center gap-1">
          <ArrowUp className="size-3" aria-hidden /> increases
        </li>
        <li className="text-slate-400">Blank: no qualifying study</li>
      </ul>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[980px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white dark:bg-slate-950" />
              {OUTCOME_GROUPS.map((g) => (
                <th
                  key={g}
                  colSpan={OUTCOMES.filter((o) => o.group === g).length}
                  className="border-b border-l border-slate-200 px-2 pt-3 pb-1 text-left font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200"
                >
                  {g}
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-semibold text-slate-500 dark:bg-slate-950">Policy</th>
              {OUTCOMES.map((o, i) => (
                <th
                  key={o.id}
                  scope="col"
                  className={`h-24 w-10 px-1 pb-2 align-bottom font-normal text-slate-500 dark:text-slate-400 ${
                    i === 0 || OUTCOMES[i - 1].group !== o.group ? "border-l border-slate-200 dark:border-slate-800" : ""
                  }`}
                >
                  <span className="inline-block max-h-24 [writing-mode:vertical-rl] rotate-180 text-left leading-3">{o.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EVIDENCE_ROWS.map((r) => (
              <tr key={r.id} className={r.id === row?.id ? "bg-slate-50 dark:bg-slate-900/60" : ""}>
                <th
                  scope="row"
                  className={`sticky left-0 z-10 px-3 py-1 text-left font-medium whitespace-nowrap text-slate-800 dark:text-slate-200 ${
                    r.id === row?.id ? "bg-slate-50 dark:bg-slate-900" : "bg-white dark:bg-slate-950"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => sel.set({ row: r.id, outcome: null })}
                    className="text-left hover:underline"
                  >
                    {r.label}
                  </button>
                </th>
                {OUTCOMES.map((o, i) => {
                  const ratings = RATINGS[r.id][o.id];
                  const on = r.id === row?.id && o.id === outcome?.id;
                  const top = ratings ? parseRating(ratings[0]) : null;
                  const Arrow = top?.direction === "decrease" ? ArrowDown : top?.direction === "increase" ? ArrowUp : null;
                  return (
                    <td
                      key={o.id}
                      className={`p-0.5 text-center ${i === 0 || OUTCOMES[i - 1].group !== o.group ? "border-l border-slate-200 dark:border-slate-800" : ""}`}
                    >
                      {top && (
                        <button
                          type="button"
                          onClick={() => sel.set({ row: r.id, outcome: on ? null : o.id })}
                          aria-pressed={on}
                          aria-label={`${r.label}, ${o.label}: ${ratings!
                            .map((x) => {
                              const p = parseRating(x);
                              return `${STRENGTHS.find((s) => s.id === p.strength)!.label}${p.direction ? ` ${p.direction}` : ""}`;
                            })
                            .join(", ")}`}
                          className={`relative flex h-7 w-full min-w-8 items-center justify-center gap-0.5 rounded font-semibold ${
                            on ? "ring-2 ring-slate-900 dark:ring-white" : ""
                          }`}
                          style={{ background: `var(--evidence-${top.strength})`, color: `var(--evidence-ink-${top.strength})` }}
                        >
                          {Arrow && <Arrow className="size-3" aria-hidden />}
                          {top.strength}
                          {ratings!.length > 1 && <span className="absolute top-0 right-0.5 text-[9px] opacity-80">+{ratings!.length - 1}</span>}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SourceLines sources={[EVIDENCE_SOURCE]} />

      {row && <CellDetail rowId={row.id} outcomeId={outcome?.id ?? null} />}
    </div>
  );
}

function CellDetail({ rowId, outcomeId }: { rowId: EvidenceRowId; outcomeId: OutcomeId | null }) {
  const row = EVIDENCE_ROWS.find((r) => r.id === rowId)!;
  const outcome = OUTCOMES.find((o) => o.id === outcomeId) ?? null;
  const [studies, setStudies] = useState<StudyEstimate[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    loadStudies().then(setStudies, () => setFailed(true));
  }, []);

  const ratings = outcome ? (RATINGS[rowId][outcome.id] ?? []) : [];
  const note = outcome ? RATING_NOTES[`${rowId}.${outcome.id}`] : undefined;
  const codes = row.codes as readonly string[];
  const estimates = (studies ?? []).filter((s) => codes.includes(s.code) && (!outcome || s.outcome === outcome.study));
  const rated = OUTCOMES.filter((o) => RATINGS[rowId][o.id]);

  return (
    <section className="space-y-4 rounded-2xl bg-slate-50 p-5 dark:bg-slate-900/60" aria-live="polite">
      <div>
        <p className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">{row.label}</p>
        <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
          {outcome ? outcome.label : "Every outcome RAND rated"}
        </h3>
      </div>
      {outcome ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {ratings.map((r, i) => {
              const p = parseRating(r);
              return <RatingPill key={i} strength={p.strength} direction={p.direction} />;
            })}
          </div>
          {note && <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{note}</p>}
          <p className="max-w-3xl text-xs leading-5 text-slate-500 dark:text-slate-400">
            {ratings.map((r) => STRENGTHS.find((s) => s.id === parseRating(r).strength)!).map((s) => `${s.label}: ${s.definition}`).filter((v, i, a) => a.indexOf(v) === i).join(" ")}
          </p>
        </div>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {rated.flatMap((o) =>
            RATINGS[rowId][o.id]!.map((r, i) => {
              const p = parseRating(r);
              return (
                <li key={`${o.id}-${i}`}>
                  <RatingPill strength={p.strength} direction={p.direction} label={o.label} />
                </li>
              );
            }),
          )}
          {rated.length === 0 && <li className="text-sm text-slate-500">No study met RAND&apos;s inclusion criteria.</li>}
        </ul>
      )}

      {codes.length > 0 && (
        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Study estimates{outcome ? ` · ${outcome.study.toLowerCase()} outcomes` : ""}
          </p>
          {failed ? (
            <p className="mt-2 text-sm text-slate-500">The study estimates could not be loaded.</p>
          ) : !studies ? (
            <p className="mt-2 text-sm text-slate-400">Loading estimates…</p>
          ) : estimates.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">RAND plotted no effect estimates for this pair.</p>
          ) : (
            <ForestPlot estimates={estimates} />
          )}
        </div>
      )}
    </section>
  );
}

// Incidence rate ratios on a log axis: 1 is no change, left of it a decrease.
function ForestPlot({ estimates }: { estimates: StudyEstimate[] }) {
  const [all, setAll] = useState(false);
  const LIMIT = 30;
  const sorted = [...estimates].sort(
    (a, b) => a.outcome.localeCompare(b.outcome) || a.measure.localeCompare(b.measure) || a.study.localeCompare(b.study),
  );
  const shown = all ? sorted : sorted.slice(0, LIMIT);
  const MIN = 0.25;
  const MAX = 4;
  const W = 340;
  const ROW = 22;
  const x = (v: number) => ((Math.log(Math.min(MAX, Math.max(MIN, v))) - Math.log(MIN)) / (Math.log(MAX) - Math.log(MIN))) * W;
  const ticks = [0.25, 0.5, 1, 2, 4];

  return (
    <div className="mt-2 space-y-2">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500" aria-label="Study quality">
        {Object.values(QUALITY).map((q) => (
          <li key={q.label} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full ring-1 ring-slate-400" style={{ background: q.tone }} aria-hidden />
            {q.label}
          </li>
        ))}
      </ul>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr className="text-slate-400">
              <th className="py-1 text-left font-normal">Study · outcome · group</th>
              <th className="w-[360px] py-1 font-normal">
                <svg viewBox={`-10 0 ${W + 20} 14`} className="block w-full" aria-hidden>
                  {ticks.map((t) => (
                    <text key={t} x={x(t)} y={10} textAnchor="middle" className="fill-slate-400 text-[9px]">
                      {t}
                    </text>
                  ))}
                </svg>
              </th>
              <th className="w-36 py-1 text-right font-normal whitespace-nowrap">IRR (95% CI)</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s, i) => {
              const group = (e: StudyEstimate) => `${e.outcome} · ${e.measure}`;
              const header = i === 0 || group(shown[i - 1]) !== group(s);
              const q = QUALITY[s.quality] ?? QUALITY.SERIOUS;
              return (
                <Fragment key={s.id}>
                  {header && (
                    <tr>
                      <td colSpan={3} className="pt-2 pb-0.5 font-semibold text-slate-600 dark:text-slate-300">
                        {s.measure || s.outcome.toLowerCase()}
                      </td>
                    </tr>
                  )}
                  <tr className="border-t border-slate-200/70 dark:border-slate-800/70" title={`${s.policy} · ${q.label}`}>
                    <td className="py-0.5 pr-2 text-slate-700 dark:text-slate-200">
                      {s.study}
                      {s.subgroup && <span className="text-slate-400"> · {s.subgroup}</span>}
                    </td>
                    <td className="py-0.5">
                      <svg viewBox={`-10 0 ${W + 20} ${ROW}`} className="block w-full" role="img" aria-label={`${s.study}: ${s.irr.toFixed(2)}`}>
                        <line x1={x(1)} x2={x(1)} y1={0} y2={ROW} stroke="var(--viz-muted)" strokeDasharray="2 2" />
                        <line x1={x(s.lo)} x2={x(s.hi)} y1={ROW / 2} y2={ROW / 2} stroke="currentColor" className="text-slate-500" strokeWidth={1.5} />
                        <circle cx={x(s.irr)} cy={ROW / 2} r={4.5} fill={q.tone} stroke="currentColor" className="text-slate-600 dark:text-slate-300" />
                      </svg>
                    </td>
                    <td className="py-0.5 pl-2 text-right whitespace-nowrap text-slate-600 tabular-nums dark:text-slate-300">
                      {s.irr.toFixed(2)} ({s.lo.toFixed(2)}–{s.hi.toFixed(2)})
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Incidence rate ratio: 1 means no change; 0.8 is a 20% decrease. Axis clipped at 0.25 and 4.
        {sorted.length > LIMIT && (
          <button type="button" onClick={() => setAll(!all)} className="ml-2 text-red-700 hover:underline dark:text-red-400">
            {all ? "Show fewer" : `Show all ${sorted.length}`}
          </button>
        )}
      </p>
    </div>
  );
}
