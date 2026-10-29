// Everything /guns shows: firearm deaths by intent (CDC final and provisional
// sources), deaths by age, gun ownership and policy opinion (Gallup), and the
// states — all from area_stats, with the two missing bridge years supplied
// from CDC's final annual mortality tables.

import { getCrossSection, getSeriesMany, type Point } from "@/lib/db/stats";
import { datasetsFor, last, stateTable, toPoints } from "@/lib/issues/series";
import type { RankedItem } from "@/components/charts/ranked-bars";
import type { Series } from "@/components/charts/time-series-chart";

const OLD = "cdc-injury-mortality";
const NEW = "cdc-violent-deaths";
const GALLUP = "gallup-guns";

const INTENTS = [
  "firearm_deaths",
  "firearm_suicide_deaths",
  "firearm_homicide_deaths",
  "firearm_deaths_rate",
  "firearm_suicide_rate",
  "firearm_homicide_rate",
] as const;
const AGE_ORDER = ["< 15", "15–24", "25–44", "45–64", "65–74", "75+"];

const joined = (a: Point[], b: Point[]) => [...a, ...b.filter((p) => !a.some((q) => q.period === p.period))];

// CDC's discontinued injury table ends in 2016. The newer dashboard has not
// always exposed 2017–2018 through the same export. These final counts and
// crude rates come from NCHS's final 2017 and 2018 mortality tables. Only fill
// a point when neither imported source already has it.
const BRIDGE: Record<(typeof INTENTS)[number], readonly [number, number]> = {
  firearm_deaths: [39_773, 39_740],
  firearm_suicide_deaths: [23_854, 24_432],
  firearm_homicide_deaths: [14_542, 13_958],
  firearm_deaths_rate: [12.2, 12.1],
  firearm_suicide_rate: [7.3, 7.5],
  firearm_homicide_rate: [4.5, 4.3],
};

const bridgeYears = (metric: (typeof INTENTS)[number], points: Point[]) =>
  ["2017", "2018"]
    .reduce<Point[]>((out, period, i) => {
      if (out.some((p) => p.period === period)) return out;
      return [
        ...out,
        {
          period,
          periodStart: `${period}-01-01`,
          value: BRIDGE[metric][i],
          metadata: { final: true, bridge: true },
        },
      ];
    }, points)
    .sort((a, b) => (a.periodStart ?? a.period).localeCompare(b.periodStart ?? b.period));

