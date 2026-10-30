"use client";

import type { ReactNode } from "react";
import { sideLabels, type GraphSide } from "@/lib/graph/lean";
import { US_STATE_GRID, US_STATE_GRID_COLS, US_STATE_GRID_ROWS, usStateName } from "@/lib/money/us-states";
import { tieBands, type AttributeFacets, type AttributeFacetTotals, type AttributeParams } from "@/lib/people/attributes";
import { FAMILY_FILL } from "@/lib/people/family-colors";
import { roleGroups } from "@/lib/people/public";
import { NOT_RECORDED, bornLabels, generations, raceLabels, religionLabels, sexLabels } from "@/lib/people/traits";

// Facet charts for the attribute explorer. Each mark is a button that
// toggles its filter, so the charts double as the filter controls.

export type SetFilter = (key: keyof AttributeParams, value: string | undefined) => void;

const SIDE_ORDER: GraphSide[] = ["liberal", "uncharacterized", "conservative"];
const SIDE_FILL: Record<GraphSide, string> = {
  liberal: FAMILY_FILL.liberal,
  conservative: FAMILY_FILL.conservative,
  uncharacterized: "var(--viz-muted)",
};
const SEQ = ["var(--viz-seq-1)", "var(--viz-seq-2)", "var(--viz-seq-3)", "var(--viz-seq-4)", "var(--viz-seq-5)", "var(--viz-seq-6)", "var(--viz-seq-7)"];

const fmt = (n: number) => n.toLocaleString("en-US");
const dim = (active: string | undefined, key: string) => (active && active !== key ? "opacity-35" : "");

