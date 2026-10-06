// Everything /immigration shows, assembled server-side from area_stats.
// Each section degrades to empty when its dataset hasn't been imported yet.

import {
  datasetCoverage,
  getCrossSection,
  getSeries,
  getSeriesMany,
  listDatasets,
  sumByGeo,
  type Point,
} from "@/lib/db/stats";
import { FIPS_TO_ABBR, STATES_51, stateName } from "@/lib/geo/states";
import { formatPeriod, pctChange, tidyLabel } from "@/lib/format";
import { shiftMonth, toChartPoints, trailingSum, valueAt } from "@/lib/stats/series";

const last = (p: Point[]) => p.at(-1) ?? null;
const prev = (p: Point[]) => p.at(-2) ?? null;

export async function loadImmigration() {
  const [
    encounters,
    encounterAuthority,
    netMigration,
    lpr,
    lprComponents,
    naturalizations,
    refugees,
    asylum,
    detention,
    foreignBornShare,
  ] = await Promise.all([
    getSeries("cbp", "encounters_total"),
    getSeriesMany("cbp", ["encounters_title_8", "encounters_title_42"]),
    getSeries("census-pep", "international_migration"),
    getSeries("dhs-yearbook", "lpr_total"),
    getSeriesMany("dhs-yearbook", ["lpr_adjustments", "lpr_new_arrivals"]),
    getSeries("dhs-yearbook", "naturalizations_total"),
    getSeries("dhs-yearbook", "refugee_arrivals"),
    getSeries("dhs-yearbook", "asylum_grants_total"),
    getSeriesMany("ice-detention", ["detained_adp", "detained_adp_convicted", "detained_adp_no_conviction"]),
    getSeries("census-acs1-immigration", "foreign_born_share"),
  ]);

  // --- Border: trailing 12 months, by citizenship and by state.
  const lastMonth = last(encounters)?.period ?? null;
  const windowFrom = lastMonth ? `${shiftMonth(lastMonth, -11)}-01` : null;
  const windowTo = lastMonth ? `${lastMonth}-01` : null;
  const [byCitizenship, encountersByState] =
    windowFrom && windowTo
      ? await Promise.all([
          sumByGeo("cbp", "encounters_by_citizenship", "citizenship", windowFrom, windowTo),
          sumByGeo("cbp", "encounters_total", "state", windowFrom, windowTo),
        ])
      : [[], []];

  // --- Legal immigration breakdowns, latest fiscal year.
  const [lprByClass, lprByCountry, refugeesByCountry, lprByState, natzByState] = await Promise.all([
    getCrossSection("dhs-yearbook", "lpr_by_class", "class"),
    getCrossSection("dhs-yearbook", "lpr_by_country", "country"),
    getCrossSection("dhs-yearbook", "refugee_arrivals_by_country", "country"),
    getCrossSection("dhs-yearbook", "lpr_total", "state"),
    getCrossSection("dhs-yearbook", "naturalizations_total", "state"),
  ]);

  // --- Detention, latest fiscal year.
  const [facilities, detentionByState] = await Promise.all([
    getCrossSection("ice-detention", "detained_adp", "facility"),
    getCrossSection("ice-detention", "detained_adp", "state"),
  ]);

  // --- Population estimates by state, latest year.
  const [pepByState, pepRateByState, fbShareByState] = await Promise.all([
    getCrossSection("census-pep", "international_migration", "state"),
    getCrossSection("census-pep", "international_migration_rate", "state"),
    getCrossSection("census-acs1-immigration", "foreign_born_share", "state"),
  ]);

  const datasets = await listDatasets({ topic: "immigration" });
  const coverage = await datasetCoverage(datasets.map((d) => d.slug));

  // --- Headline numbers
  const lastEnc = last(encounters);
  const encYearAgo = lastMonth ? valueAt(encounters, shiftMonth(lastMonth, -12)) : null;
  const enc12 = trailingSum(encounters, 12);
  const encPrior12 = trailingSum(encounters, 12, encounters.length - 13);
  const det = detention.detained_adp;

  const stats = {
    encounters: lastEnc && {
      value: lastEnc.value,
      period: formatPeriod(lastEnc.period),
      change: pctChange(lastEnc.value, encYearAgo),
      compare: `vs ${lastMonth ? formatPeriod(shiftMonth(lastMonth, -12)) : ""}`,
      spark: encounters.slice(-24).map((p) => p.value),
    },
    encounters12: enc12 !== null && {
      value: enc12,
      period: lastMonth ? `${formatPeriod(shiftMonth(lastMonth, -11))} – ${formatPeriod(lastMonth)}` : "",
      change: pctChange(enc12, encPrior12),
      compare: "vs prior 12 months",
    },
    netMigration: last(netMigration) && {
      value: last(netMigration)!.value,
      period: `Year to July 1, ${last(netMigration)!.period}`,
      change: pctChange(last(netMigration)!.value, prev(netMigration)?.value),
      compare: `vs ${prev(netMigration)?.period ?? ""}`,
      spark: netMigration.map((p) => p.value),
    },
    lpr: last(lpr) && {
      value: last(lpr)!.value,
      period: formatPeriod(last(lpr)!.period),
      change: pctChange(last(lpr)!.value, prev(lpr)?.value),
      compare: `vs ${prev(lpr) ? formatPeriod(prev(lpr)!.period) : ""}`,
      spark: lpr.slice(-15).map((p) => p.value),
    },
    naturalizations: last(naturalizations) && {
      value: last(naturalizations)!.value,
      period: formatPeriod(last(naturalizations)!.period),
      change: pctChange(last(naturalizations)!.value, prev(naturalizations)?.value),
      compare: `vs ${prev(naturalizations) ? formatPeriod(prev(naturalizations)!.period) : ""}`,
      spark: naturalizations.slice(-15).map((p) => p.value),
    },
    detention: last(det) && {
      value: last(det)!.value,
      period: `${formatPeriod(last(det)!.period)} average to date`,
      change: pctChange(last(det)!.value, prev(det)?.value),
      compare: `vs ${prev(det) ? formatPeriod(prev(det)!.period) : ""}`,
      spark: det.map((p) => p.value),
    },
  };

  // --- State explorer
  const byGeo = (values: { geoid: string; value: number }[]) => new Map(values.map((v) => [v.geoid, v.value]));
  const maps = {
    intl: byGeo(pepByState.values),
    intlRate: byGeo(pepRateByState.values),
    lpr: byGeo(lprByState.values),
    natz: byGeo(natzByState.values),
    enc: byGeo(encountersByState),
    det: byGeo(detentionByState.values),
    fb: byGeo(fbShareByState.values),
  };
  const stateMetrics = [
    { key: "intl", label: "Net international migration", unit: "people", period: pepByState.period ?? "", source: "Census PEP" },
    { key: "intlRate", label: "Migration per 1,000 residents", unit: "per_1000", period: pepRateByState.period ?? "", source: "Census PEP" },
    ...(fbShareByState.values.length
      ? [{ key: "fb", label: "Foreign-born share", unit: "percent", period: fbShareByState.period ?? "", source: "Census ACS" }]
      : []),
    { key: "lpr", label: "New green cards", unit: "people", period: formatPeriod(lprByState.period ?? ""), source: "DHS Yearbook" },
    { key: "natz", label: "Naturalizations", unit: "people", period: formatPeriod(natzByState.period ?? ""), source: "DHS Yearbook" },
    { key: "enc", label: "Border encounters", unit: "encounters", period: "Last 12 months", source: "CBP" },
    { key: "det", label: "ICE detention (avg. daily)", unit: "people", period: formatPeriod(detentionByState.period ?? ""), source: "ICE" },
  ];
  const stateRows = STATES_51.map((s) => ({
    abbr: s.abbr,
    name: s.name,
    values: Object.fromEntries(stateMetrics.map((m) => [m.key, maps[m.key as keyof typeof maps].get(s.fips) ?? null])),
  }));

  return {
    stats,
    border: {
      monthly: [
        { id: "title8", label: "Title 8 (immigration law)", slot: 1 as const, points: toChartPoints(encounterAuthority.encounters_title_8) },
        { id: "title42", label: "Title 42 expulsions", slot: 2 as const, points: toChartPoints(encounterAuthority.encounters_title_42) },
      ],
      byCitizenship: byCitizenship.map((r) => ({ label: tidyLabel(r.geoName ?? r.geoid), value: r.value })),
      byState: encountersByState
        .filter((r) => FIPS_TO_ABBR[r.geoid])
        .map((r) => ({ label: stateName(r.geoid), value: r.value })),
      window: stats.encounters12 ? stats.encounters12.period : "",
    },
    legal: {
      lprHistory: toChartPoints(lpr),
      lprSplit: [
        { id: "adj", label: "Adjusted status inside the U.S.", slot: 1 as const, points: toChartPoints(lprComponents.lpr_adjustments) },
        { id: "new", label: "Arrived from abroad", slot: 3 as const, points: toChartPoints(lprComponents.lpr_new_arrivals) },
      ],
      naturalizations: toChartPoints(naturalizations),
      byClass: { period: formatPeriod(lprByClass.period ?? ""), items: lprByClass.values.map((r) => ({ label: r.geoName ?? r.geoid, value: r.value })) },
      byCountry: { period: formatPeriod(lprByCountry.period ?? ""), items: lprByCountry.values.map((r) => ({ label: r.geoName ?? r.geoid, value: r.value })) },
    },
    humanitarian: {
      series: [
        { id: "refugees", label: "Refugee arrivals", slot: 1 as const, points: toChartPoints(refugees) },
        { id: "asylum", label: "Asylum grants", slot: 2 as const, points: toChartPoints(asylum) },
      ],
      refugeesByCountry: {
        period: formatPeriod(refugeesByCountry.period ?? ""),
        items: refugeesByCountry.values.map((r) => ({ label: r.geoName ?? r.geoid, value: r.value })),
      },
    },
    population: {
      netMigration: toChartPoints(netMigration),
      foreignBornShare: toChartPoints(foreignBornShare),
    },
    detention: {
      series: [
        { id: "none", label: "No criminal conviction", slot: 1 as const, points: toChartPoints(detention.detained_adp_no_conviction) },
        { id: "conv", label: "Criminal conviction", slot: 2 as const, points: toChartPoints(detention.detained_adp_convicted) },
      ],
      facilities: {
        period: formatPeriod(facilities.period ?? ""),
        items: facilities.values.map((r) => ({
          label: tidyLabel(r.geoName ?? r.geoid),
          value: r.value,
          note: [tidyLabel(String(r.metadata?.city ?? "")), FIPS_TO_ABBR[String(r.metadata?.state ?? "")]].filter(Boolean).join(", "),
        })),
      },
    },
    states: { metrics: stateMetrics, rows: stateRows },
    datasets: datasets.map((d) => ({ ...d, coverage: coverage[d.slug] ?? null })),
  };
}

export type ImmigrationData = Awaited<ReturnType<typeof loadImmigration>>;
