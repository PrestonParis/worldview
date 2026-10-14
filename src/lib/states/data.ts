// Everything /states/[slug] shows: one state's figures from every topic
// page, each with the U.S. value for the same period, the state's rank among
// the 50 states and D.C., and a sparkline — plus its presidential results
// and races on the ballot.

import { latestByGeo, seriesForGeo, valuesAt, yearlySumsByGeo, type LatestValue, type Point } from "@/lib/db/stats";
import { listRaces } from "@/lib/db/election-overview";
import { latestCycle } from "@/lib/db/elections";
import { LIMIT_CATEGORIES } from "@/lib/abortion/data";
import { formatPeriod } from "@/lib/format";
import { STATES_51 } from "@/lib/geo/states";
import type { PartyLetter, RaceSummary } from "@/lib/elections/overview";

import type { StateInfo } from "./slug";

export interface StateFact {
  key: string;
  label: string;
  unit: string;
  value: number | null;
  period: string; // formatted
  us: number | null;
  rank: number | null; // 1 = highest
  of: number;
  spark: number[];
  note?: string;
}

export interface StateSection {
  id: string;
  title: string;
  href: string;
  linkLabel: string;
  facts: StateFact[];
  text?: { label: string; value: string; note?: string }[];
}

// A fact read straight from area_stats.
interface RawSpec {
  key: string;
  source: string;
  metric: string;
  label: string;
  unit: string;
  note?: string;
  noUs?: boolean; // the U.S. series measures something different
}

const raw = (source: string, metric: string, label: string, unit: string, note?: string, noUs?: boolean): RawSpec => ({
  key: `${source}|${metric}`, source, metric, label, unit, note, ...(noUs ? { noUs } : {}),
});

