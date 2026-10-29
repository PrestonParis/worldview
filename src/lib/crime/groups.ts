// Who commits, suffers, and is punished for crime, for /crime's group
// sections: FBI arrests by race/sex/age, homicide victims and offenders
// (SHR), NIBRS offenders of violent crime, offenders as victims describe
// them (NCVS), imprisonment by race, recidivism, and officers killed.

import { getCrossSection, getSeriesMany, type Point } from "@/lib/db/stats";
import { STATES_51 } from "@/lib/geo/states";
import type { StateMetric, StateRow } from "@/components/charts/state-explorer";
import { toPoints } from "@/lib/issues/series";
import type { RankedItem } from "@/components/charts/ranked-bars";
import type { Series } from "@/components/charts/time-series-chart";

const ARRESTS = "fbi-arrest-demographics";
const SHR = "fbi-shr";
const NIBRS = "fbi-nibrs-people";
const NCVS = "bjs-ncvs";
const PRISON = "bjs-prisoners";
const RECID = "bjs-recidivism";
const LEOKA = "fbi-leoka";
const RACE = "census-pep-race";

export const ARREST_OFFENSES = [
  ["all", "All arrests"],
  ["violent", "Violent crime"],
  ["murder", "Murder"],
  ["robbery", "Robbery"],
  ["aggravated_assault", "Aggravated assault"],
  ["rape", "Rape"],
  ["weapons", "Weapons"],
  ["drug_sale", "Drug sale or manufacturing"],
  ["drug_possession", "Drug possession"],
  ["burglary", "Burglary"],
  ["larceny", "Larceny-theft"],
  ["dui", "DUI"],
] as const;
const RACES = [
  ["white", "White"],
  ["black", "Black"],
  ["aian", "American Indian or Alaska Native"],
  ["asian", "Asian"],
  ["nhpi", "Pacific Islander"],
] as const;

const complete = (p: Point[] | undefined) => (p ?? []).filter((x) => !x.metadata?.partial);
const at = (p: Point[] | undefined, period: string) => p?.find((x) => x.period === period)?.value ?? null;
const pct = (part: number | null, whole: number | null) => (part !== null && whole ? Math.round((part / whole) * 1000) / 10 : null);

export interface RaceShareRow {
  key: string;
  label: string;
  total: number | null;
  shares: Record<string, number | null>; // race -> % of arrests with known race
}

