// The /crime sections built on sources beyond the FBI's monthly offense
// counts: victimization surveys (BJS NCVS), death records (CDC), hate crime
// and arrest tables, and large-city police departments.

import { getCrossSection, getSeriesMany, latestMetadataByGeo, yearlySumsByGeo, type Point } from "@/lib/db/stats";
import { STATE_FIPS } from "@/lib/geo/states";
import { formatPeriod, pctChange } from "@/lib/format";
import type { CityRow, CountyRow, StateDetail, StateExtra, YearValue } from "./offenses";

const years = (points: Point[] | undefined, through?: string | null): YearValue[] =>
  (points ?? []).filter((p) => /^\d{4}$/.test(p.period) && (!through || p.period <= through)).map((p) => ({ year: p.period, value: p.value }));
const last = (s: YearValue[]) => s.at(-1) ?? null;

// ---- NCVS ------------------------------------------------------------------

const NCVS_TYPES = [
  ["rape_sexual_assault", "Rape or sexual assault"],
  ["robbery", "Robbery"],
  ["aggravated_assault", "Aggravated assault"],
  ["simple_assault", "Simple assault"],
  ["burglary", "Burglary or trespassing"],
  ["motor_vehicle_theft", "Motor vehicle theft"],
  ["other_theft", "Other household theft"],
] as const;

export async function loadVictimization() {
  const metrics = [
    "violent_rate", "property_rate", "violent_reported_pct", "property_reported_pct",
    "domestic_violence_rate", "intimate_partner_rate", "stranger_violence_rate",
    ...NCVS_TYPES.map(([k]) => `${k}_reported_pct`),
  ];
  const s = await getSeriesMany("bjs-ncvs", metrics);
  const violent = years(s.violent_rate);
  if (!violent.length) return null;
  const year = last(violent)!.year;
  const at = (m: string) => years(s[m]).find((p) => p.year === year)?.value ?? null;
  return {
    year,
    firstYear: violent[0].year,
    violent,
    property: years(s.property_rate),
    violentReported: years(s.violent_reported_pct),
    propertyReported: years(s.property_reported_pct),
    domestic: years(s.domestic_violence_rate),
    intimate: years(s.intimate_partner_rate),
    stranger: years(s.stranger_violence_rate),
    reportedByType: NCVS_TYPES.flatMap(([k, label]) => {
      const value = at(`${k}_reported_pct`);
      return value === null ? [] : [{ label: label as string, value }];
    }),
    latest: { violent: at("violent_rate"), violentReported: at("violent_reported_pct"), propertyReported: at("property_reported_pct") },
  };
}

// ---- CDC death records -------------------------------------------------------

export async function loadViolentDeaths() {
  const s = await getSeriesMany("cdc-violent-deaths", [
    "homicide_rate", "firearm_homicide_rate", "homicide_deaths", "firearm_homicide_deaths",
    "homicide_rate_ttm", "firearm_homicide_rate_ttm",
  ]);
  const homicide = years(s.homicide_rate);
  if (!homicide.length) return null;
  const year = last(homicide)!.year;
  const deaths = years(s.homicide_deaths).find((p) => p.year === year)?.value ?? null;
  const firearmDeaths = years(s.firearm_homicide_deaths).find((p) => p.year === year)?.value ?? null;
  const ttm = s.homicide_rate_ttm?.at(-1);
  return {
    year,
    homicide,
    firearmHomicide: years(s.firearm_homicide_rate),
    deaths,
    firearmShare: deaths && firearmDeaths !== null ? (firearmDeaths / deaths) * 100 : null,
    ttm: ttm
      ? {
          through: formatPeriod(ttm.period),
          range: (ttm.metadata?.ttm_range as string | undefined) ?? null,
          homicide: ttm.value,
          firearmHomicide: s.firearm_homicide_rate_ttm?.at(-1)?.value ?? null,
        }
      : null,
  };
}

// ---- Hate crime and arrests ---------------------------------------------------

const BIAS = [
  ["race", "Race, ethnicity, or ancestry"],
  ["religion", "Religion"],
  ["sexual_orientation", "Sexual orientation"],
  ["gender_identity", "Gender identity"],
  ["disability", "Disability"],
  ["gender", "Gender"],
  ["multiple", "Multiple biases"],
] as const;

