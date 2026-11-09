// Real data behind the header's mega-menu feature cards: one small, cheap
// glimpse of each section. Server-only (reads the repo's data files and the
// DB); the shell layout computes it and hands it to the client header.

import { listRaces } from "./db/election-overview";
import { getSeries } from "./db/stats";
import type { PartyLetter, RaceSummary } from "./elections/overview";
import { getDemographicSeries } from "./demographics/forecast";
import { relationshipCategories, relationshipTypes } from "./relationships";
import { axisById } from "./quiz/axes";
import type { AxisId } from "./quiz/types";

export interface MidtermHighlight {
  office: "Senate" | "Governor";
  state: string;
  // The winner's party, or the leader's when the race is not called.
  party: PartyLetter | null;
  marginPct: number;
  called: boolean;
  note: string;
}

export interface NavPreviews {
  // Foreign-born share of the population: each census, then the ACS.
  issues: { points: [number, number][] } | null;
  // Real median household income, in today's dollars.
  economy: { points: [number, number][] } | null;
  society: {
    years: [number, number];
    observedThrough: number;
    lines: { label: string; color: string; points: [number, number][] }[];
  } | null;
  power: { total: number; categories: { label: string; count: number }[] };
  government: {
    year: number;
    electionDate: string;
    asOf: string;
    highlights: MidtermHighlight[];
  } | null;
  tools: { name: string; negative: string; positive: string }[];
}

const RACE_LINES = ["nhWhite", "hispanic"];
const MIDTERM_YEAR = 2026;
const QUIZ_AXES: AxisId[] = ["federalism", "trade", "religion"];

// Parsed once per server process; the series changes once a year.
let issuesCache: Promise<NavPreviews["issues"]> | null = null;

async function issuesPreview(): Promise<NavPreviews["issues"]> {
  const [census, acs] = await Promise.all([
    getSeries("census-historical-nativity", "foreign_born_share"),
    getSeries("census-acs1-immigration", "foreign_born_share"),
  ]);
  const lastCensus = census.at(-1)?.period ?? "";
  const points = [...census, ...acs.filter((p) => p.period > lastCensus)].map((p) => [Number(p.period), p.value] as [number, number]);
  return points.length > 1 ? { points } : null;
}

let economyCache: Promise<NavPreviews["economy"]> | null = null;

async function economyPreview(): Promise<NavPreviews["economy"]> {
  const series = await getSeries("fred-economy", "real_median_household_income");
  const points = series.map((p) => [Number(p.period.slice(0, 4)), p.value] as [number, number]);
  return points.length > 1 ? { points } : null;
}

function societyPreview(): NavPreviews["society"] {
  const series = getDemographicSeries("race");
  if (series.points.length < 2) return null;
  const years: [number, number] = [series.points[0].year, series.points.at(-1)!.year];
  return {
    years,
    observedThrough: series.observedThrough,
    lines: RACE_LINES.flatMap((id) => {
      const category = series.categories.find((c) => c.id === id);
      if (!category) return [];
      return [{
        label: category.label,
        color: category.color,
        points: series.points.map((p) => [p.year, p.values[id] ?? 0] as [number, number]),
      }];
    }),
  };
}

function powerPreview(): NavPreviews["power"] {
  return {
    total: relationshipTypes.length,
    categories: relationshipCategories.map((c) => ({
      label: c.charAt(0).toUpperCase() + c.slice(1),
      count: relationshipTypes.filter((t) => t.category === c).length,
    })),
  };
}

// The closest Senate and governor races in the midterm, called or not. One
// query per server process, refreshed hourly so new calls reach the menu.
const GOVERNMENT_TTL_MS = 60 * 60 * 1000;
const HIGHLIGHTS_PER_OFFICE = 4;
let governmentCache: Promise<NavPreviews["government"]> | null = null;
let governmentCachedAt = 0;

async function governmentPreview(): Promise<NavPreviews["government"]> {
  const [senate, governor] = await Promise.all([listRaces(MIDTERM_YEAR, "senate"), listRaces(MIDTERM_YEAR, "governor")]);
  const closest = (races: RaceSummary[], office: MidtermHighlight["office"]): MidtermHighlight[] =>
    races
      .filter((race) => race.result?.marginPct != null)
      .sort((a, b) => a.result!.marginPct! - b.result!.marginPct!)
      .slice(0, HIGHLIGHTS_PER_OFFICE)
      .map((race) => ({
        office,
        state: race.code + (race.special ? " special" : ""),
        party: race.result!.winnerParty,
        marginPct: race.result!.marginPct!,
        called: race.result!.called,
        note: `${race.result!.winnerName} ${race.result!.called ? "won" : "leading"}`,
      }));
  const highlights = [...closest(senate, "Senate"), ...closest(governor, "Governor")];
  if (highlights.length === 0) return null;
  const asOf = [...senate, ...governor].map((race) => race.resultsAsOf ?? "").sort().at(-1) ?? "";
  return { year: MIDTERM_YEAR, electionDate: "2026-11-03", asOf: asOf.slice(0, 10), highlights };
}

export async function getNavPreviews(): Promise<NavPreviews> {
  if (!governmentCache || Date.now() - governmentCachedAt > GOVERNMENT_TTL_MS) {
    governmentCachedAt = Date.now();
    // An empty result (no votes loaded yet) is not kept, so results appear on
    // the next render rather than an hour later.
    governmentCache = governmentPreview()
      .catch(() => null)
      .then((preview) => {
        if (!preview) governmentCache = null;
        return preview;
      });
  }
  issuesCache ??= issuesPreview().catch(() => {
    issuesCache = null;
    return null;
  });
  economyCache ??= economyPreview().catch(() => {
    economyCache = null;
    return null;
  });
  return {
    issues: await issuesCache,
    economy: await economyCache,
    society: societyPreview(),
    power: powerPreview(),
    government: await governmentCache,
    tools: QUIZ_AXES.map((id) => ({
      name: axisById[id].name,
      negative: axisById[id].negative.label,
      positive: axisById[id].positive.label,
    })),
  };
}
