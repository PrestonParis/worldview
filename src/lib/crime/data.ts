// Everything /crime shows, from the FBI Crime Data Explorer rows in
// area_stats. Monthly rates per 100,000 sum to annual rates.
//
// The CDE's monthly rates divide the offenses reported by participating
// agencies by the whole population, so a month with lower participation
// reads lower. Comparisons therefore use complete, well-covered years, and
// the preliminary current-year view scales each month by its coverage.

import { datasetCoverage, getSeriesMany, listDatasets, yearlySumsByGeo, type Point, type YearlyValue } from "@/lib/db/stats";
import { STATES_51 } from "@/lib/geo/states";
import { formatPeriod, formatValue, pctChange } from "@/lib/format";
import {
  CLEARED,
  FULL_COVERAGE,
  OFFENSES,
  type ClearedKey,
  type OffenseKey,
  type OffenseTrend,
  type StateCrimeData,
  type YearValue,
} from "./offenses";
import { loadArrests, loadCities, loadHateCrime, loadStateExtras, loadVictimization, loadViolentDeaths } from "./sources";

// Agencies report late, so the newest months cover only part of the
// population. Headlines and state comparisons use the latest calendar year
// whose every month has at least this much coverage.
const MIN_COVERAGE = 90;
// Preliminary months shown for the current year need at least this much.
const PRELIM_COVERAGE = 85;
const PRE_PANDEMIC = "2019";

const round1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
const coverageOf = (p: Point) => (typeof p.metadata?.coverage === "number" ? (p.metadata.coverage as number) : null);
const theName = (name: string) => (name.startsWith("District") ? `the ${name}` : name);
const pctFmt = (v: number) => formatValue(Math.abs(v), "percent");

