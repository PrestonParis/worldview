// The race, ethnicity, age, ancestry and LGBTQ+ sections of /demographics:
// Census population estimates by race and Hispanic origin (1990–),
// the 2023 national projections, ACS ancestry, and Gallup's LGBTQ+ release —
// all from area_stats.

import { getCrossSection, getSeriesMany, queryObservations, type Point } from "@/lib/db/stats";
import { STATES_51 } from "@/lib/geo/states";
import { toPoints } from "@/lib/issues/series";
import type { RankedItem } from "@/components/charts/ranked-bars";
import type { StateMetric, StateRow } from "@/components/charts/state-explorer";
import type { Series } from "@/components/charts/time-series-chart";

const RACE = "census-pep-race";
const PROJ = "census-projections";
const ANCESTRY = "census-acs1-ancestry";
const LGBT = "gallup-lgbt";

const GROUPS = [
  ["white_nh", "White, non-Hispanic", 1],
  ["hispanic", "Hispanic", 2],
  ["black_nh", "Black, non-Hispanic", 3],
  ["asian_nh", "Asian, non-Hispanic", 4],
  ["multiracial_nh", "Two or more races, non-Hispanic", 5],
] as const;

const STATE_METRICS: [key: string, label: string, unit: string, group: string, description?: string][] = [
  ["share_white_nh", "White, non-Hispanic", "percent", "Race and Hispanic origin"],
  ["share_hispanic", "Hispanic", "percent", "Race and Hispanic origin", "Hispanics may be of any race."],
  ["share_black_nh", "Black, non-Hispanic", "percent", "Race and Hispanic origin"],
  ["share_asian_nh", "Asian, non-Hispanic", "percent", "Race and Hispanic origin"],
  ["share_aian_nh", "American Indian and Alaska Native, non-Hispanic", "percent", "Race and Hispanic origin"],
  ["share_multiracial_nh", "Two or more races, non-Hispanic", "percent", "Race and Hispanic origin"],
  ["median_age", "Median age", "years", "Age"],
  ["share_under_18", "Under 18", "percent", "Age"],
  ["share_65_plus", "65 and over", "percent", "Age"],
];
// Change in share since 2010, in percentage points.
const CHANGE_METRICS = ["share_white_nh", "share_hispanic"] as const;

const LGBT_GROUPS: [section: string, ids: string[]][] = [
  ["Age", ["age_18_29", "age_30_49", "age_50_64", "age_65_plus"]],
  ["Party", ["party_identification_democrat", "party_identification_independent", "party_identification_republican"]],
  ["Place", ["place_of_residence_city_resident", "place_of_residence_suburban_resident", "place_of_residence_town_rural_resident"]],
];

const last = (p: Point[] | undefined) => p?.at(-1) ?? null;

