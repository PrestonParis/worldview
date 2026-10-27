"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CongressAtlas } from "@/components/people/congress-atlas";
import { CourtBench } from "@/components/people/court-bench";
import { ExecutiveMap } from "@/components/people/executive-map";
import type { AtlasMember } from "@/lib/people/atlas";
import type { CourtComposition } from "@/lib/people/court";
import type { ExecutiveMapData } from "@/lib/people/executive";
import type { SpectrumItem, SpectrumRow, SpectrumSide } from "@/lib/people/spectrum";
import { initials } from "@/lib/format";

// The People page's lead visual: a rail of every group split left and
// right, and the selected group drawn in full beside it.

const COLOR: Record<SpectrumSide, string> = {
  liberal: "var(--viz-dem)",
  conservative: "var(--viz-rep)",
  unplaced: "var(--viz-muted)",
};
const SIDE_LABEL = { liberal: "Left of center", conservative: "Right of center" } as const;
const PREVIEW = 30;

const fmt = (n: number) => n.toLocaleString("en-US");

// Opens the attribute explorer below, filtered to a row (and side).
export type Browse = (filter: SpectrumRow["filter"] & { side?: string }) => void;

function SplitBar({ counts, className = "h-1.5" }: { counts: SpectrumRow["counts"]; className?: string }) {
  const total = Math.max(1, counts.liberal + counts.conservative + counts.unplaced);
  return (
    <span className={`flex w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 ${className}`}>
      {(["liberal", "unplaced", "conservative"] as const).map((side) =>
        counts[side] ? <span key={side} style={{ width: `${(counts[side] / total) * 100}%`, background: COLOR[side] }} /> : null,
      )}
    </span>
  );
}

function Chip({ item }: { item: SpectrumItem }) {
  return (
    <li>
      <Link
        href={item.href}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-0.5 pr-2.5 pl-0.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ background: COLOR[item.side] }} aria-hidden>
          {initials(item.name)}
        </span>
        {item.name}
        {item.note ? <span className="font-normal text-slate-400 tabular-nums">{item.note}</span> : null}
      </Link>
    </li>
  );
}

