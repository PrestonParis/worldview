// The population characteristics /demographics shows below the forecast
// explorer: language spoken at home, education, income and poverty (ACS
// 1-year), and urban vs. rural (decennial census) — from area_stats.

import { getCrossSection, getSeriesMany, type Point } from "@/lib/db/stats";
import { STATES_51 } from "@/lib/geo/states";
import type { StateMetric, StateRow } from "@/components/charts/state-explorer";
import type { Series, SeriesPoint } from "@/components/charts/time-series-chart";

const SOCIAL = "census-acs1-social";
const URBAN = "census-urban-rural";

const annual = (points: Point[] | undefined): SeriesPoint[] => (points ?? []).map((p) => ({ x: Number(p.period), label: p.period, value: p.value }));

const STATE_METRICS: [key: string, source: string, label: string, unit: string, group: string, description?: string][] = [
  ["english_only_share", SOCIAL, "Speak only English at home", "percent", "Language", "People 5 and over."],
  ["spanish_share", SOCIAL, "Speak Spanish at home", "percent", "Language"],
  ["other_language_share", SOCIAL, "Speak another language at home", "percent", "Language", "A language other than English or Spanish."],
  ["limited_english_share", SOCIAL, "Speak English less than very well", "percent", "Language"],
  ["hs_plus_share", SOCIAL, "High school graduate or more", "percent", "Education", "People 25 and over."],
  ["bachelors_plus_share", SOCIAL, "Bachelor's degree or more", "percent", "Education", "People 25 and over."],
  ["median_household_income", SOCIAL, "Median household income", "usd", "Income"],
  ["poverty_rate", SOCIAL, "Below the poverty line", "percent", "Income"],
  ["urban_share", URBAN, "Living in urban areas", "percent", "Urban and rural", "2020 census; the urban definition changed in 2020."],
];

export async function loadPopulationProfile() {
  const [social, urban] = await Promise.all([
    getSeriesMany(SOCIAL, ["english_only_share", "spanish_share", "other_language_share", "limited_english_share", "hs_plus_share", "bachelors_plus_share", "median_household_income", "poverty_rate"]),
    getSeriesMany(URBAN, ["urban_share", "urban_population", "rural_population"]),
  ]);
  if (!social.english_only_share.length && !urban.urban_share.length) return null;

  const language: Series[] = [
    { id: "spanish", label: "Spanish", slot: 1, points: annual(social.spanish_share) },
    { id: "other", label: "Another language", slot: 3, points: annual(social.other_language_share) },
    { id: "limited", label: "Speak English less than very well", slot: 2, points: annual(social.limited_english_share) },
  ];
  const education: Series[] = [
    { id: "hs", label: "High school or more", slot: 1, points: annual(social.hs_plus_share) },
    { id: "ba", label: "Bachelor's degree or more", slot: 3, points: annual(social.bachelors_plus_share) },
  ];
  const income: Series[] = [{ id: "income", label: "Median household income (nominal dollars)", slot: 1, points: annual(social.median_household_income) }];
  const poverty: Series[] = [{ id: "poverty", label: "Below the poverty line", slot: 2, points: annual(social.poverty_rate) }];
  const urbanRural: Series[] = [
    { id: "urban", label: "Urban", slot: 1, points: annual(urban.urban_population) },
    { id: "rural", label: "Rural", slot: 3, points: annual(urban.rural_population) },
  ];

  const cross = await Promise.all(STATE_METRICS.map(([key, source]) => getCrossSection(source, key, "state")));
  const metrics: StateMetric[] = STATE_METRICS.map(([key, , label, unit, group, description], i) => ({
    key, label, unit, group, period: cross[i].period ?? "", source: group === "Urban and rural" ? "Decennial census" : "American Community Survey 1-year",
    ...(description ? { description } : {}),
  }));
  const maps = cross.map((c) => new Map(c.values.map((v) => [v.geoid, v.value])));
  const rows: StateRow[] = STATES_51.map((s) => ({
    abbr: s.abbr,
    name: s.name,
    values: Object.fromEntries(STATE_METRICS.map(([key], i) => [key, maps[i].get(s.fips) ?? null])),
  }));

  const latest = (p: Point[]) => p.at(-1) ?? null;
  return {
    tiles: {
      englishOnly: latest(social.english_only_share),
      limited: latest(social.limited_english_share),
      bachelors: latest(social.bachelors_plus_share),
      income: latest(social.median_household_income),
      poverty: latest(social.poverty_rate),
      urban: latest(urban.urban_share),
    },
    language,
    education,
    income,
    poverty,
    urbanRural,
    states: { metrics, rows },
  };
}