export async function loadRaceProfile() {
  const shares = GROUPS.map(([g]) => `share_${g}`);
  const medians = ["median_age", "median_age_hispanic", "median_age_white_nh", "median_age_black_nh", "median_age_asian_nh"];
  const [race, proj, lgbt] = await Promise.all([
    getSeriesMany(RACE, [...shares, ...medians, "share_65_plus", "share_under_18"]),
    getSeriesMany(PROJ, [...shares, "share_white_nh_low", "share_white_nh_high", "share_white_nh_zero", "majority_minority_year", "majority_minority_year_low", "majority_minority_year_high", "median_age"]),
    getSeriesMany(LGBT, ["lgbtq_total", "lesbian", "gay", "bisexual", "transgender"]),
  ]);
  if (!race.share_white_nh?.length) return null;

  const composition: Series[] = GROUPS.map(([g, label, slot]) => ({ id: g, label, slot, points: toPoints(race[`share_${g}`]) }));
  // Projections pick up after the latest estimate.
  const lastEstimate = Number(last(race.share_white_nh)?.period ?? 0);
  const projected: Series[] = GROUPS.map(([g, label, slot]) => ({
    id: g, label, slot, points: toPoints(proj[`share_${g}`]).filter((p) => p.x >= lastEstimate),
  }));
  const scenarios = ([
    { id: "mid", label: "Main series", slot: 1, points: toPoints(proj.share_white_nh) },
    { id: "high", label: "High immigration", slot: 2, points: toPoints(proj.share_white_nh_high) },
    { id: "low", label: "Low immigration", slot: 3, points: toPoints(proj.share_white_nh_low) },
    { id: "zero", label: "Zero immigration", slot: 4, points: toPoints(proj.share_white_nh_zero) },
  ] satisfies Series[]).filter((s) => s.points.length);
  const medianAge: Series[] = [
    { id: "all", label: "All", slot: 9, points: toPoints(race.median_age) },
    { id: "white_nh", label: "White, non-Hispanic", slot: 1, points: toPoints(race.median_age_white_nh) },
    { id: "asian_nh", label: "Asian, non-Hispanic", slot: 4, points: toPoints(race.median_age_asian_nh) },
    { id: "black_nh", label: "Black, non-Hispanic", slot: 3, points: toPoints(race.median_age_black_nh) },
    { id: "hispanic", label: "Hispanic", slot: 2, points: toPoints(race.median_age_hispanic) },
  ];

  // States: latest shares and ages, plus change since 2010.
  const cross = await Promise.all(STATE_METRICS.map(([key]) => getCrossSection(RACE, key, "state")));
  const base = await Promise.all(CHANGE_METRICS.map((key) => getCrossSection(RACE, key, "state", { period: "2010" })));
  const latestPeriod = cross[0].period ?? "";
  const metrics: StateMetric[] = [
    ...STATE_METRICS.map(([key, label, unit, group, description], i) => ({
      key, label, unit, group, period: cross[i].period ?? "", source: "Census population estimates", ...(description ? { description } : {}),
    })),
    ...CHANGE_METRICS.map((key) => ({
      key: `${key}_change`,
      label: `${STATE_METRICS.find(([k]) => k === key)![1]}, change since 2010`,
      unit: "points",
      group: "Change since 2010",
      period: `2010–${latestPeriod}`,
      source: "Census population estimates",
      description: "Percentage points.",
    })),
  ];
  const maps = cross.map((c) => new Map(c.values.map((v) => [v.geoid, v.value])));
  const baseMaps = base.map((c) => new Map(c.values.map((v) => [v.geoid, v.value])));
  const rows: StateRow[] = STATES_51.map((s) => {
    const values: Record<string, number | null> = Object.fromEntries(STATE_METRICS.map(([key], i) => [key, maps[i].get(s.fips) ?? null]));
    CHANGE_METRICS.forEach((key, i) => {
      const now = values[key];
      const then = baseMaps[i].get(s.fips);
      values[`${key}_change`] = now !== null && then !== undefined ? Math.round((now - then) * 10) / 10 : null;
    });
    return { abbr: s.abbr, name: s.name, values };
  });

  const [ancestry, hispanicOrigin] = await Promise.all([topNational("ancestry_"), topNational("hispanic_origin_")]);

  // LGBTQ+ by subgroup, latest year.
  const lgbtGroups = await getCrossSection(LGBT, "lgbtq_total", "group");
  const lgbtByGroup = LGBT_GROUPS.map(([section, ids]) => ({
    section,
    items: ids.flatMap((id) => {
      const v = lgbtGroups.values.find((x) => x.geoid === id);
      return v ? [{ label: (v.geoName ?? id).replace(/^[^:]+: /, "").replace(/ years old$/, ""), value: v.value }] : [];
    }),
  }));
  const lgbtTrend: Series[] = [
    { id: "total", label: "LGBTQ+ (total)", slot: 1, points: toPoints(lgbt.lgbtq_total) },
    { id: "bisexual", label: "Bisexual", slot: 2, points: toPoints(lgbt.bisexual) },
    { id: "gay", label: "Gay", slot: 3, points: toPoints(lgbt.gay) },
    { id: "lesbian", label: "Lesbian", slot: 4, points: toPoints(lgbt.lesbian) },
    { id: "transgender", label: "Transgender", slot: 5, points: toPoints(lgbt.transgender) },
  ];

  return {
    tiles: {
      whiteNh: last(race.share_white_nh),
      hispanic: last(race.share_hispanic),
      whiteNh1990: race.share_white_nh[0] ?? null,
      crossover: last(proj.majority_minority_year),
      crossoverHigh: last(proj.majority_minority_year_high),
      crossoverLow: last(proj.majority_minority_year_low),
      medianAge: last(race.median_age),
      medianAgeHispanic: last(race.median_age_hispanic),
      medianAgeWhiteNh: last(race.median_age_white_nh),
      over65: last(race.share_65_plus),
      lgbtq: last(lgbt.lgbtq_total),
    },
    lgbtGroupsPeriod: lgbtGroups.period,
    composition,
    projected,
    scenarios,
    medianAge,
    states: { metrics, rows },
    ancestry,
    hispanicOrigin,
    lgbtTrend,
    lgbtByGroup,
  };
}

// Group subtotals and catch-alls, left out of the rankings so a subgroup
// isn't counted twice.
const SUBTOTALS = new Set([
  "arab", "subsaharan_african", "west_indian_total", "central_american", "south_american", "other_hispanic_or_latino",
  "other_groups", "unclassified_or_not_reported", "all_other_hispanic_or_latino",
]);

// Latest-year national shares for one prefix's groups, largest first.
async function topNational(prefix: "ancestry_" | "hispanic_origin_"): Promise<{ period: string | null; items: RankedItem[] }> {
  const probe = await getCrossSection(ANCESTRY, prefix === "ancestry_" ? "ancestry_german" : "hispanic_origin_mexican", "nation");
  if (!probe.period) return { period: null, items: [] };
  const rows = await queryObservations({ dataset: ANCESTRY, geoLevel: "nation", from: probe.period, to: probe.period, limit: 1000, offset: 0 });
  const items = rows
    .filter((r) => r.metric.startsWith(prefix) && !r.metric.endsWith("_count") && !SUBTOTALS.has(r.metric.slice(prefix.length)))
    .flatMap((r) => (r.value === null ? [] : [{ label: labelOf(r.metric.slice(prefix.length)), value: r.value }]))
    .sort((a, b) => b.value - a.value);
  return { period: probe.period, items };
}

const LABELS: Record<string, string> = {
  dominican: "Dominican", french: "French", scotch_irish: "Scotch-Irish", assyrian_chaldean_syriac: "Assyrian/Chaldean/Syriac",
  u_s_virgin_islander: "U.S. Virgin Islander", trinidadian_and_tobagonian: "Trinidadian and Tobagonian",
};
const labelOf = (slug: string) => LABELS[slug] ?? slug.split("_").map((w) => (w === "and" ? w : w[0].toUpperCase() + w.slice(1))).join(" ");
