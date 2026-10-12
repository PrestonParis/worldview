"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { beeswarm } from "@/lib/people/beeswarm";
import type { AtlasMember, AtlasParty } from "@/lib/people/atlas";

const W = 1000;
const MARGIN = 24;
const LANE_GAP = 28;
const AXIS_H = 44;
const RADIUS = { Senate: 7, House: 4.6 } as const;
const CHAMBERS = ["Senate", "House"] as const;

const PARTY_COLOR: Record<AtlasParty, string> = {
  D: "var(--viz-dem)",
  R: "var(--viz-rep)",
  I: "var(--viz-muted)",
};
const PARTY_NAME: Record<AtlasParty, string> = { D: "Democrat", R: "Republican", I: "Independent" };

const xOf = (score: number) => MARGIN + ((Math.max(-1, Math.min(1, score)) + 1) / 2) * (W - 2 * MARGIN);

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface Placed extends AtlasMember {
  x: number;
  y: number;
  r: number;
}

function layoutLanes(members: AtlasMember[]) {
  let top = 0;
  const lanes = [];
  for (const chamber of CHAMBERS) {
    const inLane = members.filter((m) => m.chamber === chamber);
    const r = RADIUS[chamber];
    const xs = inLane.map((m) => xOf(m.score));
    const ys = beeswarm(xs, r, 1.2);
    const half = Math.max(r, ...ys.map((y) => Math.abs(y) + r)) + 10;
    const centre = top + 22 + half;
    const placed: Placed[] = inLane.map((m, i) => ({ ...m, x: xs[i], y: centre + ys[i], r }));
    const medians = (["D", "R"] as const).map((party) => ({
      party,
      value: median(inLane.filter((m) => m.party === party).map((m) => m.score)),
    }));
    lanes.push({ chamber, top, centre, bottom: centre + half, placed, medians, count: inLane.length });
    top = centre + half + LANE_GAP;
  }
  return { lanes, height: top - LANE_GAP + AXIS_H };
}

export function CongressAtlas({ congress, members }: { congress: number; members: AtlasMember[] }) {
  const [hovered, setHovered] = useState<Placed | null>(null);
  const [query, setQuery] = useState("");

  const layout = useMemo(() => layoutLanes(members), [members]);

  const q = query.trim().toLowerCase();
  const matches = (m: AtlasMember) => !q || m.name.toLowerCase().includes(q) || m.seat.toLowerCase().startsWith(q);
  const matchCount = q ? members.filter(matches).length : 0;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
          {(["D", "R", "I"] as const).map((party) => (
            <span key={party} className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: PARTY_COLOR[party] }} />
              {PARTY_NAME[party]}s
            </span>
          ))}
          <span className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <span className="h-4 border-l-2 border-dashed border-slate-400" /> Party median
          </span>
        </div>
        <label className="relative block w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a member or state"
            className="w-full rounded-full border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950"
          />
          {q ? (
            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-slate-400 tabular-nums">{matchCount}</span>
          ) : null}
        </label>
      </div>

      <div className="relative mt-5">
        <svg viewBox={`0 0 ${W} ${layout.height}`} className="block h-auto w-full overflow-visible" role="img" aria-label={`Members of the ${congress}th Congress by voting record`}>
          {layout.lanes.map((lane) => (
            <g key={lane.chamber}>
              <text x={MARGIN} y={lane.top + 12} className="fill-slate-900 text-[15px] font-semibold dark:fill-white">
                {lane.chamber}
                <tspan className="fill-slate-400 font-normal"> · {lane.count}</tspan>
              </text>
              <line x1={MARGIN} x2={W - MARGIN} y1={lane.centre} y2={lane.centre} className="stroke-slate-200 dark:stroke-slate-800" />
              {lane.medians.map(({ party, value }) =>
                value === null ? null : (
                  <line
                    key={party}
                    x1={xOf(value)}
                    x2={xOf(value)}
                    y1={lane.top + 20}
                    y2={lane.bottom}
                    stroke={PARTY_COLOR[party]}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    opacity={0.7}
                  />
                ),
              )}
              {lane.placed.map((m) => {
                const on = matches(m);
                const dot = (
                  <circle
                    cx={m.x}
                    cy={m.y}
                    r={hovered?.key === m.key || (q && on) ? m.r + 1.5 : m.r}
                    fill={PARTY_COLOR[m.party]}
                    opacity={on ? 1 : 0.15}
                    className="stroke-white transition-[r,opacity] dark:stroke-slate-950"
                    strokeWidth={hovered?.key === m.key ? 2 : 0.8}
                  />
                );
                const handlers = {
                  onMouseEnter: () => setHovered(m),
                  onMouseLeave: () => setHovered(null),
                  onFocus: () => setHovered(m),
                  onBlur: () => setHovered(null),
                };
                const label = `${m.name}, ${m.party}-${m.seat}`;
                return m.href ? (
                  <a key={m.key} href={m.href} aria-label={label} {...handlers}>
                    {dot}
                  </a>
                ) : (
                  <g key={m.key} aria-label={label} {...handlers}>
                    {dot}
                  </g>
                );
              })}
            </g>
          ))}

          <g transform={`translate(0 ${layout.height - AXIS_H + 8})`}>
            <line x1={MARGIN} x2={W - MARGIN} y1={0} y2={0} className="stroke-slate-300 dark:stroke-slate-700" />
            {[-1, -0.5, 0, 0.5, 1].map((t) => (
              <g key={t} transform={`translate(${xOf(t)} 0)`}>
                <line y1={0} y2={5} className="stroke-slate-300 dark:stroke-slate-700" />
                <text y={19} textAnchor="middle" className="fill-slate-400 text-[11px] tabular-nums">{t}</text>
              </g>
            ))}
            <text x={MARGIN} y={36} className="fill-slate-500 text-[12px] font-medium dark:fill-slate-400">← More liberal</text>
            <text x={W - MARGIN} y={36} textAnchor="end" className="fill-slate-500 text-[12px] font-medium dark:fill-slate-400">More conservative →</text>
          </g>
        </svg>

        {hovered ? (
          <div
            className="pointer-events-none absolute z-10 flex w-60 -translate-x-1/2 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"
            style={{
              left: `${Math.min(88, Math.max(12, (hovered.x / W) * 100))}%`,
              top: `${((hovered.y + hovered.r + 8) / layout.height) * 100}%`,
            }}
          >
            {hovered.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- member portraits are externally hosted
              <img src={hovered.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="h-12 w-12 shrink-0 rounded-full" style={{ background: PARTY_COLOR[hovered.party] }} />
            )}
            <span className="min-w-0">
              <span className="block truncate font-semibold text-slate-900 dark:text-white">{hovered.name}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {PARTY_NAME[hovered.party]} · {hovered.seat} · {hovered.chamber}
              </span>
              <span className="block text-xs text-slate-400 tabular-nums">Score {hovered.score.toFixed(2)}</span>
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
