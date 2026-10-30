"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { LimitsMap } from "@/components/abortion/limits-map";
import { SourceLines } from "@/components/charts/chart-card";
import { formatValue } from "@/lib/format";
import type { StatePath } from "@/lib/geo/state-paths";
import { EVIDENCE_ROWS, EVIDENCE_SOURCE, OUTCOMES, RATINGS, STRENGTHS, parseRating } from "@/lib/guns/evidence";
import {
  POLICIES,
  STAGES,
  SUBTYPE_DEFINITIONS,
  covers,
  inForce,
  isFederal,
  policyById,
  type GunPolicy,
  type LawRecord,
  type Stage,
} from "@/lib/guns/policies";
import { useGunSelection } from "./selection";

export interface LawsFile {
  source: { label: string; href: string; through: string };
  /** policy id → state → [category index, year the current regime began, detail] */
  policies: Record<string, Record<string, [number, number | null, string | null]>>;
}

export interface StateOutcomes {
  period: string;
  values: Record<string, { all: number | null; suicide: number | null; homicide: number | null }>;
}

interface StateFile {
  state: string;
  name: string;
  records: LawRecord[];
}

// Spread a policy's categories over the five-step --limit scale so the
// lightest fill always means the least regulation.
const shade = (i: number, n: number) => (n === 1 ? 1 : Math.round(1 + (i * 4) / (n - 1)));
const fmtDate = (d: string | null) =>
  d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : "—";
const year = (d: string | null) => (d ? d.slice(0, 4) : "—");

const stateCache = new Map<string, Promise<StateFile>>();
function loadState(abbr: string) {
  if (!stateCache.has(abbr)) {
    stateCache.set(
      abbr,
      fetch(`/data/guns/states/${abbr}.json`).then((r) => {
        if (!r.ok) throw new Error(`${abbr}: ${r.status}`);
        return r.json() as Promise<StateFile>;
      }),
    );
  }
  return stateCache.get(abbr)!;
}

