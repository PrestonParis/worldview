// Everything /guns shows: firearm deaths by intent (CDC: final 1999–2016 data
// and the 2019-onward injury dashboard), deaths by age, gun ownership and
// opinion on gun laws (Gallup), and the states — all from area_stats.

import { getCrossSection, getSeriesMany, type Point } from "@/lib/db/stats";
import { formatValue } from "@/lib/format";
import { datasetsFor, last, rankStates, stateTable, toPoints } from "@/lib/issues/series";
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
    getSeriesMany(GALLUP, ["gun_in_home", "personally_own_gun", "laws_more_strict", "laws_less_strict", "laws_kept_as_now", "ban_handguns", "ban_assault_rifles"]),
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

  // Intent breakdown for the last year of final data (the newer source has
  // only suicide and homicide).
  const lastOld = last(old.firearm_deaths);
  const at = (pts: Point[]) => pts.find((p) => p.period === lastOld?.period)?.value ?? null;
  const intentItems: RankedItem[] = (
    [
      ["Suicide", at(old.firearm_suicide_deaths)],
      ["Homicide", at(old.firearm_homicide_deaths)],
      ["Unintentional", at(old.firearm_unintentional_deaths)],
      ["Undetermined", at(old.firearm_undetermined_deaths)],
      ["Legal intervention", at(old.firearm_legal_intervention_deaths)],
    ] as const
  ).flatMap(([label, value]) => (value === null ? [] : [{ label, value }]));

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

  // ---- Ownership and opinion ----
  const ownership: Series[] = [
    { id: "home", label: "Gun in the home", slot: 1, points: toPoints(gallup.gun_in_home) },
    { id: "own", label: "Personally own a gun", slot: 2, points: toPoints(gallup.personally_own_gun) },
  ];
  const laws: Series[] = [
    { id: "more", label: "More strict", slot: 1, points: toPoints(gallup.laws_more_strict) },
    { id: "same", label: "Kept as now", slot: 3, points: toPoints(gallup.laws_kept_as_now) },
    { id: "less", label: "Less strict", slot: 2, points: toPoints(gallup.laws_less_strict) },
  ];
  const bans: Series[] = [{ id: "handguns", label: "Ban handguns except for police", slot: 2, points: toPoints(gallup.ban_handguns) }];
  const assault = last(gallup.ban_assault_rifles);

  // ---- States ----
  const states = await stateTable([
    { source: NEW, metric: "firearm_deaths_rate", label: "Firearm deaths per 100,000", unit: "per_100k", group: "All intents", sourceLabel: "CDC NCHS" },
    { source: NEW, metric: "firearm_deaths", label: "Firearm deaths", unit: "deaths", group: "All intents", sourceLabel: "CDC NCHS" },
    { source: NEW, metric: "firearm_suicide_rate", label: "Firearm suicides per 100,000", unit: "per_100k", group: "By intent", sourceLabel: "CDC NCHS" },
    { source: NEW, metric: "firearm_homicide_rate", label: "Firearm homicides per 100,000", unit: "per_100k", group: "By intent", sourceLabel: "CDC NCHS" },
    { source: NEW, metric: "firearm_deaths_rate_ttm", label: "Firearm deaths per 100,000, last 12 months", unit: "per_100k", group: "All intents", sourceLabel: "CDC NCHS (provisional)" },
  ]);

  // ---- Headline + findings ----
  const total = last(s.firearm_deaths);
  const sui = last(s.firearm_suicide_deaths);
  const hom = last(s.firearm_homicide_deaths);
  const home = last(gallup.gun_in_home);
  const strict = last(gallup.laws_more_strict);
  const headline = {
    deaths: { point: total, spark: s.firearm_deaths.map((p) => p.value) },
    suicideShare: total && sui && sui.period === total.period ? { value: (sui.value / total.value) * 100, period: total.period } : null,
    home: { point: home, spark: gallup.gun_in_home.slice(-20).map((p) => p.value) },
    strict: { point: strict, spark: gallup.laws_more_strict.slice(-20).map((p) => p.value) },
  };

  const findings: string[] = [];
  if (total && sui && hom) {
    findings.push(
      `${formatValue(total.value, "deaths")} people died from gunshot wounds in ${total.period}: ${formatValue(sui.value, "deaths")} suicides (${Math.round((sui.value / total.value) * 100)}%) and ${formatValue(hom.value, "deaths")} homicides (${Math.round((hom.value / total.value) * 100)}%).`,
    );
  }
  const first = s.firearm_deaths_rate[0];
  const rateNow = last(s.firearm_deaths_rate);
  if (first && rateNow) findings.push(`The firearm death rate was ${formatValue(rateNow.value, "per_100k")} per 100,000 residents in ${rateNow.period}, against ${formatValue(first.value, "per_100k")} in ${first.period}.`);
  const shareNow = share.at(-1);
  if (shareNow) findings.push(`${Math.round(shareNow.value)}% of homicides in ${shareNow.period} were committed with a firearm.`);
  const topState = rankStates(states.rows, "firearm_deaths_rate", { n: 1 })[0];
  const lowState = rankStates(states.rows, "firearm_deaths_rate", { n: 1, low: true })[0];
  const statePeriod = states.metrics[0]?.period;
  if (topState && lowState) findings.push(`${topState.label} had the highest firearm death rate in ${statePeriod} (${formatValue(topState.value, "per_100k")} per 100,000) and ${lowState.label} the lowest (${formatValue(lowState.value, "per_100k")}).`);
  if (home) findings.push(`${home.value}% of Americans told Gallup in ${home.period} that they have a gun in their home${gallup.gun_in_home[0] ? `; ${gallup.gun_in_home[0].value}% said so in ${gallup.gun_in_home[0].period}` : ""}.`);
  if (strict) {
    const less = last(gallup.laws_less_strict);
    const same = last(gallup.laws_kept_as_now);
    findings.push(`${strict.value}% said laws covering gun sales should be more strict in ${strict.period}, ${same?.value}% kept as they are, and ${less?.value}% less strict.`);
  }
  if (assault) findings.push(`${assault.value}% favored a ban on semi-automatic "assault rifles" in ${assault.period}.`);

  return {
    headline,
    findings,
    deaths,
    rates,
    intentItems,
    intentYear: lastOld?.period ?? null,
    byAge,
    ageYear: ages.period,
    gunShare,
    ownership,
    laws,
    bans,
    states,
    rateHigh: rankStates(states.rows, "firearm_deaths_rate"),
    rateLow: rankStates(states.rows, "firearm_deaths_rate", { low: true }),
    datasets: await datasetsFor([NEW, OLD, GALLUP]),
  };
}