export async function loadCrime() {
  const keys = OFFENSES.map((o) => o.key);
  const rateMetrics = keys.map((k) => `${k}_rate`);
  const clearMetrics = keys.flatMap((k) => [`${k}_count`, `${k}_clearances`]);
  const stateMetrics = [...rateMetrics, ...CLEARED.flatMap((k) => [`${k}_count`, `${k}_clearances`])];

  const [monthly, nationYears, stateYears, datasets] = await Promise.all([
    getSeriesMany("fbi-cde", rateMetrics),
    yearlySumsByGeo("fbi-cde", [...rateMetrics, ...clearMetrics], "nation"),
    yearlySumsByGeo("fbi-cde", stateMetrics, "state"),
    listDatasets({ topic: "crime" }),
  ]);
  const datasetCov = await datasetCoverage(datasets.map((d) => d.slug));

  // Complete years: 12 months, every month at MIN_COVERAGE nationally.
  const violentYears = nationYears.filter((r) => r.metric === "violent_crime_rate").sort((a, b) => a.year.localeCompare(b.year));
  const fullYears = violentYears.filter((r) => r.months === 12);
  const complete = fullYears.filter((r) => (r.minCoverage ?? 0) >= MIN_COVERAGE).map((r) => r.year);
  const year = complete.at(-1) ?? null;
  const priorYear = year ? String(Number(year) - 1) : null;
  const years = fullYears.map((r) => r.year).filter((y) => !year || y <= year);
  const baseYear = years[0] ?? null;
  const flaggedYears = fullYears
    .filter((r) => years.includes(r.year) && (r.coverage ?? 0) < FULL_COVERAGE)
    .map((r) => ({ year: r.year, coverage: r.coverage }));
  const isFlagged = (y: string) => flaggedYears.some((f) => f.year === y);

  const nation = new Map(nationYears.map((r) => [`${r.metric}|${r.year}`, r]));
  const nationValue = (metric: string, y: string | null) => {
    const r = y ? nation.get(`${metric}|${y}`) : undefined;
    return r && r.months === 12 ? r.value : null;
  };
  const clearedShare = (get: (metric: string) => number | null, key: string) => {
    const n = get(`${key}_count`);
    const c = get(`${key}_clearances`);
    return n && c !== null ? (c / n) * 100 : null;
  };

  const offenses: OffenseTrend[] = OFFENSES.map((o) => {
    const rates = years.map((y) => ({ year: y, value: nationValue(`${o.key}_rate`, y) })).filter((p): p is YearValue => p.value !== null);
    const at = (y: string | null) => rates.find((p) => p.year === y)?.value ?? null;
    const solid = rates.filter((p) => !isFlagged(p.year));
    const latest = at(year);
    return {
      key: o.key,
      label: o.label,
      group: o.group,
      rates,
      latest,
      change1y: pctChange(latest, at(priorYear)),
      vsPre: pctChange(latest, at(PRE_PANDEMIC)),
      vsBase: pctChange(latest, at(baseYear)),
      peak: solid.length ? solid.reduce((a, b) => (b.value > a.value ? b : a)) : null,
      low: solid.length ? solid.reduce((a, b) => (b.value < a.value ? b : a)) : null,
      cleared: years
        .map((y) => ({ year: y, value: clearedShare((m) => nationValue(m, y), o.key) }))
        .filter((p): p is YearValue => p.value !== null),
    };
  });
  const offense = (key: OffenseKey) => offenses.find((o) => o.key === key)!;

  const states = buildStates(stateYears, years, year, offenses);
  const prelim = buildPrelim(monthly, year);
  const [victimization, deaths, hate, arrests, cities, extras] = await Promise.all([
    loadVictimization(),
    loadViolentDeaths(),
    loadHateCrime(year),
    loadArrests(year),
    loadCities(year, priorYear),
    loadStateExtras(year),
  ]);
  if (extras) states.extra = extras;

  const headline = (key: OffenseKey) => {
    const o = offense(key);
    return { value: o.latest, change: o.change1y, spark: o.rates.map((p) => p.value) };
  };

  return {
    year,
    priorYear,
    baseYear,
    preYear: PRE_PANDEMIC,
    flaggedYears,
    headline: {
      violent: headline("violent_crime"),
      homicide: headline("homicide"),
      property: headline("property_crime"),
      vehicle: headline("motor_vehicle_theft"),
    },
    offenses,
    prelim,
    states,
    victimization,
    deaths,
    hate,
    arrests,
    cities,
    findings: year
      ? buildFindings({ year, priorYear: priorYear!, baseYear: baseYear!, offenses, states, prelim, victimization, deaths })
      : [],
    datasets: datasets.map((d) => ({ ...d, coverage: datasetCov[d.slug] ?? null })),
  };
}

export type CrimeData = Awaited<ReturnType<typeof loadCrime>>;

function buildStates(rows: YearlyValue[], years: string[], year: string | null, offenses: OffenseTrend[]): StateCrimeData {
  const byKey = new Map(rows.map((r) => [`${r.geoid}|${r.metric}|${r.year}`, r]));
  const full = (fips: string, metric: string, y: string) => {
    const r = byKey.get(`${fips}|${metric}|${y}`);
    return r && r.months === 12 ? r : null;
  };
  const cleared = (fips: string) =>
    Object.fromEntries(
      CLEARED.map((k) => {
        const n = year ? full(fips, `${k}_count`, year)?.value : null;
        const c = year ? full(fips, `${k}_clearances`, year)?.value : null;
        return [k, n && c !== null && c !== undefined ? round1((c / n) * 100) : null];
      }),
    ) as Record<ClearedKey, number | null>;

  const usCleared = Object.fromEntries(
    CLEARED.map((k) => [k, round1(offenses.find((o) => o.key === k)!.cleared.find((p) => p.year === year)?.value ?? null)]),
  ) as Record<ClearedKey, number | null>;

  return {
    years,
    us: Object.fromEntries(
      offenses.map((o) => [o.key, years.map((y) => round1(o.rates.find((p) => p.year === y)?.value ?? null))]),
    ) as StateCrimeData["us"],
    usCleared,
    rows: STATES_51.map((s) => ({
      abbr: s.abbr,
      name: s.name,
      rates: Object.fromEntries(
        OFFENSES.map((o) => [o.key, years.map((y) => round1(full(s.fips, `${o.key}_rate`, y)?.value ?? null))]),
      ) as StateCrimeData["rows"][number]["rates"],
      coverage: years.map((y) => round1(full(s.fips, "violent_crime_rate", y)?.coverage ?? null)),
      cleared: cleared(s.fips),
    })),
  };
}

