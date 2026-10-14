// Everything /family shows: births and fertility (NCHS, Census population
// estimates, World Bank), marriage and divorce, households, and the families
// children live in (ACS 1-year) — all from area_stats.

import { datasetCoverage, getCrossSection, getSeriesMany, listDatasets, type Point } from "@/lib/db/stats";
import { STATES_51 } from "@/lib/geo/states";
import { formatValue } from "@/lib/format";
import type { RankedItem } from "@/components/charts/ranked-bars";
import type { StateMetric, StateRow } from "@/components/charts/state-explorer";
import type { Series, SeriesPoint } from "@/components/charts/time-series-chart";

const ACS = "census-acs1-family";
const NCHS = "cdc-natality";
const WB = "world-bank-fertility";
const PEP = "census-pep";

const annual = (points: Point[] | undefined): SeriesPoint[] => (points ?? []).map((p) => ({ x: Number(p.period), label: p.period, value: p.value }));
const last = (points: Point[] | undefined) => points?.at(-1) ?? null;
const first = (points: Point[] | undefined) => points?.[0] ?? null;
const whole = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v)}%`);

const ACS_METRICS = [
  "marriage_rate", "divorce_rate", "first_marriage_age_men", "first_marriage_age_women",
  "never_married_share", "now_married_share", "divorced_share", "widowed_share",
  "births_per_1000_women", "births_unmarried_share",
  "married_couple_households_share", "other_family_households_share", "living_alone_share", "avg_household_size",
  "children_married_couple_share", "children_single_mother_share", "children_single_father_share",
] as const;

// Countries shown beside the U.S. (World Bank ISO3 codes).
const PEERS: Record<string, string> = {
  CAN: "Canada", MEX: "Mexico", GBR: "United Kingdom", FRA: "France", DEU: "Germany", ITA: "Italy",
  JPN: "Japan", KOR: "South Korea", CHN: "China", IND: "India", ISR: "Israel", AUS: "Australia", WLD: "World",
};

const STATE_METRICS: [key: string, label: string, unit: string, group: string, source: string, description?: string][] = [
  ["birth_rate", "Births per 1,000 residents", "per_1000", "Births", "Census population estimates"],
  ["births_per_1000_women", "Births per 1,000 women 15–50", "per_1000", "Births", "American Community Survey", "Women who had a baby in the past 12 months."],
  ["births_unmarried_share", "Births to unmarried mothers", "percent", "Births", "American Community Survey", "Share of women with a birth in the past 12 months who were unmarried."],
  ["now_married_share", "Married", "percent", "Marriage", "American Community Survey", "Share of people 15 and over, including separated."],
  ["never_married_share", "Never married", "percent", "Marriage", "American Community Survey", "Share of people 15 and over."],
  ["divorced_share", "Divorced", "percent", "Marriage", "American Community Survey", "Share of people 15 and over."],
  ["marriage_rate", "Marriage rate", "per_1000", "Marriage", "American Community Survey", "Women who married in the past 12 months, per 1,000 women 15 and over."],
  ["divorce_rate", "Divorce rate", "per_1000", "Marriage", "American Community Survey", "Women who divorced in the past 12 months, per 1,000 women 15 and over."],
  ["first_marriage_age_women", "Median age at first marriage, women", "years", "Marriage", "American Community Survey"],
  ["first_marriage_age_men", "Median age at first marriage, men", "years", "Marriage", "American Community Survey"],
  ["children_married_couple_share", "Children with married parents", "percent", "Children", "American Community Survey", "Own children under 18 in married-couple families."],
  ["children_single_mother_share", "Children with a single mother", "percent", "Children", "American Community Survey"],
  ["married_couple_households_share", "Married-couple households", "percent", "Households", "American Community Survey"],
  ["living_alone_share", "Households of one person", "percent", "Households", "American Community Survey"],
  ["avg_household_size", "Average household size", "per_household", "Households", "American Community Survey"],
];

export async function loadFamily() {
  const [acs, nchs, pep, tfr, datasets] = await Promise.all([
    getSeriesMany(ACS, [...ACS_METRICS]),
    getSeriesMany(NCHS, ["births", "general_fertility_rate", "crude_birth_rate"]),
    getSeriesMany(PEP, ["births", "birth_rate"]),
    getSeriesMany(WB, ["total_fertility_rate"], "country", "USA"),
    listDatasets({ topic: "family" }),
  ]);
  if (!acs.marriage_rate.length && !tfr.total_fertility_rate.length) return null;

  // ---- Fertility ----
  const usTfr = tfr.total_fertility_rate;
  const peerLatest = await getCrossSection(WB, "total_fertility_rate", "country");
  const peerSeries = async (iso: string) => (await getSeriesMany(WB, ["total_fertility_rate"], "country", iso)).total_fertility_rate;
  const [fra, jpn, wld] = await Promise.all([peerSeries("FRA"), peerSeries("JPN"), peerSeries("WLD")]);
  const tfrCompare: Series[] = [
    { id: "usa", label: "United States", slot: 1, points: annual(usTfr) },
    { id: "fra", label: "France", slot: 3, points: annual(fra) },
    { id: "jpn", label: "Japan", slot: 2, points: annual(jpn) },
    { id: "wld", label: "World", slot: 1, color: "var(--viz-muted)", points: annual(wld) },
  ];
  const tfrRanking: RankedItem[] = peerLatest.values
    .map((v) => ({ label: v.geoid === "USA" ? "United States" : PEERS[v.geoid] ?? v.geoName ?? v.geoid, value: v.value, color: v.geoid === "USA" ? "var(--viz-series-2)" : undefined }))
    .sort((a, b) => b.value - a.value);
  const gfr: Series[] = [{ id: "gfr", label: "Births per 1,000 women 15–44", slot: 1, points: annual(nchs.general_fertility_rate) }];
  const births: Series[] = [
    { id: "nchs", label: "Registered births (NCHS)", slot: 1, points: annual(nchs.births) },
    { id: "pep", label: "Births, 12 months to July 1 (Census estimates)", slot: 3, points: annual(pep.births) },
  ];

  // ---- Marriage ----
  const marriageRates: Series[] = [
    { id: "marriage", label: "Marriage rate", slot: 1, points: annual(acs.marriage_rate) },
    { id: "divorce", label: "Divorce rate", slot: 2, points: annual(acs.divorce_rate) },
  ];
  const firstMarriage: Series[] = [
    { id: "women", label: "Women", slot: 1, points: annual(acs.first_marriage_age_women) },
    { id: "men", label: "Men", slot: 3, points: annual(acs.first_marriage_age_men) },
  ];
  const maritalStatus: Series[] = [
    { id: "married", label: "Married", slot: 1, points: annual(acs.now_married_share) },
    { id: "never", label: "Never married", slot: 2, points: annual(acs.never_married_share) },
    { id: "divorced", label: "Divorced", slot: 3, points: annual(acs.divorced_share) },
  ];

  // ---- Children and households ----
  const children: Series[] = [
    { id: "married", label: "Married parents", slot: 1, points: annual(acs.children_married_couple_share) },
    { id: "mother", label: "Single mother", slot: 2, points: annual(acs.children_single_mother_share) },
    { id: "father", label: "Single father", slot: 3, points: annual(acs.children_single_father_share) },
  ];
  const households: Series[] = [
    { id: "married", label: "Married couples", slot: 1, points: annual(acs.married_couple_households_share) },
    { id: "alone", label: "One person living alone", slot: 2, points: annual(acs.living_alone_share) },
    { id: "other", label: "Single-householder families", slot: 3, points: annual(acs.other_family_households_share) },
  ];
  const unmarried: Series[] = [{ id: "unmarried", label: "Births to unmarried mothers", slot: 2, points: annual(acs.births_unmarried_share) }];

  // ---- States ----
  const cross = await Promise.all(
    STATE_METRICS.map(([key]) => getCrossSection(key === "birth_rate" ? PEP : ACS, key, "state")),
  );
  const metrics: StateMetric[] = STATE_METRICS.map(([key, label, unit, group, source, description], i) => ({
    key, label, unit, group, source, period: cross[i].period ?? "", ...(description ? { description } : {}),
  }));
  const maps = cross.map((c) => new Map(c.values.map((v) => [v.geoid, v.value])));
  const rows: StateRow[] = STATES_51.map((s) => ({
    abbr: s.abbr,
    name: s.name,
    values: Object.fromEntries(STATE_METRICS.map(([key], i) => [key, maps[i].get(s.fips) ?? null])),
  }));
  const stateRanking = (key: string, n = 10): RankedItem[] =>
    rows
      .filter((r) => r.values[key] !== null)
      .sort((a, b) => b.values[key]! - a.values[key]!)
      .slice(0, n)
      .map((r) => ({ label: r.name, value: r.values[key]! }));
  const birthRateTop = stateRanking("birth_rate");
  const marriedKidsLow = rows
    .filter((r) => r.values.children_married_couple_share !== null)
    .sort((a, b) => a.values.children_married_couple_share! - b.values.children_married_couple_share!)
    .slice(0, 10)
    .map((r) => ({ label: r.name, value: r.values.children_married_couple_share! }));
  const marriedKidsHigh = stateRanking("children_married_couple_share");

  // ---- Headline + findings ----
  const tfrNow = last(usTfr);
  const headline = {
    tfr: { point: tfrNow, spark: usTfr.slice(-30).map((p) => p.value) },
    births: { point: last(pep.births), prior: pep.births.at(-2) ?? null, spark: pep.births.map((p) => p.value) },
    marriage: { point: last(acs.marriage_rate), spark: acs.marriage_rate.map((p) => p.value) },
    kids: { point: last(acs.children_married_couple_share), spark: acs.children_married_couple_share.map((p) => p.value) },
    unmarried: { point: last(acs.births_unmarried_share) },
  };

  const findings: string[] = [];
  const peak = usTfr.length ? usTfr.reduce((a, b) => (b.value > a.value ? b : a)) : null;
  const below = usTfr.find((p, i) => i > 0 && p.value < 2.1 && usTfr.slice(i).every((q) => q.value < 2.1));
  if (tfrNow) {
    findings.push(
      `The U.S. total fertility rate was ${formatValue(tfrNow.value, "per_woman")} births per woman in ${tfrNow.period}${below ? `, below the replacement level of about 2.1 every year since ${below.period}` : ""}${peak ? `; it peaked at ${formatValue(peak.value, "per_woman")} in ${peak.period}` : ""}.`,
    );
  }
  const gfrNow = last(nchs.general_fertility_rate);
  const gfrPeak = nchs.general_fertility_rate.length ? nchs.general_fertility_rate.reduce((a, b) => (b.value > a.value ? b : a)) : null;
  const gfrLowest = gfrNow !== null && nchs.general_fertility_rate.every((p) => p.value >= gfrNow.value);
  if (gfrNow && gfrPeak) {
    findings.push(
      `There were ${formatValue(gfrNow.value, "per_1000")} births per 1,000 women aged 15–44 in ${gfrNow.period}${gfrLowest ? `, the lowest since the series began in ${first(nchs.general_fertility_rate)!.period}` : ""}, against ${formatValue(gfrPeak.value, "per_1000")} in ${gfrPeak.period}.`,
    );
  }
  const mr = last(acs.marriage_rate);
  const mr0 = first(acs.marriage_rate);
  const dr = last(acs.divorce_rate);
  const dr0 = first(acs.divorce_rate);
  if (mr && mr0 && dr && dr0) findings.push(`${formatValue(mr.value, "per_1000")} of every 1,000 women married in ${mr.period} (${formatValue(mr0.value, "per_1000")} in ${mr0.period}); the divorce rate fell from ${formatValue(dr0.value, "per_1000")} to ${formatValue(dr.value, "per_1000")}.`);
  const fw = last(acs.first_marriage_age_women);
  const fw0 = first(acs.first_marriage_age_women);
  const fm = last(acs.first_marriage_age_men);
  if (fw && fw0 && fm) findings.push(`The median age at first marriage reached ${formatValue(fw.value, "years")} for women and ${formatValue(fm.value, "years")} for men in ${fw.period}, up from ${formatValue(fw0.value, "years")} for women in ${fw0.period}.`);
  const nm = last(acs.never_married_share);
  const nm0 = first(acs.never_married_share);
  if (nm && nm0) findings.push(`${whole(nm.value)} of people 15 and over had never married in ${nm.period}, up from ${whole(nm0.value)} in ${nm0.period}.`);
  const kids = headline.kids.point;
  const mom = last(acs.children_single_mother_share);
  if (kids && mom) findings.push(`${whole(kids.value)} of children lived with married parents in ${kids.period}; ${whole(mom.value)} lived with a single mother.`);
  const um = headline.unmarried.point;
  if (um) findings.push(`${whole(um.value)} of women who gave birth in the year before the ${um.period} survey were unmarried.`);

  const order = [NCHS, WB, ACS];
  const cov = await datasetCoverage([...datasets.map((d) => d.slug), PEP]);
  const pepDataset = (await listDatasets({ topic: "demographics" })).find((d) => d.slug === PEP);
  return {
    headline,
    findings,
    tfrCompare,
    tfrRanking,
    tfrYear: peerLatest.period,
    gfr,
    births,
    marriageRates,
    firstMarriage,
    maritalStatus,
    children,
    households,
    unmarried,
    birthRateTop,
    marriedKidsLow,
    marriedKidsHigh,
    states: { metrics, rows },
    datasets: [...datasets.sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug)), ...(pepDataset ? [pepDataset] : [])].map((d) => ({
      ...d,
      coverage: cov[d.slug] ?? null,
    })),
  };
}
