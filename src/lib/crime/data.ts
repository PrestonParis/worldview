// Everything /crime shows, from the FBI Crime Data Explorer rows in
// area_stats. Monthly rates per 100,000 sum to annual rates.

import { datasetCoverage, getSeries, getSeriesMany, listDatasets, sumByGeo } from "@/lib/db/stats";
import { STATES_51 } from "@/lib/geo/states";
import { formatPeriod, pctChange } from "@/lib/format";
import { toChartPoints, yearlyTotals } from "@/lib/stats/series";

export const OFFENSES = [
  ["violent_crime", "Violent crime"],
  ["homicide", "Murder and nonnegligent manslaughter"],
  ["aggravated_assault", "Aggravated assault"],
  ["robbery", "Robbery"],
  ["rape", "Rape"],
  ["property_crime", "Property crime"],
  ["burglary", "Burglary"],
  ["larceny", "Larceny-theft"],
  ["motor_vehicle_theft", "Motor vehicle theft"],
] as const;

// Agencies report late, so the newest months cover only part of the
// population. Headlines and state comparisons use the latest calendar year
// whose every month has at least this much coverage.
const MIN_COVERAGE = 90;

export async function loadCrime() {
  const rateMetrics = OFFENSES.map(([k]) => `${k}_rate`);
  const [national, violent] = await Promise.all([
    getSeriesMany("fbi-cde", rateMetrics),
    getSeries("fbi-cde", "violent_crime_rate"), // with metadata.coverage
  ]);

  const coverage = (p: (typeof violent)[number]) => (typeof p.metadata?.coverage === "number" ? (p.metadata.coverage as number) : 0);
  const years = [...new Set(violent.map((p) => p.period.slice(0, 4)))].sort();
  const complete = years.filter((y) => {
    const months = violent.filter((p) => p.period.startsWith(`${y}-`));
    return months.length === 12 && months.every((p) => coverage(p) >= MIN_COVERAGE);
  });
  const year = complete.at(-1) ?? null;
  const priorYear = year ? String(Number(year) - 1) : null;

  const stateMetrics = [
    { key: "violent_crime", label: "Violent crime rate" },
    { key: "homicide", label: "Murder rate" },
    { key: "property_crime", label: "Property crime rate" },
    { key: "motor_vehicle_theft", label: "Vehicle theft rate" },
  ];
  const stateSums = year
    ? await Promise.all(stateMetrics.map((m) => sumByGeo("fbi-cde", `${m.key}_rate`, "state", `${year}-01-01`, `${year}-12-01`)))
    : stateMetrics.map(() => []);

  const datasets = await listDatasets({ topic: "crime" });
  const datasetCov = await datasetCoverage(datasets.map((d) => d.slug));

  const annual = (key: string) => yearlyTotals(national[`${key}_rate`]).filter((p) => !year || p.period <= year);
  const headline = (key: string) => {
    const a = annual(key);
    const cur = a.find((p) => p.period === year)?.value ?? null;
    return {
      value: cur,
      change: pctChange(cur, a.find((p) => p.period === priorYear)?.value),
      spark: a.map((p) => p.value),
    };
  };
  const latest = violent.at(-1);

  return {
    year,
    priorYear,
    latestMonth: latest ? { label: formatPeriod(latest.period), coverage: coverage(latest) } : null,
    headline: {
      violent: headline("violent_crime"),
      homicide: headline("homicide"),
      property: headline("property_crime"),
    },
    annual: OFFENSES.map(([key, label]) => ({ key, label, points: toChartPoints(annual(key)) })),
    states: {
      metrics: stateMetrics.map((m) => ({ key: m.key, label: m.label, unit: "per_100k", period: `${year ?? ""}, per 100,000`, source: "FBI" })),
      rows: STATES_51.map((s) => ({
        abbr: s.abbr,
        name: s.name,
        values: Object.fromEntries(stateMetrics.map((m, i) => [m.key, stateSums[i].find((r) => r.geoid === s.fips)?.value ?? null])),
      })),
    },
    datasets: datasets.map((d) => ({ ...d, coverage: datasetCov[d.slug] ?? null })),
  };
}