// The year after the latest complete one, through the last month whose
// coverage clears PRELIM_COVERAGE, against the same months a year earlier.
// Each month's rate is scaled up by its own coverage so months with
// different participation compare.
function buildPrelim(monthly: Record<string, Point[]>, year: string | null) {
  if (!year) return null;
  const cur = String(Number(year) + 1);
  const violent = monthly.violent_crime_rate.filter((p) => p.period.startsWith(`${cur}-`));
  if (!violent.length) return null;
  const months: string[] = [];
  for (const p of violent) {
    if ((coverageOf(p) ?? 0) < PRELIM_COVERAGE) break;
    months.push(p.period.slice(5));
  }
  const last = violent.at(-1)!;
  const base = {
    year: cur,
    reported: violent.map((p) => ({ label: formatPeriod(p.period), coverage: coverageOf(p) })),
    latestReported: { label: formatPeriod(last.period), coverage: coverageOf(last) },
  };
  if (!months.length) return { ...base, span: null, rows: [] };

  const scaled = (points: Point[], y: string) => {
    let sum = 0;
    for (const mm of months) {
      const p = points.find((q) => q.period === `${y}-${mm}`);
      const c = p && coverageOf(p);
      if (!p || !c) return null;
      sum += (p.value * 100) / c;
    }
    return sum;
  };
  const monthName = (mm: string) => formatPeriod(`${cur}-${mm}`).slice(0, 3);
  return {
    ...base,
    span: months.length === 1 ? monthName(months[0]) : `${monthName(months[0])}–${monthName(months.at(-1)!)}`,
    rows: OFFENSES.map((o) => {
      const pts = monthly[`${o.key}_rate`];
      const current = scaled(pts, cur);
      const prior = scaled(pts, year);
      return { key: o.key, label: o.label, current, prior, change: pctChange(current, prior) };
    }),
  };
}