function SideColumn({ row, side, onBrowse }: { row: SpectrumRow; side: "liberal" | "conservative"; onBrowse: Browse }) {
  const items = row.items.filter((item) => item.side === side);
  const total = row.counts[side];
  return (
    <div className="min-w-0">
      <h3 className="flex items-center justify-between gap-2 text-sm font-semibold">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR[side] }} />
          {SIDE_LABEL[side]}
        </span>
        <span className="font-normal text-slate-400 tabular-nums">{fmt(total)}</span>
      </h3>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {items.slice(0, PREVIEW).map((item) => <Chip key={item.id} item={item} />)}
      </ul>
      {total > Math.min(items.length, PREVIEW) ? (
        <button type="button" onClick={() => onBrowse({ ...row.filter, side })} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
          All {fmt(total)} <ArrowRight className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

function ListedDetail({ row, onBrowse }: { row: SpectrumRow; onBrowse: Browse }) {
  const unplaced = row.items.filter((item) => item.side === "unplaced");
  return (
    <div>
      {row.itemsLabel ? <p className="-mt-2 mb-4 text-xs font-semibold tracking-wide text-slate-400 uppercase">{row.itemsLabel}</p> : null}
      <div className="grid gap-6 md:grid-cols-2">
        <SideColumn row={row} side="liberal" onBrowse={onBrowse} />
        <SideColumn row={row} side="conservative" onBrowse={onBrowse} />
      </div>
      {unplaced.length && !row.itemsLabel ? (
        <p className="mt-5 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Not placed:{" "}
          {unplaced.map((item, i) => (
            <span key={item.id}>
              {i ? ", " : ""}
              <Link href={item.href} className="hover:text-slate-950 hover:underline dark:hover:text-white">{item.name}</Link>
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

function CountDetail({ row, onBrowse }: { row: SpectrumRow; onBrowse: Browse }) {
  return (
    <div className="flex h-full flex-col justify-center gap-6 py-6">
      <div className="flex items-end justify-between gap-4">
        {(["liberal", "conservative"] as const).map((side) => (
          <button key={side} type="button" onClick={() => onBrowse({ ...row.filter, side })} className={`group ${side === "conservative" ? "text-right" : "text-left"}`}>
            <span className="block text-4xl font-semibold tabular-nums" style={{ color: COLOR[side] }}>{fmt(row.counts[side])}</span>
            <span className="mt-1 inline-flex items-center gap-1 text-sm text-slate-600 group-hover:text-slate-950 dark:text-slate-300 dark:group-hover:text-white">
              {SIDE_LABEL[side]} <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
        ))}
      </div>
      <SplitBar counts={row.counts} className="h-4" />
      {row.counts.unplaced ? (
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">{fmt(row.counts.unplaced)} not placed on either side</p>
      ) : null}
    </div>
  );
}

// Header links for rows that point somewhere better than the explorer.
const COURT_LINK = { href: "/legislation#court", label: "Court decisions" };

const linkClass = "inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white";

export function PeopleSpectrum({
  rows,
  atlas,
  executive,
  court,
  onBrowse,
}: {
  rows: SpectrumRow[];
  atlas: { congress: number; members: AtlasMember[] } | null;
  executive: ExecutiveMapData | null;
  court: CourtComposition | null;
  onBrowse: Browse;
}) {
  const [active, setActive] = useState(rows[0]?.key);
  const [chamber, setChamber] = useState<"Senate" | "House">("Senate");

  // /people#executive (where /people/administration now lands) opens that row.
  useEffect(() => {
    const open = () => {
      const key = window.location.hash.slice(1);
      if (!rows.some((r) => r.key === key)) return;
      setActive(key);
      document.getElementById("branches")?.scrollIntoView({ block: "start" });
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, [rows]);

  const select = (key: string) => {
    setActive(key);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#${key}`);
  };

  const row = rows.find((r) => r.key === active) ?? rows[0];
  if (!row) return null;

  return (
    <div id="branches" className="grid scroll-mt-24 overflow-hidden rounded-3xl border border-slate-200 bg-white lg:grid-cols-[300px_1fr] dark:border-slate-800 dark:bg-slate-950">
      <nav aria-label="Groups" className="border-b border-slate-200 p-3 lg:border-r lg:border-b-0 dark:border-slate-800">
        <ul className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1">
          {rows.map((r) => {
            const on = r.key === row.key;
            return (
              <li key={r.key}>
                <button
                  type="button"
                  onClick={() => select(r.key)}
                  aria-pressed={on}
                  className={`w-full rounded-xl px-3 py-2 text-left ${on ? "bg-slate-100 dark:bg-slate-900" : "hover:bg-slate-50 dark:hover:bg-slate-900/60"}`}
                >
                  <span className="flex items-baseline justify-between gap-2 text-sm">
                    <span className={on ? "font-semibold text-slate-950 dark:text-white" : "font-medium text-slate-700 dark:text-slate-300"}>{r.label}</span>
                    <span className="text-xs text-slate-400 tabular-nums">{fmt(r.counts.liberal + r.counts.conservative + r.counts.unplaced)}</span>
                  </span>
                  <span className="mt-1.5 block"><SplitBar counts={r.counts} /></span>
                  <span className="mt-0.5 flex justify-between text-[11px] tabular-nums text-slate-500">
                    <span>{fmt(r.counts.liberal)}</span>
                    <span>{fmt(r.counts.conservative)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <section className="min-w-0 p-5 sm:p-6" aria-live="polite">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            {row.key === "congress" && atlas
              ? `${atlas.congress}th Congress, by voting record`
              : row.key === "executive" && executive
                ? `Executive branch under ${executive.president.name}`
                : row.key === "court" && court
                  ? "The Supreme Court"
                  : row.label}
          </h2>
          {row.key === "congress" ? (
            <div role="group" aria-label="Chamber" className="inline-flex rounded-full border border-slate-200 p-0.5 text-sm dark:border-slate-800">
              {(["Senate", "House"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setChamber(c)}
                  aria-pressed={chamber === c}
                  className={`rounded-full px-3 py-1 font-medium ${chamber === c ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950" : "text-slate-500 hover:text-slate-950 dark:hover:text-white"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          ) : row.key === "executive" && executive ? (
            <Link href={executive.president.href} className={linkClass}>
              {executive.president.name}&apos;s profile <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : row.key === "court" ? (
            <Link href={COURT_LINK.href} className={linkClass}>
              {COURT_LINK.label} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <button type="button" onClick={() => onBrowse(row.filter)} className={linkClass}>
              Explore attributes <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {row.key === "congress" && atlas ? (
          <>
            <CongressAtlas congress={atlas.congress} members={atlas.members} chamber={chamber} />
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Placed by Voteview DW-NOMINATE scores, computed from every roll-call vote.</p>
          </>
        ) : row.key === "executive" && executive ? (
          <ExecutiveMap data={executive} />
        ) : row.key === "court" && court ? (
          <CourtBench data={court} />
        ) : row.items.length ? (
          <ListedDetail row={row} onBrowse={onBrowse} />
        ) : (
          <CountDetail row={row} onBrowse={onBrowse} />
        )}
      </section>
    </div>
  );
}