// The page's centerpiece: pick a stage of the regulatory lifecycle and a
// policy, see every state's rule on the map, then open a state for the
// statutes in force, how they changed, its firearm deaths, and what RAND's
// review found about the policy.
export function PolicyExplorer({
  map,
  laws,
  outcomes,
  stateNames,
}: {
  map: { width: number; height: number; states: StatePath[] };
  laws: LawsFile;
  outcomes: StateOutcomes;
  stateNames: Record<string, string>;
}) {
  const sel = useGunSelection();
  const policy = policyById(sel.policy) ?? POLICIES[0];
  const stage = policy.stage;
  const statuses = laws.policies[policy.id] ?? {};
  const n = policy.categories.length;

  const categories = policy.categories.map((label, i) => ({
    value: shade(i, n),
    label,
    count: Object.values(statuses).filter((s) => s[0] === i).length,
  }));
  const limits = Object.fromEntries(
    Object.entries(statuses).map(([abbr, [cat, since, detail]]) => [
      abbr,
      { category: shade(cat, n), detail: [detail, since && cat !== n - 1 ? `since ${since}` : null].filter(Boolean).join(" · ") || null },
    ]),
  );

  const pickStage = (s: Stage) => sel.set({ policy: POLICIES.find((p) => p.stage === s)!.id });
  const pickState = (abbr: string | null) => sel.set({ state: abbr === sel.state ? null : abbr });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <label className="flex flex-col gap-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Jurisdiction
          <select
            value={sel.state ?? ""}
            onChange={(e) => sel.set({ state: e.target.value || null })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium tracking-normal text-slate-900 normal-case dark:border-slate-800 dark:bg-slate-950 dark:text-white"
          >
            <option value="">United States · 50 states + DC</option>
            {Object.entries(stateNames)
              .sort((a, b) => a[1].localeCompare(b[1]))
              .map(([abbr, name]) => (
                <option key={abbr} value={abbr}>
                  {name}
                </option>
              ))}
          </select>
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Regulatory lifecycle</span>
          <ol className="flex flex-wrap items-center gap-1 text-sm">
            {STAGES.map((s, i) => (
              <li key={s.id} className="flex items-center gap-1">
                <button
                  type="button"
                  aria-pressed={s.id === stage}
                  onClick={() => pickStage(s.id)}
                  title={s.question}
                  className={`rounded-full px-3 py-1 font-medium ${
                    s.id === stage
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "bg-slate-100 text-slate-600 hover:text-slate-950 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
                  }`}
                >
                  <span className="mr-1 font-mono text-[10px] opacity-60">0{i + 1}</span>
                  {s.label}
                </button>
                {i < STAGES.length - 1 && <span aria-hidden className="text-slate-300 dark:text-slate-700">→</span>}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div role="group" aria-label="Policy" className="flex flex-wrap gap-1.5">
        {POLICIES.filter((p) => p.stage === stage).map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.id === policy.id}
            onClick={() => sel.set({ policy: p.id })}
            className={`rounded-lg px-2.5 py-1 text-sm ${
              p.id === policy.id
                ? "bg-red-700 text-white"
                : "text-slate-600 ring-1 ring-slate-200 hover:ring-slate-400 dark:text-slate-300 dark:ring-slate-800 dark:hover:ring-slate-600"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-2">
          <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{policy.question}</h3>
          <LimitsMap
            width={map.width}
            height={map.height}
            states={map.states}
            limits={limits}
            categories={categories}
            selected={sel.state}
            onSelect={pickState}
            label={`Map of state ${policy.label.toLowerCase()} laws`}
            hint="Hover a state for its rule; select it for the statutes."
          />
          <SourceLines sources={[{ label: `${laws.source.label}, laws in force through ${laws.source.through}`, href: laws.source.href }]} />
        </div>
        <LawPanel policy={policy} state={sel.state} name={sel.state ? stateNames[sel.state] : null} statuses={statuses} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <EvidencePanel policy={policy} onOpen={(row) => sel.set({ view: "research", row, outcome: null })} />
        <OutcomePanel state={sel.state} name={sel.state ? stateNames[sel.state] : null} outcomes={outcomes} />
      </div>
    </div>
  );
}

function LawPanel({
  policy,
  state,
  name,
  statuses,
}: {
  policy: GunPolicy;
  state: string | null;
  name: string | null;
  statuses: LawsFile["policies"][string];
}) {
  const [file, setFile] = useState<{ abbr: string; data: StateFile | null; error?: boolean } | null>(null);
  useEffect(() => {
    if (!state) return;
    let live = true;
    loadState(state).then(
      (data) => live && setFile({ abbr: state, data }),
      () => live && setFile({ abbr: state, data: null, error: true }),
    );
    return () => {
      live = false;
    };
  }, [state]);

  const records = useMemo(
    () => (file && file.abbr === state && file.data ? file.data.records.filter((r) => covers(policy, r)) : []),
    [file, state, policy],
  );

  if (!state) {
    const byCat = policy.categories.map((label, i) => ({
      label,
      states: Object.entries(statuses)
        .filter(([, s]) => s[0] === i)
        .map(([abbr]) => abbr)
        .sort(),
    }));
    return (
      <aside className="min-w-0 rounded-2xl bg-slate-50 p-5 dark:bg-slate-900/60">
        <p className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">Law details</p>
        <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{policy.label} across the states</h3>
        <ul className="mt-4 space-y-3">
          {byCat.map((c, i) => (
            <li key={c.label}>
              <p className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                <span className="size-3 rounded-sm" style={{ background: `var(--limit-${shade(i, byCat.length)})` }} aria-hidden />
                {c.label}
                <span className="text-slate-400 tabular-nums">{c.states.length}</span>
              </p>
              <p className="mt-0.5 pl-5 font-mono text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                {c.states.join(" ") || "—"}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Select a state for its statutes, dates, and history.</p>
      </aside>
    );
  }

  const [cat, since, detail] = statuses[state] ?? [policy.categories.length - 1, null, null];
  const current = records.filter((r) => inForce(r) && !isFederal(r));
  const federal = records.filter((r) => inForce(r) && isFederal(r));
  const history = [...records].sort((a, b) => (b.start ?? "").localeCompare(a.start ?? ""));
  const loading = !file || file.abbr !== state;

  return (
    <aside className="min-w-0 space-y-4 rounded-2xl bg-slate-50 p-5 dark:bg-slate-900/60" aria-live="polite">
      <div>
        <p className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">What applies in {name}</p>
        <h3 className="mt-1 flex items-center gap-2 text-lg font-semibold text-slate-950 dark:text-white">
          <span className="size-3.5 rounded-sm" style={{ background: `var(--limit-${shade(cat, policy.categories.length)})` }} aria-hidden />
          {policy.categories[cat]}
        </h3>
        {(detail || since) && (
          <p className="text-sm text-slate-500 dark:text-slate-400">{[detail, since && `in force since ${since}`].filter(Boolean).join(" · ")}</p>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading statutes…</p>
      ) : file.error ? (
        <p className="text-sm text-slate-500">The statute file for {name} could not be loaded.</p>
      ) : (
        <>
          {current.length > 0 ? (
            <ul className="space-y-3">
              {current.map((r) => (
                <RecordCard key={r.id} r={r} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">No state law of this kind is in force in {name}.</p>
          )}
          {federal.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Federal baseline</p>
              <ul className="mt-2 space-y-2">
                {federal.map((r) => (
                  <li key={r.id} className="text-sm text-slate-600 dark:text-slate-300">
                    <span className="font-medium text-slate-900 dark:text-white">{r.citation}</span> · {r.guns}
                    {r.age ? ` · age ${r.age}` : ""} · since {year(r.start)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {history.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">How it changed</p>
              <ol className="mt-2 border-l border-slate-200 pl-4 dark:border-slate-800">
                {history.map((r) => (
                  <li key={r.id} className="relative pb-2.5 text-sm last:pb-0">
                    <span
                      aria-hidden
                      className={`absolute top-1.5 -left-[1.3rem] size-2 rounded-full ${
                        inForce(r) ? "bg-red-700" : "bg-slate-300 dark:bg-slate-700"
                      }`}
                    />
                    <span className="font-mono text-xs text-slate-500">
                      {year(r.start)}–{r.end ? year(r.end) : r.change === "Repeal" ? "" : "now"}
                    </span>{" "}
                    <span className="text-slate-800 dark:text-slate-200">
                      {r.change === "Repeal" ? `Repealed: ${r.subtype}` : r.subtype}
                    </span>
                    <span className="text-slate-400">
                      {" "}
                      · {r.guns} · {r.effect.toLowerCase()}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

function RecordCard({ r }: { r: LawRecord }) {
  const def = SUBTYPE_DEFINITIONS[`${r.cls}:${r.subtype}`];
  return (
    <li className="rounded-xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800">
      <p className="text-sm font-semibold text-slate-950 capitalize dark:text-white">{r.subtype}</p>
      {def && <p className="mt-0.5 text-sm leading-5 text-slate-600 dark:text-slate-300">{def}</p>}
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <dt className="text-slate-400">Statute</dt>
        <dd className="text-slate-800 dark:text-slate-200">{r.citation}</dd>
        <dt className="text-slate-400">Effective</dt>
        <dd className="text-slate-800 dark:text-slate-200">
          {fmtDate(r.start)}
          {r.dateNote ? ` (${r.dateNote.toLowerCase()})` : ""}
        </dd>
        <dt className="text-slate-400">Applies to</dt>
        <dd className="text-slate-800 dark:text-slate-200">
          {r.guns}
          {r.age ? ` · age ${r.age}` : ""}
          {r.wait ? ` · ${r.wait} days` : ""}
        </dd>
      </dl>
      {r.content && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">Statute text</summary>
          <p className="mt-1.5 leading-5 whitespace-pre-line text-slate-600 dark:text-slate-300">{r.content}</p>
          {r.notes && <p className="mt-1.5 leading-5 text-slate-500 dark:text-slate-400">RAND note: {r.notes}</p>}
        </details>
      )}
    </li>
  );
}

function EvidencePanel({ policy, onOpen }: { policy: GunPolicy; onOpen: (row: string) => void }) {
  const rows = EVIDENCE_ROWS.filter((r) => (policy.evidence as string[]).includes(r.id));
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
      <p className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">Evidence</p>
      <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">What does research show?</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">RAND&apos;s review does not rate {policy.label.toLowerCase()}.</p>
      ) : (
        rows.map((row) => {
          const cells = OUTCOMES.flatMap((o) => (RATINGS[row.id][o.id] ?? []).map((r) => ({ o, ...parseRating(r) })));
          const strong = cells.filter((c) => c.strength !== "I");
          const inconclusive = cells.filter((c) => c.strength === "I");
          return (
            <div key={row.id} className="mt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{row.label}</p>
                <button type="button" onClick={() => onOpen(row.id)} className="text-xs text-red-700 hover:underline dark:text-red-400">
                  Studies and estimates →
                </button>
              </div>
              {cells.length === 0 ? (
                <p className="mt-1 text-sm text-slate-500">No study met RAND&apos;s inclusion criteria.</p>
              ) : (
                <>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {strong.map((c, i) => (
                      <li key={i}>
                        <RatingPill strength={c.strength} direction={c.direction} label={c.o.label} />
                      </li>
                    ))}
                  </ul>
                  {inconclusive.length > 0 && (
                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      Inconclusive: {inconclusive.map((c) => c.o.label.toLowerCase()).join(", ")}
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })
      )}
      <SourceLines sources={[EVIDENCE_SOURCE]} />
    </section>
  );
}

export function RatingPill({
  strength,
  direction,
  label,
}: {
  strength: string;
  direction: "decrease" | "increase" | null;
  label?: string;
}) {
  const name = STRENGTHS.find((s) => s.id === strength)?.label ?? strength;
  const Arrow = direction === "decrease" ? ArrowDown : direction === "increase" ? ArrowUp : null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: `var(--evidence-${strength})`, color: `var(--evidence-ink-${strength})` }}
      title={STRENGTHS.find((s) => s.id === strength)?.definition}
    >
      {Arrow && <Arrow className="size-3" aria-label={direction!} />}
      {name}
      {label && <span className="font-normal opacity-80">· {label}</span>}
    </span>
  );
}

function OutcomePanel({ state, name, outcomes }: { state: string | null; name: string | null; outcomes: StateOutcomes }) {
  const v = state ? outcomes.values[state] : null;
  const rows = [
    { label: "All firearm deaths", value: v?.all ?? null },
    { label: "Firearm suicides", value: v?.suicide ?? null },
    { label: "Firearm homicides", value: v?.homicide ?? null },
  ];
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
      <p className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">Outcomes</p>
      <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
        {name ? `Firearm deaths in ${name}` : "Firearm deaths by state"}
      </h3>
      {v ? (
        <>
          <dl className="mt-3 grid grid-cols-3 gap-3">
            {rows.map((r) => (
              <div key={r.label}>
                <dd className="text-2xl font-semibold tracking-tight text-slate-950 tabular-nums dark:text-white">
                  {r.value === null ? "—" : formatValue(r.value, "per_100k")}
                </dd>
                <dt className="text-xs leading-4 text-slate-500 dark:text-slate-400">{r.label}</dt>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-slate-500">Per 100,000 residents · {outcomes.period} · CDC NCHS</p>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <a href={`/crime?offense=homicide&state=${state}`} className="text-red-700 hover:underline dark:text-red-400">
              Homicide in {name} on Crime →
            </a>
            <a href="#outcomes" className="text-slate-600 hover:underline dark:text-slate-300">
              National trends ↓
            </a>
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Select a state for its firearm death rates by intent.</p>
      )}
    </section>
  );
}

