"use client";

import { useMemo, useState } from "react";
import { AXIS_GROUPS, axes } from "@/lib/quiz/axes";
import { familyColor } from "@/lib/quiz/families";
import type { AxisGroup, AxisId, IdeologyFamily } from "@/lib/quiz/types";
import { GROUP_ICON } from "@/lib/politics/icons";
import { pointsApart, poleOf, positionLabel } from "@/lib/politics/axis-language";
import { AxisName, AxisPoles, AxisTrack, MarkerGlyph, MarkerLegend, type AxisMarker } from "@/components/politics/axis";
import { ExpandableAnalysis } from "@/components/politics/expandable";
import { chartLabel, focusRing, metaText } from "@/components/politics/type";
import { SHAPES } from "./shapes";

export interface ComparedTradition {
  id: string;
  name: string;
  family: IdeologyFamily;
  position: Record<AxisId, number>;
  core: AxisId[];
}

export interface ComparedYou {
  label: string;
  positions: Partial<Record<AxisId, number>>;
}

type Sort = "domain" | "split" | "shared";

const SORTS: { id: Sort; label: string }[] = [
  { id: "domain", label: "By domain" },
  { id: "split", label: "Most disagreement" },
  { id: "shared", label: "Most agreement" },
];

const spreadOf = (values: number[]) => Math.max(...values) - Math.min(...values);

function stanceSentence(axis: AxisId, value: number) {
  const def = axes.find((a) => a.id === axis)!;
  if (Math.abs(value) < 0.2)
    return `Balances ${def.negative.label.toLowerCase()} and ${def.positive.label.toLowerCase()}.`;
  return poleOf(axis, value).description;
}

// The comparison rows: every axis with each tradition's marker on one track,
// filterable by domain and sortable by how far the traditions split.
export function CompareWorkspace({ traditions, you }: { traditions: ComparedTradition[]; you?: ComparedYou }) {
  const [domain, setDomain] = useState<AxisGroup | "all">("all");
  const [sort, setSort] = useState<Sort>("domain");

  const markersFor = (axis: AxisId): AxisMarker[] => [
    ...(you && you.positions[axis] !== undefined
      ? [{ label: you.label, shape: "ring" as const, value: you.positions[axis]! }]
      : []),
    ...traditions.map((t, i) => ({
      label: t.name,
      shape: SHAPES[i],
      color: familyColor(t.family),
      value: t.position[axis],
    })),
  ];

  const rows = useMemo(() => {
    const list = axes
      .filter((a) => domain === "all" || a.group === domain)
      .map((a) => ({ def: a, spread: spreadOf(traditions.map((t) => t.position[a.id])) }));
    if (sort === "split") list.sort((a, b) => b.spread - a.spread);
    if (sort === "shared") list.sort((a, b) => a.spread - b.spread);
    return list;
  }, [domain, sort, traditions]);

  const legend = [
    ...(you ? [{ label: you.label, shape: "ring" as const }] : []),
    ...traditions.map((t, i) => ({ label: t.name, shape: SHAPES[i], color: familyColor(t.family) })),
  ];

  const row = (def: (typeof axes)[number], spread: number, i: number) => (
    <li key={def.id} className="wv-fade" style={{ ["--i" as string]: Math.min(i, 10) }}>
      <ExpandableAnalysis
        id={`row-${def.id}`}
        summaryClassName="px-2 py-3 -mx-2 hover:bg-slate-50 dark:hover:bg-slate-900/50"
        summary={
          <span className="grid items-center gap-x-5 gap-y-2 md:grid-cols-[13rem_minmax(0,1fr)_6.5rem]">
            <span className="flex min-w-0 items-center justify-between gap-2 md:block">
              <AxisName axis={def.id} />
              <span className="flex items-center gap-1 md:mt-1 md:pl-6" aria-label="Defining for">
                {traditions.map((t, j) =>
                  t.core.includes(def.id) ? (
                    <span key={t.id} title={`Defining for ${t.name}`}>
                      <MarkerGlyph shape={SHAPES[j]} color={familyColor(t.family)} size={10} />
                    </span>
                  ) : null,
                )}
              </span>
            </span>
            <span className="block">
              <AxisTrack axis={def.id} markers={markersFor(def.id)} size="sm" />
              <AxisPoles axis={def.id} />
            </span>
            <span className="flex items-baseline justify-between gap-2 md:block md:text-right">
              <span className="text-sm font-semibold text-slate-950 tabular-nums dark:text-white">
                {pointsApart(spread)} pts
              </span>
              <span className={`md:block ${chartLabel}`}>
                {spread < 0.35 ? "Shared ground" : spread < 0.8 ? "Some distance" : "Sharp split"}
              </span>
            </span>
          </span>
        }
      >
        <div className="mb-3 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3 dark:bg-slate-900/60">
          {traditions.map((t, j) => (
            <div key={t.id} className="min-w-0">
              <p className="flex items-center gap-1.5 font-semibold text-slate-950 dark:text-white">
                <MarkerGlyph shape={SHAPES[j]} color={familyColor(t.family)} size={12} />
                {t.name}
              </p>
              <p className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">
                {positionLabel(def.id, t.position[def.id])}
              </p>
              <p className="mt-1 leading-6 text-slate-700 dark:text-slate-300">
                {stanceSentence(def.id, t.position[def.id])}
              </p>
              <p className={`mt-1 ${metaText}`}>
                {t.core.includes(def.id) ? "A defining axis for this tradition" : "Modeled; not a defining axis"}
              </p>
            </div>
          ))}
          {you && you.positions[def.id] !== undefined && (
            <p className="sm:col-span-2 lg:col-span-3 text-slate-700 dark:text-slate-300">
              <span className="font-semibold text-slate-950 dark:text-white">{you.label}:</span>{" "}
              {positionLabel(def.id, you.positions[def.id]!)}
            </p>
          )}
        </div>
      </ExpandableAnalysis>
    </li>
  );

  return (
    <div>
      <div className="sticky top-14 z-20 -mx-4 border-y border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-7 sm:px-7 dark:border-slate-800 dark:bg-slate-950/95">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Domain" className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
            {[{ id: "all" as const, label: "All axes" }, ...AXIS_GROUPS].map((g) => {
              const Icon = g.id === "all" ? null : GROUP_ICON[g.id];
              const on = domain === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDomain(g.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${focusRing} ${
                    on
                      ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {Icon && <Icon size={14} aria-hidden />}
                  {g.label}
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className={`rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-white ${focusRing}`}
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <MarkerLegend markers={legend} className="mt-2.5" />
      </div>

      {sort === "domain" ? (
        <div key={`${domain}-${sort}`} className="mt-5 space-y-7">
          {AXIS_GROUPS.filter((g) => rows.some((r) => r.def.group === g.id)).map((g) => {
            const Icon = GROUP_ICON[g.id];
            return (
              <div key={g.id}>
                <h3 className="flex items-center gap-2 border-b border-slate-200 pb-2 text-base font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">
                  <Icon size={17} aria-hidden className="text-slate-500" />
                  {g.label}
                </h3>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {rows.filter((r) => r.def.group === g.id).map((r, i) => row(r.def, r.spread, i))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <ul key={`${domain}-${sort}`} className="mt-3 divide-y divide-slate-100 dark:divide-slate-800/70">
          {rows.map((r, i) => row(r.def, r.spread, i))}
        </ul>
      )}
    </div>
  );
}
