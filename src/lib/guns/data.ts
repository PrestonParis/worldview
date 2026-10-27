// Everything /guns shows: firearm deaths by intent (CDC: final 1999–2016 data
// and the 2019-onward injury dashboard), deaths by age, gun ownership
// (Gallup), and the states — all from area_stats.

import { getCrossSection, getSeriesMany, type Point } from "@/lib/db/stats";
import { datasetsFor, last, stateTable, toPoints } from "@/lib/issues/series";
import type { RankedItem } from "@/components/charts/ranked-bars";
import type { Series } from "@/components/charts/time-series-chart";

const OLD = "cdc-injury-mortality";
const NEW = "cdc-violent-deaths";
const GALLUP = "gallup-guns";

const INTENTS = ["firearm_deaths", "firearm_suicide_deaths", "firearm_homicide_deaths", "firearm_deaths_rate", "firearm_suicide_rate", "firearm_homicide_rate"] as const;
const AGE_ORDER = ["< 15", "15–24", "25–44", "45–64", "65–74", "75+"];

// The two CDC sources joined; 2017–2018 are in neither, so charts break the
// line there (gapOver) instead of drawing across it.
const joined = (a: Point[], b: Point[]) => [...a, ...b.filter((p) => !a.some((q) => q.period === p.period))];

export async function loadGuns() {
  const [old, now, homicides, gallup] = await Promise.all([
    getSeriesMany(OLD, [...INTENTS, "firearm_unintentional_deaths", "firearm_undetermined_deaths", "firearm_legal_intervention_deaths"]),
    getSeriesMany(NEW, [...INTENTS]),
    getSeriesMany(NEW, ["homicide_deaths"]),
    getSeriesMany(GALLUP, ["gun_in_home", "personally_own_gun", "laws_more_strict"]),
  ]);
  if (!old.firearm_deaths.length && !now.firearm_deaths.length) return null;
  const s = Object.fromEntries(INTENTS.map((m) => [m, joined(old[m], now[m])])) as Record<(typeof INTENTS)[number], Point[]>;

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

  // ---- Ownership ----
  const ownership: Series[] = [
    { id: "home", label: "Gun in the home", slot: 1, points: toPoints(gallup.gun_in_home) },
    { id: "own", label: "Personally own a gun", slot: 2, points: toPoints(gallup.personally_own_gun) },
  ];

  // ---- States ----
  const states = await stateTable([
    { source: NEW, metric: "firearm_deaths_rate", label: "Firearm deaths per 100,000", unit: "per_100k", group: "All intents", sourceLabel: "CDC NCHS" },
    { source: NEW, metric: "firearm_deaths", label: "Firearm deaths", unit: "deaths", group: "All intents", sourceLabel: "CDC NCHS" },
    { source: NEW, metric: "firearm_suicide_rate", label: "Firearm suicides per 100,000", unit: "per_100k", group: "By intent", sourceLabel: "CDC NCHS" },
    { source: NEW, metric: "firearm_homicide_rate", label: "Firearm homicides per 100,000", unit: "per_100k", group: "By intent", sourceLabel: "CDC NCHS" },
    { source: NEW, metric: "firearm_deaths_rate_ttm", label: "Firearm deaths per 100,000, last 12 months", unit: "per_100k", group: "All intents", sourceLabel: "CDC NCHS (provisional)" },
  ]);

  // ---- Headline ----
  const total = last(s.firearm_deaths);
  const sui = last(s.firearm_suicide_deaths);
  const home = last(gallup.gun_in_home);
  const strict = last(gallup.laws_more_strict);
  const headline = {
    deaths: { point: total, spark: s.firearm_deaths.map((p) => p.value) },
    suicideShare: total && sui && sui.period === total.period ? { value: (sui.value / total.value) * 100, period: total.period } : null,
    home: { point: home, spark: gallup.gun_in_home.slice(-20).map((p) => p.value) },
    strict: { point: strict, spark: gallup.laws_more_strict.slice(-20).map((p) => p.value) },
  };

  return {
    headline,
    deaths,
    rates,
    byAge,
    ageYear: ages.period,
    gunShare,
    ownership,
    states,
    datasets: await datasetsFor([NEW, OLD, GALLUP]),
  };
}