export async function loadCrimeGroups() {
  // ---- Arrests by race, sex, age (nation) ----
  const arrestMetrics = ARREST_OFFENSES.flatMap(([o]) => [
    `arrests_${o}_total`, `arrests_${o}_race_unknown`, `arrests_${o}_male`, `arrests_${o}_under_18`, `arrests_${o}_age_18_24`,
    ...RACES.map(([r]) => `arrests_${o}_${r}`),
  ]);
  const [arrests, pop, shr, nibrs, ncvs, prison, leoka] = await Promise.all([
    getSeriesMany(ARRESTS, arrestMetrics),
    getSeriesMany(RACE, ["pop_total", "pop_white", "pop_black", "pop_aian", "pop_asian_pi"]),
    getSeriesMany(SHR, [
      "victims_total", "offenders_total", "victims_race_unknown", "offenders_race_unknown",
      ...RACES.flatMap(([r]) => [`victims_${r}`, `offenders_${r}`]),
      "victims_hispanic", "victims_not_hispanic", "offenders_hispanic", "offenders_not_hispanic",
      "victims_male", "victims_female", "offenders_male", "offenders_female",
    ]),
    getSeriesMany(
      NIBRS,
      ["rape", "robbery", "aggravated_assault", "homicide"].flatMap((o) => [
        `${o}_offenders_total`, `${o}_offenders_race_unknown`, ...RACES.map(([r]) => `${o}_offenders_${r}`),
      ]),
    ),
    getSeriesMany(
      NCVS,
      ["violent", "serious_violent", "violent_victim_white_nh", "violent_victim_black_nh", "violent_victim_hispanic"].flatMap((s) =>
        ["white_nh", "black_nh", "hispanic", "asian_nhpi_nh", "other_nh", "mixed_group", "unknown"].map((g) => `${s}_offender_${g}_pct`),
      ),
    ),
    getSeriesMany(PRISON, ["imprisonment_rate_white_nh", "imprisonment_rate_black_nh", "imprisonment_rate_hispanic", "imprisonment_rate_asian_nh", "imprisonment_rate_aian_nh", "imprisonment_rate_total"]),
    getSeriesMany(LEOKA, ["officers_killed_felonious", "officers_killed_accidental"]),
  ]);
  if (!complete(arrests.arrests_all_total).length) return null;

  const year = complete(arrests.arrests_all_total).at(-1)!.period;
  const known = (o: string) => {
    const total = at(arrests[`arrests_${o}_total`], year);
    const unknown = at(arrests[`arrests_${o}_race_unknown`], year) ?? 0;
    return total === null ? null : total - unknown;
  };
  // Census race-alone shares of any origin, the FBI's race definitions.
  const popYear = pop.pop_total.find((p) => p.period === year) ? year : pop.pop_total.at(-1)?.period ?? year;
  const popTotal = at(pop.pop_total, popYear);
  const population: RaceShareRow = {
    key: "population",
    label: "Share of U.S. population",
    total: popTotal,
    shares: {
      white: pct(at(pop.pop_white, popYear), popTotal),
      black: pct(at(pop.pop_black, popYear), popTotal),
      aian: pct(at(pop.pop_aian, popYear), popTotal),
      asian: pct(at(pop.pop_asian_pi, popYear), popTotal),
      nhpi: null,
    },
  };
  const arrestRows: RaceShareRow[] = ARREST_OFFENSES.map(([o, label]) => ({
    key: o,
    label,
    total: at(arrests[`arrests_${o}_total`], year),
    shares: Object.fromEntries(RACES.map(([r]) => [r, pct(at(arrests[`arrests_${o}_${r}`], year), known(o))])),
  }));
  // Asian and Pacific Islander are one Census group in these comparisons.
  for (const row of arrestRows) {
    row.shares.asian = row.shares.asian !== null && row.shares.nhpi !== null ? Math.round((row.shares.asian + row.shares.nhpi) * 10) / 10 : row.shares.asian;
  }
  const blackShareOf = (o: string): Series => ({
    id: o,
    label: ARREST_OFFENSES.find(([k]) => k === o)![1],
    slot: o === "murder" ? 3 : o === "robbery" ? 2 : o === "all" ? 9 : 1,
    points: toPoints(
      complete(arrests[`arrests_${o}_total`]).map((p) => ({
        ...p,
        value: pct(at(arrests[`arrests_${o}_black`], p.period), p.value - (at(arrests[`arrests_${o}_race_unknown`], p.period) ?? 0)) ?? 0,
      })),
    ),
  });
  const blackShareTrend = ["murder", "robbery", "violent", "all"].map(blackShareOf);
  const ageSex = ARREST_OFFENSES.filter(([o]) => ["all", "violent", "murder", "robbery", "weapons"].includes(o)).map(([o, label]) => {
    const total = at(arrests[`arrests_${o}_total`], year);
    return {
      label,
      male: pct(at(arrests[`arrests_${o}_male`], year), total),
      under18: pct(at(arrests[`arrests_${o}_under_18`], year), total),
      age18to24: pct(at(arrests[`arrests_${o}_age_18_24`], year), total),
    };
  });

  // ---- Homicide (SHR): race shares among victims/offenders of known race ----
  const shrYears = complete(shr.victims_total).map((p) => p.period);
  const shrShare = (role: "victims" | "offenders", race: string) =>
    shrYears.map((y) => {
      const total = (at(shr[`${role}_total`], y) ?? 0) - (at(shr[`${role}_race_unknown`], y) ?? 0);
      return { period: y, periodStart: `${y}-01-01`, value: pct(at(shr[`${role}_${race}`], y), total) ?? 0 };
    });
  const homicideTrend: Series[] = [
    { id: "off_black", label: "Offenders: Black", slot: 3, points: toPoints(shrShare("offenders", "black")) },
    { id: "off_white", label: "Offenders: White", slot: 1, points: toPoints(shrShare("offenders", "white")) },
    { id: "vic_black", label: "Victims: Black", slot: 2, points: toPoints(shrShare("victims", "black")) },
    { id: "vic_white", label: "Victims: White", slot: 4, points: toPoints(shrShare("victims", "white")) },
  ];
  const shrYear = shrYears.at(-1) ?? null;
  const [weapons, relationships] = shrYear
    ? await Promise.all([topCategories(SHR, "victims_weapon_", shrYear), topCategories(SHR, "victims_relationship_", shrYear)])
    : [[], []];
  const shrLatest = shrYear
    ? {
        year: shrYear,
        victims: at(shr.victims_total, shrYear),
        offenderRaceUnknown: pct(at(shr.offenders_race_unknown, shrYear), at(shr.offenders_total, shrYear)),
        maleOffenders: pct(at(shr.offenders_male, shrYear), (at(shr.offenders_male, shrYear) ?? 0) + (at(shr.offenders_female, shrYear) ?? 0)),
      }
    : null;

  // ---- NIBRS offenders by race, latest complete year ----
  const nibrsYear = complete(nibrs.robbery_offenders_total).at(-1)?.period ?? null;
  const nibrsRows: RaceShareRow[] = nibrsYear
    ? (["homicide", "rape", "robbery", "aggravated_assault"] as const).map((o) => {
        const knownN = (at(nibrs[`${o}_offenders_total`], nibrsYear) ?? 0) - (at(nibrs[`${o}_offenders_race_unknown`], nibrsYear) ?? 0);
        return {
          key: o,
          label: { homicide: "Homicide", rape: "Rape", robbery: "Robbery", aggravated_assault: "Aggravated assault" }[o],
          total: knownN,
          shares: Object.fromEntries(RACES.map(([r]) => [r, pct(at(nibrs[`${o}_offenders_${r}`], nibrsYear), knownN)])),
        };
      })
    : [];

  // ---- NCVS: offender race as victims perceived it ----
  const ncvsYear = ncvs.violent_offender_white_nh_pct?.at(-1)?.period ?? null;
  const NCVS_GROUPS = [
    ["white_nh", "White"],
    ["black_nh", "Black"],
    ["hispanic", "Hispanic"],
    ["asian_nhpi_nh", "Asian or Pacific Islander"],
    ["other_nh", "Other or multiracial"],
    ["mixed_group", "Group of mixed races"],
    ["unknown", "Unknown"],
  ] as const;
  const ncvsRows = ncvsYear
    ? (
        [
          ["violent", "All violent victimizations"],
          ["serious_violent", "Serious violent (excludes simple assault)"],
          ["violent_victim_white_nh", "White victims"],
          ["violent_victim_black_nh", "Black victims"],
          ["violent_victim_hispanic", "Hispanic victims"],
        ] as const
      ).map(([s, label]) => ({ label, shares: Object.fromEntries(NCVS_GROUPS.map(([g]) => [g, at(ncvs[`${s}_offender_${g}_pct`], ncvsYear)])) }))
    : [];

  // ---- Prisons ----
  const imprisonment: Series[] = [
    { id: "black", label: "Black", slot: 3, points: toPoints(prison.imprisonment_rate_black_nh) },
    { id: "aian", label: "American Indian or Alaska Native", slot: 5, points: toPoints(prison.imprisonment_rate_aian_nh) },
    { id: "hispanic", label: "Hispanic", slot: 2, points: toPoints(prison.imprisonment_rate_hispanic) },
    { id: "all", label: "All", slot: 9, points: toPoints(prison.imprisonment_rate_total) },
    { id: "white", label: "White", slot: 1, points: toPoints(prison.imprisonment_rate_white_nh) },
    { id: "asian", label: "Asian", slot: 4, points: toPoints(prison.imprisonment_rate_asian_nh) },
  ];
  const recidivism = await getCrossSection(RECID, "arrested_year_5_pct", "group");
  const recidOrder = ["all", "male", "female", "white_nh", "black_nh", "hispanic", "age_24_or_younger", "age_25_39", "age_40_or_older", "violent", "property", "drug", "public_order", "murder_nonnegligent_manslaughter", "rape_sexual_assault", "robbery", "weapons"];
  const recidItems: RankedItem[] = recidOrder.flatMap((id) => {
    const v = recidivism.values.find((x) => x.geoid === id);
    return v ? [{ label: v.geoName ?? id, value: v.value }] : [];
  });

  const officers: Series[] = [
    { id: "felonious", label: "Feloniously killed", slot: 3, points: toPoints(leoka.officers_killed_felonious) },
    { id: "accidental", label: "Accidentally killed", slot: 9, points: toPoints(leoka.officers_killed_accidental) },
  ];

  const states = await stateShares(year, shrYear);

  return {
    year,
    popYear,
    states,
    population,
    arrestRows,
    blackShareTrend,
    ageSex,
    homicideTrend,
    shrLatest,
    weapons,
    relationships,
    nibrsYear,
    nibrsRows,
    ncvsYear,
    ncvsGroups: NCVS_GROUPS,
    ncvsRows,
    imprisonment,
    recidItems,
    officers,
  };
}

