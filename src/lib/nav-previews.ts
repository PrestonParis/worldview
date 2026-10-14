// Real data behind the header's mega-menu feature cards: one small, cheap,
// file-backed glimpse of each section. Server-only (reads the repo's data
// files); the shell layout computes it and hands it to the client header.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSeries } from "./db/stats";
import { getDemographicSeries } from "./demographics/forecast";
import { US_STATE_GRID } from "./money/us-states";
import { relationshipCategories, relationshipTypes } from "./relationships";
import { axisById } from "./quiz/axes";
import type { AxisId } from "./quiz/types";

export interface NavPreviews {
  // Foreign-born share of the population: each census, then the ACS.
  issues: { points: [number, number][] } | null;
  society: {
    years: [number, number];
    observedThrough: number;
    lines: { label: string; color: string; points: [number, number][] }[];
  } | null;
  power: { total: number; categories: { label: string; count: number }[] };
  democracy: { year: number; states: { abbr: string; row: number; col: number; winner: "D" | "R" | null }[] } | null;
  tools: { name: string; negative: string; positive: string }[];
}

const RACE_LINES = ["nhWhite", "hispanic"];
const RESULTS_YEAR = 2024;
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

// Winner per state from the MIT Election Lab file. Parsed once per server
// process; the file only changes with a new election.
let democracyCache: Promise<NavPreviews["democracy"]> | null = null;

async function democracyPreview(): Promise<NavPreviews["democracy"]> {
  const file = await readFile(path.join(process.cwd(), "data/elections/1976-2024-president.csv"), "utf8");
  const best = new Map<string, { votes: number; party: string }>();
  for (const line of file.split("\n").slice(1)) {
    if (!line.startsWith(`${RESULTS_YEAR},`)) continue;
    // Candidate names are quoted and may contain commas, so read state_po from
    // the front and candidatevotes / party_simplified from the back.
    const cols = line.trim().split(",");
    const abbr = cols[2];
    const party = cols.at(-1) ?? "";
    const votes = Number(cols.at(-5));
    if (!abbr || !Number.isFinite(votes)) continue;
    const prev = best.get(abbr);
    if (!prev || votes > prev.votes) best.set(abbr, { votes, party });
  }
  if (best.size === 0) return null;
  return {
    year: RESULTS_YEAR,
    states: US_STATE_GRID.map((c) => {
      const party = best.get(c.abbr)?.party;
      return { abbr: c.abbr, row: c.row, col: c.col, winner: party === "DEMOCRAT" ? "D" : party === "REPUBLICAN" ? "R" : null };
    }),
  };
}

export async function getNavPreviews(): Promise<NavPreviews> {
  democracyCache ??= democracyPreview().catch(() => {
    democracyCache = null;
    return null;
  });
  issuesCache ??= issuesPreview().catch(() => {
    issuesCache = null;
    return null;
  });
  return {
    issues: await issuesCache,
    society: societyPreview(),
    power: powerPreview(),
    democracy: await democracyCache,
    tools: QUIZ_AXES.map((id) => ({
      name: axisById[id].name,
      negative: axisById[id].negative.label,
      positive: axisById[id].positive.label,
    })),
  };
}