// Section -> facts, in display order. `derived` keys are computed below.
const SECTIONS: { id: string; title: string; href: (s: StateInfo) => string; linkLabel: string; facts: (RawSpec | string)[] }[] = [
  {
    id: "people", title: "People", href: (s) => `/demographics?state=${s.fips}`, linkLabel: "Demographics",
    facts: [
      raw("census-pep", "population", "Population", "people", "July 1 estimate"),
      "population_growth",
      raw("census-pep", "domestic_migration_rate", "Net moves from other states", "per_1000", "Per 1,000 residents, past year"),
      raw("census-pep", "international_migration_rate", "Net international migration", "per_1000", "Per 1,000 residents, past year"),
      raw("census-acs5", "median_age", "Median age", "years"),
      raw("census-acs1-immigration", "foreign_born_share", "Born abroad", "percent"),
      raw("census-urban-rural", "urban_share", "Living in urban areas", "percent", "2020 census"),
    ],
  },
  {
    id: "economy", title: "Economy", href: () => "/economy#states", linkLabel: "Economy",
    facts: [
      raw("fred-economy", "unemployment_rate", "Unemployment rate", "percent", "Seasonally adjusted"),
      raw("census-acs1-social", "median_household_income", "Median household income", "usd"),
      raw("fred-economy", "per_capita_income", "Per capita personal income", "usd"),
      raw("census-acs1-social", "poverty_rate", "Poverty rate", "percent"),
      "effective_minimum_wage",
    ],
  },
  {
    id: "housing", title: "Housing", href: () => "/housing#states", linkLabel: "Housing",
    facts: [
      raw("census-acs1-housing", "median_home_value", "Median home value", "usd"),
      raw("census-acs1-housing", "median_gross_rent", "Median rent", "usd", "Monthly, with utilities"),
      raw("census-acs1-housing", "rent_burdened_share", "Renters paying 30%+ of income", "percent"),
      raw("fred-housing", "homeownership_rate", "Homeownership rate", "percent"),
      raw("fred-housing", "home_price_growth", "Home price growth", "percent", "FHFA index, annual average", true),
    ],
  },
  {
    id: "health", title: "Health care", href: () => "/health-care#states", linkLabel: "Health Care",
    facts: [
      raw("census-acs1-health", "uninsured_rate", "Uninsured", "percent"),
      raw("census-acs1-health", "medicaid_share", "Covered by Medicaid", "percent"),
      "overdose_rate",
    ],
  },
  {
    id: "crime", title: "Crime and guns", href: () => "/crime", linkLabel: "Crime",
    facts: [
      "violent_crime_rate",
      "homicide_rate",
      "property_crime_rate",
      raw("cdc-violent-deaths", "firearm_deaths_rate", "Firearm deaths", "per_100k", "Per 100,000 residents, all intents"),
      raw("cdc-violent-deaths", "firearm_suicide_rate", "Firearm suicides", "per_100k", "Per 100,000 residents"),
    ],
  },
  {
    id: "immigration", title: "Immigration", href: () => "/immigration#states", linkLabel: "Immigration",
    facts: [
      raw("census-acs1-immigration", "foreign_born", "Foreign-born residents", "people"),
      raw("census-acs1-immigration", "naturalized_share_of_foreign_born", "Naturalized citizens", "percent", "Share of the foreign-born"),
      raw("dhs-yearbook", "lpr_total", "New green cards", "people", "New lawful permanent residents living in the state"),
      raw("dhs-yearbook", "naturalizations_total", "Naturalizations", "people"),
    ],
  },
  {
    id: "education", title: "Education", href: () => "/education#states", linkLabel: "Education",
    facts: [
      raw("naep", "math_8_proficient", "Grade 8 math, Proficient", "percent", "At or above NAEP Proficient"),
      raw("naep", "reading_4_proficient", "Grade 4 reading, Proficient", "percent", "At or above NAEP Proficient"),
      raw("census-acs1-social", "bachelors_plus_share", "Bachelor's degree or more", "percent", "Adults 25 and over"),
    ],
  },
  {
    id: "family", title: "Family", href: () => "/family#states", linkLabel: "Family",
    facts: [
      raw("census-pep", "birth_rate", "Births", "per_1000", "Per 1,000 residents"),
      raw("census-acs1-family", "now_married_share", "Married", "percent", "People 15 and over"),
      raw("census-acs1-family", "children_married_couple_share", "Children with married parents", "percent"),
    ],
  },
  {
    id: "religion", title: "Religion", href: (s) => `/religion?state=${s.fips}`, linkLabel: "Religion",
    facts: [
      raw("pew-rls", "share_christian", "Christian", "percent"),
      raw("pew-rls", "share_unaffiliated", "Religiously unaffiliated", "percent"),
      raw("pew-rls", "attendance_weekly", "Attend services weekly", "percent"),
    ],
  },
  {
    id: "abortion", title: "Abortion", href: () => "/abortion#states", linkLabel: "Abortion",
    facts: [raw("guttmacher-monthly-abortions", "abortions", "Abortions provided", "abortions", "Including telehealth")],
  },
  {
    id: "government", title: "Federal money", href: () => "/spending#states", linkLabel: "Government Spending",
    facts: ["grants_per_resident"],
  },
  {
    id: "climate", title: "Climate", href: () => "/energy#states", linkLabel: "Energy & Climate",
    facts: [raw("noaa-climate", "avg_temperature", "Average temperature", "deg_f")],
  },
];

const DERIVED: Record<string, { label: string; unit: string; note?: string }> = {
  population_growth: { label: "Population growth", unit: "percent", note: "Past year" },
  effective_minimum_wage: { label: "Minimum wage", unit: "usd_cents", note: "State or federal rate, whichever is higher" },
  overdose_rate: { label: "Overdose deaths", unit: "per_100k", note: "Per 100,000 residents, past 12 months" },
  violent_crime_rate: { label: "Violent crime", unit: "per_100k", note: "Offenses reported to police per 100,000" },
  homicide_rate: { label: "Murder", unit: "per_100k", note: "Murders and nonnegligent manslaughters per 100,000" },
  property_crime_rate: { label: "Property crime", unit: "per_100k", note: "Offenses reported to police per 100,000" },
  grants_per_resident: { label: "Federal grants per resident", unit: "usd", note: "Grants to state and local governments and others" },
};

// Extra series the derived facts are built from.
const INPUTS = [
  { source: "census-pep", metric: "population_change" },
  { source: "fred-economy", metric: "state_minimum_wage" },
  { source: "cdc-overdose-deaths", metric: "overdose_deaths" },
  { source: "usaspending", metric: "federal_grants" },
  { source: "abortion-gestational-limits", metric: "gestational_limit_category" },
];

// Crime: the latest calendar year every month of which covers at least this
// share of the population nationally (as on /crime).
const MIN_COVERAGE = 90;

type ValueMap = Map<string, { period: string; value: number }>; // geoid ->