// State explorer: race shares of arrests (of known race) and of homicide
// victims and offenders, latest complete year.
async function stateShares(year: string, shrYear: string | null): Promise<{ metrics: StateMetric[]; rows: StateRow[] }> {
  const specs: [key: string, source: string, part: string, whole: string, minus: string, label: string, group: string, period: string | null][] = [
    ...(["all", "murder", "robbery", "aggravated_assault", "weapons"] as const).flatMap((o) => {
      const label = ARREST_OFFENSES.find(([k]) => k === o)![1];
      return (["black", "white"] as const).map(
        (r) => [`arr_${o}_${r}`, ARRESTS, `arrests_${o}_${r}`, `arrests_${o}_total`, `arrests_${o}_race_unknown`, `${label} arrests: ${r === "black" ? "Black" : "White"}`, "Arrests by race", year] as [string, string, string, string, string, string, string, string | null],
      );
    }),
    ["shr_off_black", SHR, "offenders_black", "offenders_total", "offenders_race_unknown", "Homicide offenders: Black", "Homicide", shrYear],
    ["shr_off_white", SHR, "offenders_white", "offenders_total", "offenders_race_unknown", "Homicide offenders: White", "Homicide", shrYear],
    ["shr_vic_black", SHR, "victims_black", "victims_total", "victims_race_unknown", "Homicide victims: Black", "Homicide", shrYear],
    ["shr_vic_white", SHR, "victims_white", "victims_total", "victims_race_unknown", "Homicide victims: White", "Homicide", shrYear],
  ];
  const sections = await Promise.all(
    specs.map(async ([, source, part, whole, minus, , , period]) => {
      if (!period) return null;
      const [a, b, c] = await Promise.all([part, whole, minus].map((m) => getCrossSection(source, m, "state", { period })));
      const map = (x: typeof a) => new Map(x.values.map((v) => [v.geoid, v.value]));
      return [map(a), map(b), map(c)] as const;
    }),
  );
  const metrics: StateMetric[] = specs.map(([key, , , , , label, group, period]) => ({
    key, label, unit: "percent", group, period: period ?? "", source: group === "Homicide" ? "FBI Supplementary Homicide Reports" : "FBI Crime Data Explorer",
    description: "Share of those of known race. Hispanic people are counted within their race.",
  }));
  const rows: StateRow[] = STATES_51.map((s) => ({
    abbr: s.abbr,
    name: s.name,
    values: Object.fromEntries(
      specs.map(([key], i) => {
        const m = sections[i];
        const knownN = m ? (m[1].get(s.fips) ?? 0) - (m[2].get(s.fips) ?? 0) : 0;
        // Too few cases for a share to mean much.
        return [key, m && knownN >= 20 ? pct(m[0].get(s.fips) ?? 0, knownN) : null];
      }),
    ),
  }));
  return { metrics, rows };
}

export type CrimeGroups = NonNullable<Awaited<ReturnType<typeof loadCrimeGroups>>>;
export const RACE_COLUMNS = RACES.filter(([r]) => r !== "nhpi");

// Largest categories of one prefix in a year, as ranked bars ("Unknown"
// and "Not specified" left out).
async function topCategories(source: string, prefix: string, period: string): Promise<RankedItem[]> {
  const { queryObservations } = await import("@/lib/db/stats");
  const rows = await queryObservations({ dataset: source, geoLevel: "nation", from: period, to: period, limit: 2000, offset: 0 });
  return rows
    .filter((r) => r.metric.startsWith(prefix) && r.value !== null && r.value > 0 && !/unknown|not_specified|not_reported/.test(r.metric))
    .map((r) => ({ label: titleCase(r.metric.slice(prefix.length)), value: r.value as number }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}
const titleCase = (s: string) => {
  const t = s.replace(/_/g, " ");
  return t[0].toUpperCase() + t.slice(1);
};
