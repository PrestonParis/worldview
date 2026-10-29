"use client";

import { useMemo, useState } from "react";
import { formatValue } from "@/lib/format";

export interface LaneYear {
  aid: { total: number; military: number; missileDefense: number; economic: number } | null;
  trade: { exports: number; imports: number } | null;
  arms: { count: number; value: number };
  votes: { measure: string; kind: string; result: string }[];
  money: { contributions: number; outside: number; cycle: number } | null;
  un: { votes: number; same: number } | null;
  vetoes: number;
  events: { title: string; lane: string }[]; // timeline milestones that year
  president: string;
}

const usd = (v: number) => formatValue(v, "usd", { compact: true });

const LANES = [
  { id: "financial", n: "01", title: "Financial", us: "Aid, grants, missile-defense funding", il: "Trade, purchases, investment", href: "#money" },
  { id: "military", n: "02", title: "Military", us: "Weapons sales, stockpiles, deployments", il: "Co-production, technology, intelligence", href: "#arms" },
  { id: "political", n: "03", title: "Political", us: "Congress, votes, advocacy money", il: "Lobbying, official representation", href: "#influence" },
  { id: "diplomatic", n: "04", title: "Diplomatic", us: "UN votes and vetoes, recognition", il: "Agreements, negotiations", href: "#diplomacy" },
] as const;

type LaneId = (typeof LANES)[number]["id"];

export function RelationshipMap({ years, initial }: { years: Record<number, LaneYear>; initial: number }) {
  const all = useMemo(() => Object.keys(years).map(Number).sort((a, b) => a - b), [years]);
  const [year, setYear] = useState(initial);
  const [open, setOpen] = useState<LaneId | null>(null);
  const y = years[year];

  const lines: Record<LaneId, { us: string[]; il: string[] }> = {
    financial: {
      us: y.aid
        ? [`${usd(y.aid.total)} in aid (FY${year})`, `${usd(y.aid.military)} military · ${usd(y.aid.missileDefense)} missile defense`, ...(y.aid.economic ? [`${usd(y.aid.economic)} economic`] : [])]
        : ["No aid figure for this year"],
      il: y.trade ? [`${usd(y.trade.imports)} in goods sold to the U.S.`, `${usd(y.trade.exports)} in U.S. goods bought`] : ["Census trade data starts in 1985"],
    },
    military: {
      us: y.arms.count ? [`${y.arms.count} arms sale${y.arms.count === 1 ? "" : "s"} notified`, `${usd(y.arms.value)} estimated value`] : ["No notified sales in Worldview's tracker this year"],
      il: [
        ...y.events.filter((e) => e.lane === "Military").map((e) => e.title),
        "Missile-defense co-development (Arrow, David's Sling, Iron Dome)",
        "Israeli firms supply parts of U.S. systems such as F-35 wings and helmets",
      ],
    },
    political: {
      us: y.votes.length ? y.votes.map((v) => `${v.measure}: ${v.kind.toLowerCase()} — ${v.result.toLowerCase()}`) : ["No key roll call in Worldview's set this year"],
      il: y.money
        ? [`${usd(y.money.contributions)} given to candidates by tracked pro-Israel PACs (${y.money.cycle} cycle)`, `${usd(y.money.outside)} in independent spending`]
        : ["FEC money for tracked groups loaded for 2022 onward"],
    },
    diplomatic: {
      us: [
        ...(y.un ? [`Voted with Israel on ${y.un.same} of ${y.un.votes} UN General Assembly votes`] : ["No recorded General Assembly votes loaded"]),
        ...(y.vetoes ? [`${y.vetoes} Security Council veto${y.vetoes === 1 ? "" : "es"} on Gaza drafts`] : []),
      ],
      il: y.events.some((e) => e.lane === "Diplomatic")
        ? y.events.filter((e) => e.lane === "Diplomatic").map((e) => e.title)
        : ["No diplomatic milestone in the timeline this year"],
    },
  };

  return (
    <div className="rounded-2xl border border-slate-200 p-4 sm:p-6 dark:border-slate-800">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Relationship map</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950 dark:text-white">
            {year} <span className="text-base font-normal text-slate-500 dark:text-slate-400">· {y.president}</span>
          </p>
        </div>
        <label className="flex min-w-0 flex-1 items-center gap-3 text-sm text-slate-600 sm:max-w-md dark:text-slate-300">
          <span className="shrink-0">Year</span>
          <input
            type="range"
            min={all[0]}
            max={all.at(-1)}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-full accent-(--viz-series-1)"
            aria-label="Year"
          />
        </label>
      </div>

      <div className="mt-5 hidden grid-cols-[1fr_auto_1fr] gap-3 text-sm font-semibold text-slate-900 sm:grid dark:text-white">
        <p>United States <span className="font-normal text-slate-500 dark:text-slate-400">· government, Congress, industry, groups</span></p>
        <span className="w-28" />
        <p className="text-right">Israel <span className="font-normal text-slate-500 dark:text-slate-400">· government, military, industry</span></p>
      </div>

      <div className="mt-3 space-y-3">
        {LANES.map((lane) => {
          const l = lines[lane.id];
          const expanded = open === lane.id;
          return (
            <div key={lane.id} className="rounded-xl bg-slate-50 dark:bg-slate-900/60">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : lane.id)}
                aria-expanded={expanded}
                className="grid w-full gap-3 p-3 text-left sm:grid-cols-[1fr_auto_1fr] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 sm:hidden dark:text-slate-400">United States</p>
                  <p className="text-sm text-slate-700 dark:text-slate-200">{lane.us}</p>
                  <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-slate-950 dark:text-white">{l.us[0]}</p>
                </div>
                <div className="flex w-28 flex-col items-center justify-self-center text-center">
                  <span className="text-[10px] font-semibold tabular-nums text-slate-400">{lane.n}</span>
                  <span className="text-sm font-semibold text-slate-950 dark:text-white">{lane.title}</span>
                  <span aria-hidden className="text-slate-400">⇄</span>
                </div>
                <div className="min-w-0 sm:text-right">
                  <p className="text-xs text-slate-500 sm:hidden dark:text-slate-400">Israel</p>
                  <p className="text-sm text-slate-700 dark:text-slate-200">{lane.il}</p>
                  <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-slate-950 dark:text-white">{l.il[0]}</p>
                </div>
              </button>
              {expanded && (
                <div className="grid gap-3 border-t border-slate-200 p-3 text-sm sm:grid-cols-[1fr_auto_1fr] dark:border-slate-800">
                  <ul className="space-y-1 text-slate-700 dark:text-slate-200">
                    {l.us.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  <a href={lane.href} className="w-28 justify-self-center self-start text-center text-xs font-medium underline underline-offset-2 text-slate-600 dark:text-slate-300">
                    Open the {lane.title.toLowerCase()} section
                  </a>
                  <ul className="space-y-1 text-slate-700 sm:text-right dark:text-slate-200">
                    {l.il.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Click a lane for the year&apos;s detail.
      </p>
    </div>
  );
}