export async function loadGuns() {
  const [old, now, homicides, gallup] = await Promise.all([
    getSeriesMany(OLD, [
      ...INTENTS,
      "firearm_unintentional_deaths",
      "firearm_undetermined_deaths",
      "firearm_legal_intervention_deaths",
    ]),
    getSeriesMany(NEW, [...INTENTS]),
    getSeriesMany(NEW, ["homicide_deaths"]),
    getSeriesMany(GALLUP, [
      "gun_in_home",
      "personally_own_gun",
      "laws_more_strict",
      "laws_less_strict",
      "laws_kept_as_now",
      "ban_handguns",
      "ban_assault_rifles",
    ]),
  ]);
  if (!old.firearm_deaths.length && !now.firearm_deaths.length) return null;
  const s = Object.fromEntries(INTENTS.map((m) => [m, bridgeYears(m, joined(old[m], now[m]))])) as Record<
    (typeof INTENTS)[number],
    Point[]
  >;

  // ---- Deaths ----
  const deaths: Series[] = [
    { id: "all", label: "All firearm deaths", slot: 1, points: toPoints(s.firearm_deaths) },
    { id: "suicide", label: "Suicides", slot: 2, points: toPoints(s.firearm_suicide_deaths) },
    { id: "homicide", label: "Homicides", slot: 3, points: toPoints(s.firearm_homicide_deaths) },
  ];
  const rates: Series[] = [
    { id: "all", label: "All firearm deaths", slot: 1, points: toPoints(s.firearm_deaths_rate) },
    { id: "suicide", label: "Suicides", slot: 2, points: toPoints(s.firearm_suicide_rate) },
    { id: "homicide", label: "Homicides", slot: 3, points: toPoints(s.firearm_homicide_rate) },
  ];

  const ages = await getCrossSection(OLD, "firearm_deaths_rate_by_age", "age_group");
  const byAge: RankedItem[] = AGE_ORDER.flatMap((g) => {
    const v = ages.values.find((a) => a.geoid === g);
    return v ? [{ label: g === "< 15" ? "Under 15" : g, value: v.value }] : [];
  });

  // Share of all homicides committed with a gun (2019 on).
  const share = now.firearm_homicide_deaths.flatMap((p) => {
    const all = homicides.homicide_deaths.find((q) => q.period === p.period);
    return all ? [{ ...p, value: (p.value / all.value) * 100 }] : [];
  });
  const gunShare: Series[] = [{ id: "share", label: "Homicides by firearm", slot: 3, points: toPoints(share) }];

  // Complete final intent detail for the latest bridge year. The three major
  // intents above continue into the newer dashboard; these small categories
  // are kept visible without pretending the sources have equal freshness.
  const intentBreakdown: RankedItem[] = [
    { label: "Suicide", value: 24_432 },
    { label: "Homicide", value: 13_958 },
    { label: "Legal intervention / war", value: 539 },
    { label: "Unintentional", value: 458 },
    { label: "Undetermined", value: 353 },
  ];

  // ---- Ownership ----
  const ownership: Series[] = [
    { id: "home", label: "Gun in the home", slot: 1, points: toPoints(gallup.gun_in_home) },
    { id: "own", label: "Personally own a gun", slot: 2, points: toPoints(gallup.personally_own_gun) },
  ];
  const opinion: Series[] = [
    { id: "more", label: "More strict", slot: 1, points: toPoints(gallup.laws_more_strict) },
    { id: "same", label: "Kept as now", slot: 2, points: toPoints(gallup.laws_kept_as_now) },
    { id: "less", label: "Less strict", slot: 3, points: toPoints(gallup.laws_less_strict) },
  ];

  // ---- States ----
  const states = await stateTable([
    {
      source: NEW,
      metric: "firearm_deaths_rate",
      label: "Firearm deaths per 100,000",
      unit: "per_100k",
      group: "All intents",
      sourceLabel: "CDC NCHS",
    },
    {
      source: NEW,
      metric: "firearm_deaths",
      label: "Firearm deaths",
      unit: "deaths",
      group: "All intents",
      sourceLabel: "CDC NCHS",
    },
    {
      source: NEW,
      metric: "firearm_suicide_rate",
      label: "Firearm suicides per 100,000",
      unit: "per_100k",
      group: "By intent",
      sourceLabel: "CDC NCHS",
    },
    {
      source: NEW,
      metric: "firearm_homicide_rate",
      label: "Firearm homicides per 100,000",
      unit: "per_100k",
      group: "By intent",
      sourceLabel: "CDC NCHS",
    },
    {
      source: NEW,
      metric: "firearm_deaths_rate_ttm",
      label: "Firearm deaths per 100,000, last 12 months",
      unit: "per_100k",
      group: "All intents",
      sourceLabel: "CDC NCHS (provisional)",
    },
  ]);

  // ---- Headline ----
  const total = last(s.firearm_deaths);
  const sui = last(s.firearm_suicide_deaths);
  const home = last(gallup.gun_in_home);
  const own = last(gallup.personally_own_gun);
  const strict = last(gallup.laws_more_strict);
  const headline = {
    deaths: { point: total, spark: s.firearm_deaths.map((p) => p.value) },
    suicideShare:
      total && sui && sui.period === total.period
        ? { value: (sui.value / total.value) * 100, period: total.period }
        : null,
    home: { point: home, spark: gallup.gun_in_home.slice(-20).map((p) => p.value) },
    own: { point: own, spark: gallup.personally_own_gun.slice(-20).map((p) => p.value) },
    strict: { point: strict, spark: gallup.laws_more_strict.slice(-20).map((p) => p.value) },
  };

  return {
    headline,
    deaths,
    rates,
    byAge,
    ageYear: ages.period,
    gunShare,
    intentBreakdown,
    ownership,
    opinion,
    states,
    datasets: await datasetsFor([NEW, OLD, GALLUP]),
  };
}