// Plain factual statements computed from the numbers on the page.
function buildFindings({
  year,
  priorYear,
  baseYear,
  offenses,
  states,
  prelim,
  victimization,
  deaths,
}: {
  victimization: Awaited<ReturnType<typeof loadVictimization>>;
  deaths: Awaited<ReturnType<typeof loadViolentDeaths>>;
  year: string;
  priorYear: string;
  baseYear: string;
  offenses: OffenseTrend[];
  states: StateCrimeData;
  prelim: ReturnType<typeof buildPrelim>;
}): string[] {
  const out: string[] = [];
  const o = (k: OffenseKey) => offenses.find((x) => x.key === k)!;
  const dir = (v: number) => (v < 0 ? "fell" : "rose");
  const violent = o("violent_crime");
  const murder = o("homicide");
  const property = o("property_crime");

  if (violent.change1y !== null && violent.latest !== null) {
    out.push(
      `The U.S. violent crime rate ${dir(violent.change1y)} ${pctFmt(violent.change1y)} in ${year}, to ${formatValue(violent.latest, "per_100k")} per 100,000 residents.`,
    );
  }
  if (murder.change1y !== null && violent.change1y !== null) {
    const faster = Math.abs(murder.change1y) > Math.abs(violent.change1y);
    const same = Math.sign(murder.change1y) === Math.sign(violent.change1y);
    out.push(
      same
        ? `The murder rate ${dir(murder.change1y)} ${pctFmt(murder.change1y)} — ${faster ? "faster" : "slower"} than violent crime overall.`
        : `The murder rate ${dir(murder.change1y)} ${pctFmt(murder.change1y)} while violent crime overall ${dir(violent.change1y)}.`,
    );
  }
  for (const x of [violent, property]) {
    if (x.low?.year === year) out.push(`${x.label} is at its lowest rate in data back to ${baseYear}.`);
    else if (x.peak?.year === year) out.push(`${x.label} is at its highest rate in data back to ${baseYear}.`);
    else if (x.peak && x.latest !== null) {
      out.push(`${x.label} is ${pctFmt(pctChange(x.latest, x.peak.value)!)} below its ${x.peak.year} peak.`);
    }
  }
  const sinceBase = offenses.filter((x) => x.vsBase !== null).sort((a, b) => a.vsBase! - b.vsBase!);
  if (sinceBase.length > 1) {
    const [lo, hi] = [sinceBase[0], sinceBase.at(-1)!];
    out.push(
      lo.vsBase! < 0
        ? `Since ${baseYear}, the ${lo.label.toLowerCase()} rate has fallen most (−${pctFmt(lo.vsBase!)}); ${hi.label.toLowerCase()} has ${hi.vsBase! < 0 ? `fallen least (−${pctFmt(hi.vsBase!)})` : `risen ${pctFmt(hi.vsBase!)}`}.`
        : `Since ${baseYear}, every offense rate has risen; ${hi.label.toLowerCase()} most (+${pctFmt(hi.vsBase!)}).`,
    );
  }

  const i = states.years.indexOf(year);
  const j = states.years.indexOf(priorYear);
  const vals = states.rows
    .map((r) => ({ name: r.name, v: r.rates.violent_crime[i], p: j >= 0 ? r.rates.violent_crime[j] : null }))
    .filter((r): r is { name: string; v: number; p: number | null } => r.v !== null);
  if (vals.length) {
    const sorted = [...vals].sort((a, b) => b.v - a.v);
    out.push(
      `${theName(sorted[0].name).replace(/^the/, "The")} had the highest violent crime rate among the ${vals.length} jurisdictions shown (${formatValue(sorted[0].v, "per_100k")}); ${theName(sorted.at(-1)!.name)} had the lowest (${formatValue(sorted.at(-1)!.v, "per_100k")}).`,
    );
    const compared = vals.filter((r) => r.p !== null);
    const fell = compared.filter((r) => r.v < r.p!).length;
    if (compared.length) out.push(`Violent crime rates fell in ${fell} of ${compared.length} jurisdictions from ${priorYear} to ${year}.`);
  }

  const clr = (x: OffenseTrend) => x.cleared.find((p) => p.year === year)?.value;
  if (clr(murder) !== undefined && clr(violent) !== undefined) {
    out.push(
      `Police cleared ${formatValue(clr(murder), "percent")} of murders and ${formatValue(clr(violent), "percent")} of violent crimes reported in ${year}.`,
    );
  }
  if (victimization?.latest.violentReported != null) {
    out.push(
      `In the ${victimization.year} victimization survey, victims said ${formatValue(victimization.latest.violentReported, "percent")} of violent crimes were reported to police.`,
    );
  }
  if (deaths?.firearmShare != null) {
    out.push(`Death records show ${formatValue(deaths.firearmShare, "percent")} of homicides in ${deaths.year} were committed with a firearm.`);
  }
  const pv = prelim?.rows.find((r) => r.key === "violent_crime");
  if (prelim?.span && pv?.change !== null && pv?.change !== undefined) {
    out.push(
      `Preliminary ${prelim.year} reports (${prelim.span}) put violent crime ${pctFmt(pv.change)} ${pv.change < 0 ? "below" : "above"} the same months of ${year}.`,
    );
  }
  return out;
}