function Panel({ title, onClear, children }: { title: string; onClear?: () => void; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h3>
        {onClear ? <button type="button" onClick={onClear} className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-950 dark:hover:text-white">Clear</button> : null}
      </div>
      {children}
    </div>
  );
}

function BarList({
  title,
  facet,
  param,
  params,
  set,
  labels,
  limit,
  total,
}: {
  title: string;
  facet: Record<string, number>;
  param: keyof AttributeParams;
  params: AttributeParams;
  set: SetFilter;
  labels?: Record<string, string>;
  limit?: number;
  total?: number;
}) {
  const recorded = Object.entries(facet)
    .filter(([key, n]) => key !== NOT_RECORDED && n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const shown = limit ? recorded.slice(0, limit) : recorded;
  const active = params[param];
  // The active value stays visible even when it falls outside the top list.
  if (active && !shown.some(([key]) => key === active) && active !== NOT_RECORDED) shown.push([active, facet[active] ?? 0]);
  const max = Math.max(1, ...shown.map(([, n]) => n));
  const none = facet[NOT_RECORDED] ?? 0;
  const documented = total === undefined ? undefined : Math.max(0, total - none);
  const toggle = (value: string) => set(param, active === value ? undefined : value);

  return (
    <Panel title={title} onClear={active ? () => set(param, undefined) : undefined}>
      {shown.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">None recorded for these filters.</p>
      ) : (
        <ul className="space-y-1">
          {shown.map(([key, n]) => (
            <li key={key}>
              <button type="button" onClick={() => toggle(key)} aria-pressed={active === key} className={`block w-full rounded-md px-1 py-0.5 text-left hover:bg-slate-50 dark:hover:bg-slate-900 ${dim(active, key)}`}>
                <span className="flex justify-between gap-2 text-sm">
                  <span className={`truncate ${active === key ? "font-semibold" : ""}`}>{labels?.[key] ?? key}</span>
                  <span className="tabular-nums text-slate-500">{fmt(n)}</span>
                </span>
                <span className="mt-0.5 block h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                  <span className="block h-full rounded-full" style={{ width: `${(n / max) * 100}%`, background: "var(--viz-series-1)" }} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {documented !== undefined && total ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Documented for <span className="tabular-nums">{fmt(documented)}</span> of {fmt(total)} ({Math.round((documented / total) * 100)}%)
        </p>
      ) : null}
    </Panel>
  );
}

function Columns({ facet, keys, labels, active, onToggle, height }: {
  facet: Record<string, number>;
  keys: readonly { key: string; label: string }[];
  labels?: boolean;
  active: string | undefined;
  onToggle: (key: string) => void;
  height: string;
}) {
  const max = Math.max(1, ...keys.map((k) => facet[k.key] ?? 0));
  return (
    <>
      <div className={`flex items-end gap-1.5 ${height}`}>
        {keys.map((k) => {
          const n = facet[k.key] ?? 0;
          return (
            <button key={k.key} type="button" onClick={() => onToggle(k.key)} aria-pressed={active === k.key} title={`${k.label}: ${fmt(n)}`} className={`group flex h-full flex-1 flex-col justify-end ${dim(active, k.key)}`}>
              <span className="mb-1 text-center text-[10px] tabular-nums text-slate-500">{fmt(n)}</span>
              <span className="block rounded-t-md group-hover:brightness-110" style={{ height: `${n ? Math.max(3, Math.sqrt(n / max) * 100) : 0}%`, background: "var(--viz-series-1)" }} />
            </button>
          );
        })}
      </div>
      {labels !== false ? (
        <div className="mt-1.5 flex gap-1.5 border-t border-slate-200 pt-1.5 text-[10px] text-slate-500 dark:border-slate-800">
          {keys.map((k) => <span key={k.key} className="flex-1 text-center leading-tight">{k.label}</span>)}
        </div>
      ) : null}
    </>
  );
}

// Who they are: sex, birthplace, race, religion, generation, ancestry.
export function TraitFacets({ facets, facetTotals, params, set }: { facets: AttributeFacets; facetTotals: AttributeFacetTotals; params: AttributeParams; set: SetFilter }) {
  const genNone = facets.gen[NOT_RECORDED] ?? 0;
  const toggleGen = (value: string) => set("gen", params.gen === value ? undefined : value);

  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-7">
        <BarList title="Sex" facet={facets.sex} param="sex" params={params} set={set} labels={sexLabels} total={facetTotals.sex} />
        <BarList title="Birthplace" facet={facets.born} param="born" params={params} set={set} labels={bornLabels} total={facetTotals.born} />
      </div>
      <BarList title="Documented race & ethnicity" facet={facets.race} param="race" params={params} set={set} labels={raceLabels} total={facetTotals.race} />
      <BarList title="Documented religion" facet={facets.religion} param="religion" params={params} set={set} labels={religionLabels} total={facetTotals.religion} />
      <div className="space-y-7">
        <Panel title="Generation" onClear={params.gen ? () => set("gen", undefined) : undefined}>
          <Columns facet={facets.gen} keys={generations} active={params.gen} onToggle={toggleGen} height="h-28" />
          {facetTotals.gen ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Documented for <span className="tabular-nums">{fmt(Math.max(0, facetTotals.gen - genNone))}</span> of {fmt(facetTotals.gen)} ({Math.round(((facetTotals.gen - genNone) / facetTotals.gen) * 100)}%)
            </p>
          ) : null}
        </Panel>
        <BarList title="Documented ancestry" facet={facets.ancestry} param="ancestry" params={params} set={set} limit={10} total={facetTotals.ancestry} />
      </div>
    </div>
  );
}

// Where they sit: lean, role, state and how connected they are.
export function PositionFacets({ facets, params, set }: { facets: AttributeFacets; params: AttributeParams; set: SetFilter }) {
  const sideTotal = SIDE_ORDER.reduce((sum, side) => sum + (facets.side[side] ?? 0), 0);
  const groupMax = Math.max(1, ...roleGroups.map((g) => facets.group[g.key] ?? 0));
  const stateMax = Math.max(1, ...Object.values(facets.state));
  const state = params.state?.toUpperCase();
  const toggle = (key: keyof AttributeParams, value: string) => set(key, params[key]?.toUpperCase() === value.toUpperCase() ? undefined : value);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.15fr_0.9fr]">
      <div className="space-y-7">
        <Panel title="Political lean" onClear={params.side ? () => set("side", undefined) : undefined}>
          <div className="flex h-7 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-900">
            {SIDE_ORDER.map((side) => {
              const n = facets.side[side] ?? 0;
              if (!n) return null;
              return (
                <button
                  key={side}
                  type="button"
                  onClick={() => toggle("side", side)}
                  aria-pressed={params.side === side}
                  title={`${sideLabels[side]}: ${fmt(n)}`}
                  aria-label={`${sideLabels[side]}: ${fmt(n)}`}
                  className={`h-full transition-opacity hover:opacity-100 ${dim(params.side, side)}`}
                  style={{ width: `${(n / Math.max(1, sideTotal)) * 100}%`, background: SIDE_FILL[side] }}
                />
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {SIDE_ORDER.map((side) => (
              <button key={side} type="button" onClick={() => toggle("side", side)} className={`inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white ${dim(params.side, side)}`}>
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SIDE_FILL[side] }} />
                {sideLabels[side]} <span className="tabular-nums text-slate-400">{fmt(facets.side[side] ?? 0)}</span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Role" onClear={params.group ? () => set("group", undefined) : undefined}>
          <ul className="space-y-1.5">
            {roleGroups.map((group) => {
              const n = facets.group[group.key] ?? 0;
              return (
                <li key={group.key}>
                  <button type="button" onClick={() => toggle("group", group.key)} aria-pressed={params.group === group.key} className={`block w-full rounded-md px-1 py-1 text-left hover:bg-slate-50 dark:hover:bg-slate-900 ${dim(params.group, group.key)}`}>
                    <span className="flex justify-between gap-2 text-sm">
                      <span className={params.group === group.key ? "font-semibold" : ""}>{group.label}</span>
                      <span className="tabular-nums text-slate-500">{fmt(n)}</span>
                    </span>
                    <span className="mt-1 block h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                      <span className="block h-full rounded-full" style={{ width: `${(n / groupMax) * 100}%`, background: "var(--viz-series-1)" }} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <Panel title={state ? `State · ${usStateName(state)}` : "State"} onClear={state ? () => set("state", undefined) : undefined}>
        <div
          className="grid gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${US_STATE_GRID_COLS}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${US_STATE_GRID_ROWS}, auto)` }}
        >
          {US_STATE_GRID.map((cell) => {
            const n = facets.state[cell.abbr] ?? 0;
            const level = n ? Math.min(SEQ.length - 1, Math.floor(Math.sqrt(n / stateMax) * SEQ.length)) : -1;
            const selected = state === cell.abbr;
            return (
              <button
                key={cell.abbr}
                type="button"
                onClick={() => toggle("state", cell.abbr)}
                aria-pressed={selected}
                title={`${cell.name}: ${fmt(n)}`}
                aria-label={`${cell.name}: ${fmt(n)}`}
                className={`flex aspect-square items-center justify-center rounded-[4px] text-[9px] font-semibold sm:text-[10px] ${
                  selected ? "ring-2 ring-slate-950 ring-offset-1 dark:ring-white dark:ring-offset-slate-950" : ""
                } ${state && !selected ? "opacity-40" : ""} ${level >= 4 ? "text-white dark:text-slate-950" : "text-slate-700 dark:text-slate-200"}`}
                style={{ gridRow: cell.row + 1, gridColumn: cell.col + 1, background: level >= 0 ? SEQ[level] : "var(--viz-empty)" }}
              >
                {cell.abbr}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-400">Stronger shading means more entries. Only entries with a recorded state are mapped.</p>
      </Panel>

      <Panel title="Connections" onClear={params.ties ? () => set("ties", undefined) : undefined}>
        <Columns facet={facets.ties} keys={tieBands} active={params.ties} onToggle={(key) => toggle("ties", key)} height="h-40" />
      </Panel>
    </div>
  );
}
