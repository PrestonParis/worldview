"use client";

import { useEffect, useMemo, useState } from "react";
import { ResultsMap, type AreaDatum } from "@/components/elections/results-map";
import type { ContestDetail } from "@/lib/db/closeRaces";
import { partyColorFor } from "@/lib/party-colors";
import countyFips from "../../../../data/elections/ga/county-fips.json";

// County maps on the results hub. A county takes the color of whoever led it,
// deeper as the lead grows; both candidates and the county table carry the same
// numbers for anyone who can't rely on color.

const GA_BOUNDS: [number, number, number, number] = [-85.7, 30.3, -80.8, 35.05];
const FIPS = countyFips as Record<string, string>;
const PARTY_NAMES: Record<string, string> = { R: "republican", D: "democratic", L: "libertarian", G: "green", I: "independent" };
// For candidates with no party and for ballot questions. Fixed to overall
// standing, so a choice keeps its color county to county.
const NO_PARTY_COLORS = ["#7C3AED", "#D97706", "#0F766E", "#64748B"];

type Option = ContestDetail["options"][number];

function optionColor(option: Option, index: number): string {
  if (option.party && PARTY_NAMES[option.party]) return partyColorFor(PARTY_NAMES[option.party]).border;
  return NO_PARTY_COLORS[Math.min(index, NO_PARTY_COLORS.length - 1)];
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function countyStyles(detail: ContestDetail): Record<string, AreaDatum> {
  const out: Record<string, AreaDatum> = {};
  const colors = new Map(detail.options.map((o, i) => [o.id, optionColor(o, i)]));
  const names = new Map(detail.options.map((o) => [o.id, o.name]));
  for (const area of detail.areas) {
    const fips = FIPS[area.countySlug];
    if (!fips) continue;
    const entries = Object.entries(area.votes).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, v]) => s + v, 0);
    if (!total) continue;
    const [first, second] = entries;
    const lead = ((first[1] - (second?.[1] ?? 0)) / total) * 100;
    const tied = second != null && first[1] === second[1];
    const share = entries
      .slice(0, 2)
      .map(([id, v]) => `${names.get(id)} ${((v / total) * 100).toFixed(1)}%`)
      .join(", ");
    out[fips] = {
      color: tied ? "#94A3B8" : (colors.get(first[0]) ?? "#94A3B8"),
      // A narrow lead still has to be visible against the basemap.
      opacity: 0.3 + Math.min(lead / 50, 1) * 0.65,
      label: `${area.county}: ${share} · ${fmt(total)} votes`,
    };
  }
  return out;
}

export function RaceMap({ detail, className = "h-[420px]" }: { detail: ContestDetail; className?: string }) {
  const areas = useMemo(() => countyStyles(detail), [detail]);
  const legend = detail.options.filter((o) => !o.isWriteIn).slice(0, 4);
  return (
    <div>
      <ResultsMap areas={areas} dataUrl="/data/ga-counties.geojson" bounds={GA_BOUNDS} className={className} />
      <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
        {legend.map((o, i) => (
          <li key={o.id} className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: optionColor(o, detail.options.indexOf(o)) }} />
            {o.name}
            {i === 0 ? " (statewide leader)" : ""}
          </li>
        ))}
        <li className="text-slate-500">Deeper color: wider county lead</li>
      </ul>
    </div>
  );
}

/** Overview's map: any statewide contest, loaded when picked. */
export function StatewideMap({ contests }: { contests: { id: string; name: string }[] }) {
  const [selected, setSelected] = useState(contests[0]?.id ?? "");
  const [detail, setDetail] = useState<ContestDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!selected) return;
    let live = true;
    fetch(`/api/writ/close-races/contests/${selected}`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((json: ContestDetail) => {
        if (!live) return;
        setDetail(json);
        setFailed(false);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [selected]);

  if (!contests.length) return null;
  return (
    <div className="space-y-3">
      <label className="flex max-w-md items-center gap-2 text-sm">
        <span className="shrink-0 text-slate-500 dark:text-slate-400">Contest</span>
        <select
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          {contests.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {failed ? <p className="text-sm text-slate-500">Couldn&apos;t load this map.</p> : null}
      {detail ? <RaceMap detail={detail} /> : !failed ? <div className="h-[420px] rounded-lg bg-slate-100 dark:bg-slate-900" /> : null}
    </div>
  );
}