export async function loadHateCrime(through: string | null) {
  const s = await getSeriesMany("fbi-hate-crime", ["hate_incidents", ...BIAS.map(([k]) => `hate_incidents_${k}`)]);
  const total = years(s.hate_incidents, through);
  if (!total.length) return null;
  const year = last(total)!.year;
  const at = (m: string) => years(s[m]).find((p) => p.year === year)?.value ?? 0;
  return {
    year,
    total,
    change: pctChange(last(total)!.value, total.at(-2)?.value),
    byBias: BIAS.map(([k, label]) => ({ label, value: at(`hate_incidents_${k}`) }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value),
  };
}

const DRUG_FROM = "2021";

export async function loadArrests(through: string | null) {
  const s = await getSeriesMany("fbi-arrests", ["arrests_total", "arrests_juvenile", "arrests_drug", "arrests_violent"]);
  const total = years(s.arrests_total, through);
  if (!total.length) return null;
  const share = (m: string) =>
    total.flatMap((t) => {
      const v = years(s[m]).find((p) => p.year === t.year)?.value;
      return v === undefined || !t.value ? [] : [{ year: t.year, value: (v / t.value) * 100 }];
    });
  // Before 2021 the CDE lists summary-system drug totals alongside their own
  // possession/sale subtotals and by-drug breakdowns, so any sum counts the
  // same arrests more than once; drug shares start with the NIBRS-only years.
  return {
    year: last(total)!.year,
    total,
    juvenileShare: share("arrests_juvenile"),
    drugShare: share("arrests_drug").filter((p) => p.year >= DRUG_FROM),
    drugFrom: DRUG_FROM,
    violentShare: share("arrests_violent"),
  };
}

// ---- States: extras for the profile -------------------------------------------

export async function loadStateExtras(year: string | null): Promise<NonNullable<import("./offenses").StateCrimeData["extra"]> | null> {
  const [hom, fa, hate, usDeaths, usHate] = await Promise.all([
    getCrossSection("cdc-violent-deaths", "homicide_rate", "state"),
    getCrossSection("cdc-violent-deaths", "firearm_homicide_rate", "state"),
    getCrossSection("fbi-hate-crime", "hate_incidents", "state", year ? { period: year } : {}),
    getSeriesMany("cdc-violent-deaths", ["homicide_rate", "firearm_homicide_rate"]),
    getSeriesMany("fbi-hate-crime", ["hate_incidents"]),
  ]);
  if (!hom.period && !hate.period) return null;
  // Hate crime for the year the state rows cover, not a partial newer one.
  const hateYear = hate.period;
  const byFips = (vals: { geoid: string; value: number }[]) => new Map(vals.map((v) => [v.geoid, v.value]));
  const [h, f, c] = [byFips(hom.values), byFips(fa.values), byFips(hate.values)];
  const byState: Record<string, StateExtra> = {};
  for (const [abbr, fips] of Object.entries(STATE_FIPS)) {
    byState[abbr] = { homicideDeaths: h.get(fips) ?? null, firearmHomicide: f.get(fips) ?? null, hateIncidents: c.get(fips) ?? null };
  }
  const usAt = (pts: Point[] | undefined, y: string | null) => pts?.find((p) => p.period === y)?.value ?? null;
  return {
    byState,
    us: {
      homicideDeaths: usAt(usDeaths.homicide_rate, hom.period),
      firearmHomicide: usAt(usDeaths.firearm_homicide_rate, hom.period),
      hateIncidents: usAt(usHate.hate_incidents, hateYear),
    },
    cdcYear: hom.period,
    hateYear,
  };
}

// ---- Cities and counties --------------------------------------------------------

export async function loadCities(year: string | null, priorYear: string | null): Promise<CityRow[]> {
  if (!year) return [];
  const [sums, meta] = await Promise.all([
    yearlySumsByGeo(
      "fbi-cde-cities",
      ["violent_crime_rate", "violent_crime_count", "homicide_rate", "property_crime_rate", "employees_per_1000"],
      "agency",
    ),
    latestMetadataByGeo("fbi-cde-cities", "violent_crime_rate", "agency"),
  ]);
  const by = new Map(sums.map((r) => [`${r.geoid}|${r.metric}|${r.year}`, r]));
  const isFull = (r: { months: number; reportedMonths: number } | undefined) => !!r && r.months === 12 && r.reportedMonths === 12;
  // Some departments submit every month but only part of their offenses
  // (a city of 240,000 with a handful of violent crimes a month). A year
  // whose violent count falls below 40% of the department's own median
  // complete year is treated as incomplete.
  const counts = new Map<string, number[]>();
  for (const r of sums) if (r.metric === "violent_crime_count" && isFull(r)) counts.set(r.geoid, [...(counts.get(r.geoid) ?? []), r.value]);
  const typical = new Map<string, number>();
  for (const [ori, list] of counts) {
    if (list.length < 3) continue;
    list.sort((x, y) => x - y);
    typical.set(ori, list[Math.floor(list.length / 2)]);
  }
  const complete = (ori: string, y: string | null) => {
    const r = y ? by.get(`${ori}|violent_crime_count|${y}`) : undefined;
    const med = typical.get(ori);
    return isFull(r) && (med === undefined || r!.value >= 0.4 * med);
  };
  const full = (ori: string, metric: string, y: string | null) => {
    const r = y ? by.get(`${ori}|${metric}|${y}`) : undefined;
    return isFull(r) && complete(ori, y) ? r!.value : null;
  };
  const staffing = (ori: string) => {
    for (let y = Number(year); y >= Number(year) - 2; y--) {
      const r = by.get(`${ori}|employees_per_1000|${y}`);
      if (r) return r.value;
    }
    return null;
  };
  return meta
    .map((m) => {
      const violent = full(m.geoid, "violent_crime_rate", year);
      const anyMonths = by.get(`${m.geoid}|violent_crime_rate|${year}`);
      return {
        ori: m.geoid,
        name: m.geoName ?? m.geoid,
        state: String(m.metadata.state ?? ""),
        population: typeof m.metadata.population === "number" ? m.metadata.population : null,
        violent,
        murder: full(m.geoid, "homicide_rate", year),
        property: full(m.geoid, "property_crime_rate", year),
        violentChange: pctChange(violent, full(m.geoid, "violent_crime_rate", priorYear)),
        staffing: staffing(m.geoid),
        partial: !!anyMonths && violent === null,
      };
    })
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
}

export async function loadStateDetail(abbr: string, year: string | null, priorYear: string | null): Promise<StateDetail | null> {
  const fips = STATE_FIPS[abbr];
  if (!fips) return null;
  const [cities, hom, fa, deaths] = await Promise.all([
    loadCities(year, priorYear),
    getCrossSection("cdc-violent-deaths", "homicide_rate", "county", { geoidPrefix: fips }),
    getCrossSection("cdc-violent-deaths", "firearm_homicide_rate", "county", { geoidPrefix: fips }),
    getCrossSection("cdc-violent-deaths", "homicide_deaths", "county", { geoidPrefix: fips }),
  ]);
  const faBy = new Map(fa.values.map((v) => [v.geoid, v.value]));
  const deathsBy = new Map(deaths.values.map((v) => [v.geoid, v.value]));
  const counties: CountyRow[] = hom.values.map((v) => ({
    fips: v.geoid,
    name: (v.geoName ?? v.geoid).replace(/, [^,]+$/, ""),
    homicide: v.value,
    firearmHomicide: faBy.get(v.geoid) ?? null,
    deaths: deathsBy.get(v.geoid) ?? null,
    unreliable: v.metadata?.unreliable === true,
  }));
  return { cities: cities.filter((c) => c.state === abbr), counties, countyYear: hom.period };
}

// Years accepted by the state-detail endpoint. Derive these from the same
// national monthly series as the /crime page so arbitrary years never become
// persistent cache keys. Partial 12-month years remain available because the
// page labels their reporting coverage explicitly.
export async function loadCrimeDetailYears(): Promise<string[]> {
  const rows = await yearlySumsByGeo("fbi-cde", ["violent_crime_rate"], "nation");
  return rows
    .filter((row) => row.geoid === "US" && row.months === 12)
    .map((row) => row.year)
    .sort();
}
