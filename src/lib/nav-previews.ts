// Real data behind the header's mega-menu feature cards: one small, cheap,
// file-backed glimpse of each section. Server-only (reads the repo's data
// files); the shell layout computes it and hands it to the client header.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSeries } from "./db/stats";
import { getDemographicSeries } from "./demographics/forecast";
import { relationshipCategories, relationshipTypes } from "./relationships";
import { axisById } from "./quiz/axes";
import type { AxisId } from "./quiz/types";

export type MidtermRating = "tossup" | "lean_d" | "lean_r";

export interface MidtermHighlight {
  office: "Senate" | "Governor";
  state: string;
  rating: MidtermRating;
  note: string;
}

export interface NavPreviews {
  // Foreign-born share of the population: each census, then the ACS.
  issues: { points: [number, number][] } | null;
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

// The most competitive Senate and governor races in the current ratings
// snapshot. Parsed once per server process; the source file changes when the
// ratings import is refreshed.
let governmentCache: Promise<NavPreviews["government"]> | null = null;

async function governmentPreview(): Promise<NavPreviews["government"]> {
  const file = await readFile(path.join(process.cwd(), `data/elections/${MIDTERM_YEAR}-ratings.csv`), "utf8");
  const highlights: MidtermHighlight[] = [];
  let asOf = "";
  for (const line of file.split("\n")) {
    if (!line || line.startsWith("#") || line.startsWith("office,")) continue;
    const [office, rawState, rating, , date, ...note] = line.trim().split(",");
    if (
      (office !== "senate" && office !== "governor") ||
      (rating !== "tossup" && rating !== "lean_d" && rating !== "lean_r")
    ) continue;
    highlights.push({
      office: office === "senate" ? "Senate" : "Governor",
      state: rawState.replace(":special", " special"),
      rating,
      note: note.join(",").trim(),
    });
    if (date > asOf) asOf = date;
  }
  if (highlights.length === 0) return null;
  return {
    year: MIDTERM_YEAR,
    electionDate: "2026-11-03",
    asOf,
    highlights,
  };
}

export async function getNavPreviews(): Promise<NavPreviews> {
  governmentCache ??= governmentPreview().catch(() => {
    governmentCache = null;
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
    government: await governmentCache,
    tools: QUIZ_AXES.map((id) => ({
      name: axisById[id].name,
      negative: axisById[id].negative.label,
      positive: axisById[id].positive.label,
    })),
  };
}
