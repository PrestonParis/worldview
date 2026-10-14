import Link from "next/link";
import type { ReactNode } from "react";
import { sideLabels, type GraphSide } from "@/lib/graph/lean";
import { US_STATE_GRID, US_STATE_GRID_COLS, US_STATE_GRID_ROWS, usStateName } from "@/lib/money/us-states";
import { directoryHref, tieBands, type DirectoryFacets, type DirectoryParams } from "@/lib/people/directory";
import { FAMILY_FILL } from "@/lib/people/family-colors";
import { roleGroups } from "@/lib/people/public";

// Facet charts above the directory. Each mark is a link that toggles its
// filter, so the charts double as the filter controls.

const SIDE_ORDER: GraphSide[] = ["liberal", "uncharacterized", "conservative"];
const SIDE_FILL: Record<GraphSide, string> = {
  liberal: FAMILY_FILL.liberal,
  conservative: FAMILY_FILL.conservative,
  uncharacterized: "var(--viz-muted)",
};
const SEQ = ["var(--viz-seq-1)", "var(--viz-seq-2)", "var(--viz-seq-3)", "var(--viz-seq-4)", "var(--viz-seq-5)", "var(--viz-seq-6)", "var(--viz-seq-7)"];

const fmt = (n: number) => n.toLocaleString("en-US");

function Panel({ title, clearHref, children }: { title: string; clearHref?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h2>
        {clearHref ? <Link href={clearHref} className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-950 dark:hover:text-white">Clear</Link> : null}
      </div>
      {children}
    </div>
  );
}

const dim = (active: string | undefined, key: string) => (active && active !== key ? "opacity-35" : "");

export function DirectoryFacets({ facets, params }: { facets: DirectoryFacets; params: DirectoryParams }) {
  const sideTotal = SIDE_ORDER.reduce((sum, side) => sum + (facets.side[side] ?? 0), 0);
  const groupMax = Math.max(1, ...roleGroups.map((g) => facets.group[g.key] ?? 0));
  const stateMax = Math.max(1, ...Object.values(facets.state));
  const tiesMax = Math.max(1, ...tieBands.map((b) => facets.ties[b.key] ?? 0));
  const state = params.state?.toUpperCase();
  const toggle = (key: keyof DirectoryParams, value: string) =>
    directoryHref(params, { [key]: params[key]?.toUpperCase() === value.toUpperCase() ? undefined : value });

  return (
    <div className="mt-6 grid grid-cols-1 gap-8 rounded-2xl border border-slate-200 p-5 lg:grid-cols-[1fr_1.15fr_0.9fr] dark:border-slate-800">
      <div className="space-y-7">
        <Panel title="Political lean" clearHref={params.side ? directoryHref(params, { side: undefined }) : undefined}>
          <div className="flex h-7 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-900">
            {SIDE_ORDER.map((side) => {
              const n = facets.side[side] ?? 0;
              if (!n) return null;
              return (
                <Link
                  key={side}
                  href={toggle("side", side)}
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
              <Link key={side} href={toggle("side", side)} className={`inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white ${dim(params.side, side)}`}>
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SIDE_FILL[side] }} />
                {sideLabels[side]} <span className="tabular-nums text-slate-400">{fmt(facets.side[side] ?? 0)}</span>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="Role" clearHref={params.group ? directoryHref(params, { group: undefined }) : undefined}>
          <ul className="space-y-1.5">
            {roleGroups.map((group) => {
              const n = facets.group[group.key] ?? 0;
              return (
                <li key={group.key}>
                  <Link href={toggle("group", group.key)} className={`group block rounded-md px-1 py-1 hover:bg-slate-50 dark:hover:bg-slate-900 ${dim(params.group, group.key)}`}>
                    <span className="flex justify-between gap-2 text-sm">
                      <span className={params.group === group.key ? "font-semibold" : ""}>{group.label}</span>
                      <span className="tabular-nums text-slate-500">{fmt(n)}</span>
                    </span>
                    <span className="mt-1 block h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                      <span className="block h-full rounded-full" style={{ width: `${(n / groupMax) * 100}%`, background: "var(--viz-series-1)" }} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <Panel title={state ? `State · ${usStateName(state)}` : "State"} clearHref={state ? directoryHref(params, { state: undefined }) : undefined}>
        <div
          className="grid gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${US_STATE_GRID_COLS}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${US_STATE_GRID_ROWS}, auto)` }}
        >
          {US_STATE_GRID.map((cell) => {
            const n = facets.state[cell.abbr] ?? 0;
            const level = n ? Math.min(SEQ.length - 1, Math.floor(Math.sqrt(n / stateMax) * SEQ.length)) : -1;
            const selected = state === cell.abbr;
            return (
              <Link
                key={cell.abbr}
                href={toggle("state", cell.abbr)}
                title={`${cell.name}: ${fmt(n)}`}
                aria-label={`${cell.name}: ${fmt(n)}`}
                className={`flex aspect-square items-center justify-center rounded-[4px] text-[9px] font-semibold sm:text-[10px] ${
                  selected ? "ring-2 ring-slate-950 ring-offset-1 dark:ring-white dark:ring-offset-slate-950" : ""
                } ${state && !selected ? "opacity-40" : ""} ${level >= 4 ? "text-white dark:text-slate-950" : "text-slate-700 dark:text-slate-200"}`}
                style={{ gridRow: cell.row + 1, gridColumn: cell.col + 1, background: level >= 0 ? SEQ[level] : "var(--viz-empty)" }}
              >
                {cell.abbr}
              </Link>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-400">Stronger shading means more entries. Only entries with a recorded state are mapped.</p>
      </Panel>

      <Panel title="Connections" clearHref={params.ties ? directoryHref(params, { ties: undefined }) : undefined}>
        <div className="flex h-40 items-end gap-2">
          {tieBands.map((band) => {
            const n = facets.ties[band.key] ?? 0;
            return (
              <Link
                key={band.key}
                href={toggle("ties", band.key)}
                title={`${band.label} connections: ${fmt(n)}`}
                className={`group flex h-full flex-1 flex-col justify-end ${dim(params.ties, band.key)}`}
              >
                <span className="mb-1 text-center text-[11px] tabular-nums text-slate-500">{fmt(n)}</span>
                <span
                  className="block rounded-t-md transition-colors group-hover:brightness-110"
                  style={{ height: `${n ? Math.max(3, Math.sqrt(n / tiesMax) * 100) : 0}%`, background: "var(--viz-series-1)" }}
                />
              </Link>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-2 border-t border-slate-200 pt-1.5 text-[11px] text-slate-500 dark:border-slate-800">
          {tieBands.map((band) => <span key={band.key} className="flex-1 text-center">{band.label}</span>)}
        </div>
      </Panel>
    </div>
  );
}