export async function loadState(state: StateInfo) {
  const specs = SECTIONS.flatMap((s) => s.facts.filter((f): f is RawSpec => typeof f !== "string"));
  const keys = [...specs.map(({ source, metric }) => ({ source, metric })), ...INPUTS];

  const [latest, crimeState, crimeNation, federalMin] = await Promise.all([
    latestByGeo(keys, "state"),
    yearlySumsByGeo("fbi-cde", ["violent_crime_rate", "homicide_rate", "property_crime_rate"], "state"),
    yearlySumsByGeo("fbi-cde", ["violent_crime_rate", "homicide_rate", "property_crime_rate"], "nation"),
    latestByGeo([{ source: "fred-economy", metric: "federal_minimum_wage" }], "nation"),
  ]);

  // key -> geoid -> latest value
  const byKey = new Map<string, ValueMap>();
  const put = (key: string, geoid: string, period: string, value: number) => {
    if (!byKey.has(key)) byKey.set(key, new Map());
    byKey.get(key)!.set(geoid, { period, value });
  };
  for (const r of latest as LatestValue[]) put(`${r.source}|${r.metric}`, r.geoid, r.period, r.value);
  const get = (key: string, geoid: string) => byKey.get(key)?.get(geoid) ?? null;
  const fipsSet = new Set(STATES_51.map((s) => s.fips));

  // ---- Derived values for every state ----
  // Minimum wages are compared for the latest year any state reports, so
  // states without a law of their own (federal rate) rank alongside them.
  const wageYear = [...(byKey.get("fred-economy|state_minimum_wage")?.values() ?? [])].map((v) => v.period).sort().at(-1);
  for (const s of STATES_51) {
    const pop = get("census-pep|population", s.fips);
    const change = get("census-pep|population_change", s.fips);
    if (pop && change) put("population_growth", s.fips, pop.period, (change.value / (pop.value - change.value)) * 100);
    const fed = federalMin[0]?.value ?? null;
    const own = get("fred-economy|state_minimum_wage", s.fips);
    if (fed !== null && wageYear) put("effective_minimum_wage", s.fips, wageYear, Math.max(own?.period === wageYear ? own.value : 0, fed));
    const od = get("cdc-overdose-deaths|overdose_deaths", s.fips);
    if (od && pop) put("overdose_rate", s.fips, od.period, (od.value / pop.value) * 1e5);
    const grants = get("usaspending|federal_grants", s.fips);
    if (grants && pop) put("grants_per_resident", s.fips, grants.period, grants.value / pop.value);
  }
  const crimeYear = crimeNation
    .filter((r) => r.metric === "violent_crime_rate" && r.months === 12 && (r.minCoverage ?? 0) >= MIN_COVERAGE)
    .map((r) => r.year)
    .sort()
    .at(-1);
  if (crimeYear) {
    for (const r of crimeState) if (r.year === crimeYear && r.months === 12) put(r.metric, r.geoid, r.year, r.value);
  }

  // ---- U.S. values for the same periods ----
  const nationAt = await valuesAt(
    specs.flatMap(({ source, metric, key }) => {
      const v = get(key, state.fips);
      return v ? [{ source, metric, period: v.period }] : [];
    }),
    "nation",
    "US",
  );
  // Where the U.S. series is finer-grained than the state one (quarterly
  // homeownership against annual), use the U.S. average over that year.
  const missingUs = specs.filter((sp) => !sp.noUs && get(sp.key, state.fips) && !nationAt.has(`${sp.source}|${sp.metric}|${get(sp.key, state.fips)!.period}`));
  const nationSeries = await seriesForGeo(missingUs.map(({ source, metric }) => ({ source, metric })), "nation", "US");
  for (const sp of missingUs) {
    const period = get(sp.key, state.fips)!.period;
    if (!/^\d{4}$/.test(period)) continue;
    const inYear = (nationSeries.get(sp.key) ?? []).filter((p) => p.period.startsWith(`${period}-`));
    if (inYear.length === 4 || inYear.length === 12) nationAt.set(`${sp.key}|${period}`, inYear.reduce((t, p) => t + p.value, 0) / inYear.length);
  }
  const nationLatest = await latestByGeo(
    [
      { source: "census-pep", metric: "population" },
      { source: "census-pep", metric: "population_change" },
      { source: "cdc-overdose-deaths", metric: "overdose_deaths" },
    ],
    "nation",
  );
  const nat = (metric: string) => nationLatest.find((r) => r.metric === metric) ?? null;
  const usPop = nat("population");
  const usChange = nat("population_change");
  const usOd = nat("overdose_deaths");
  const nationDerived: Record<string, number | null> = {
    population_growth: usPop && usChange ? (usChange.value / (usPop.value - usChange.value)) * 100 : null,
    overdose_rate: usPop && usOd ? (usOd.value / usPop.value) * 1e5 : null,
    violent_crime_rate: crimeNation.find((r) => r.metric === "violent_crime_rate" && r.year === crimeYear)?.value ?? null,
    homicide_rate: crimeNation.find((r) => r.metric === "homicide_rate" && r.year === crimeYear)?.value ?? null,
    property_crime_rate: crimeNation.find((r) => r.metric === "property_crime_rate" && r.year === crimeYear)?.value ?? null,
    effective_minimum_wage: federalMin[0]?.value ?? null,
  };

  // ---- Sparklines ----
  const series = await seriesForGeo(specs.map(({ source, metric }) => ({ source, metric })), "state", state.fips);
  const crimeSeries = (metric: string) =>
    crimeState.filter((r) => r.geoid === state.fips && r.metric === metric && r.months === 12 && (!crimeYear || r.year <= crimeYear)).sort((a, b) => a.year.localeCompare(b.year)).map((r) => r.value);

  const fact = (spec: RawSpec | string): StateFact | null => {
    const key = typeof spec === "string" ? spec : spec.key;
    const meta = typeof spec === "string" ? DERIVED[spec] : spec;
    const mine = get(key, state.fips);
    if (!mine) return null;
    // Rank among states reporting the same period.
    const peers = [...(byKey.get(key)?.entries() ?? [])].filter(([g, v]) => fipsSet.has(g) && v.period === mine.period);
    const rank = peers.filter(([, v]) => v.value > mine.value).length + 1;
    const us = typeof spec === "string" ? nationDerived[spec] ?? null : spec.noUs ? null : nationAt.get(`${spec.source}|${spec.metric}|${mine.period}`) ?? null;
    const spark =
      typeof spec === "string"
        ? spec.endsWith("_crime_rate") || spec === "homicide_rate"
          ? crimeSeries(spec)
          : []
        : (series.get(key) ?? []).slice(-24).map((p: Point) => p.value);
    return {
      key, label: meta.label, unit: meta.unit, value: mine.value, period: formatPeriod(mine.period), us, rank, of: peers.length,
      spark: spark.length > 2 ? spark : [], ...(meta.note ? { note: meta.note } : {}),
    };
  };

  const sections: StateSection[] = SECTIONS.map((sec) => ({
    id: sec.id, title: sec.title, href: sec.href(state), linkLabel: sec.linkLabel,
    facts: sec.facts.map(fact).filter((f): f is StateFact => f !== null),
  }));

  // The abortion law, as text.
  const limit = get("abortion-gestational-limits|gestational_limit_category", state.fips);
  const abortion = sections.find((s) => s.id === "abortion");
  if (abortion && limit) {
    abortion.text = [{ label: "State law", value: LIMIT_CATEGORIES.find((c) => c.value === limit.value)?.label ?? "—", note: `As of ${formatPeriod(limit.period)}` }];
  }

  return {
    sections: sections.filter((s) => s.facts.length || s.text?.length),
    politics: await loadPolitics(state),
  };
}

// ---- Elections ----

export interface PresidentialResult {
  cycle: number;
  winnerName: string;
  winnerParty: PartyLetter | null;
  marginPct: number | null;
}

async function loadPolitics(state: StateInfo) {
  // Elections and candidate names live partly in the graph database; a state
  // page should still render if it is unreachable.
  try {
    const cycles = [2024, 2020, 2016, 2012, 2008];
    const presidential: PresidentialResult[] = [];
    for (const cycle of cycles) {
      const race = (await listRaces(cycle, "president")).find((r) => r.stateAbbr === state.abbr);
      if (race?.result) presidential.push({ cycle, ...race.result });
    }
    const current = await latestCycle();
    const upcoming: RaceSummary[] = [];
    if (current) {
      for (const office of ["senate", "governor"] as const) {
        upcoming.push(...(await listRaces(current, office)).filter((r) => r.stateAbbr === state.abbr && r.status === "scheduled"));
      }
    }
    return { presidential, upcoming, cycle: current };
  } catch {
    return { presidential: [], upcoming: [], cycle: null };
  }
}
