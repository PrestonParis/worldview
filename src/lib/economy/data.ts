// Everything /economy shows: jobs, prices, wages and incomes, growth, rates,
// the minimum wage, and the states — FRED series (BLS, BEA, Census, the
// Fed) plus ACS income and poverty, all from area_stats.

import { getSeriesMany } from "@/lib/db/stats";
import { formatValue } from "@/lib/format";
import { annualAverage, datasetsFor, last, recessionMarkers, stateTable, toPoints, yearAgo } from "@/lib/issues/series";
import type { StateMetric } from "@/components/charts/state-explorer";
import type { Series } from "@/components/charts/time-series-chart";

const FRED = "fred-economy";
const ACS = "census-acs1-social";

const METRICS = [
  "unemployment_rate", "payroll_jobs", "labor_force_participation", "prime_age_employment", "cpi", "inflation_rate", "core_inflation_rate",
  "avg_hourly_earnings", "real_median_weekly_earnings", "gdp_growth", "real_gdp_per_capita", "real_median_household_income",
  "consumer_sentiment", "fed_funds_rate", "recession", "federal_minimum_wage",
] as const;

export async function loadEconomy() {
  const s = await getSeriesMany(FRED, [...METRICS]);
  if (!s.unemployment_rate.length) return null;
  const recessions = (from: number) => recessionMarkers(s.recession, from);

  // ---- Jobs ----
  const unemployment: Series[] = [{ id: "u", label: "Unemployment rate", slot: 1, points: toPoints(s.unemployment_rate) }];
  const payrolls: Series[] = [{ id: "jobs", label: "Nonfarm payroll jobs", slot: 1, points: toPoints(s.payroll_jobs, 1970) }];
  const participation: Series[] = [
    { id: "lfpr", label: "Labor force participation, 16+", slot: 1, points: toPoints(s.labor_force_participation) },
    { id: "prime", label: "Employed, ages 25–54", slot: 2, points: toPoints(s.prime_age_employment) },
  ];

  // ---- Prices ----
  const inflation: Series[] = [
    { id: "cpi", label: "All items", slot: 1, points: toPoints(s.inflation_rate, 1960) },
    { id: "core", label: "Excluding food and energy", slot: 3, points: toPoints(s.core_inflation_rate, 1960) },
  ];

  // ---- Wages and income ----
  // Nominal wage growth against inflation, month by month.
  const ahe = s.avg_hourly_earnings;
  const aheYoy = ahe.flatMap((p) => {
    const prior = ahe.find((q) => q.period === p.period.replace(/^\d{4}/, (y) => String(Number(y) - 1)));
    return prior ? [{ ...p, value: (p.value / prior.value - 1) * 100 }] : [];
  });
  const wagesVsPrices: Series[] = [
    { id: "wages", label: "Average hourly earnings", slot: 1, points: toPoints(aheYoy) },
    { id: "prices", label: "Consumer prices", slot: 2, points: toPoints(s.inflation_rate, aheYoy[0] ? Number(aheYoy[0].period.slice(0, 4)) + 2 / 12 : 2007) },
  ];
  const weekly: Series[] = [{ id: "weekly", label: "Median weekly earnings, 1982–84 dollars", slot: 1, points: toPoints(s.real_median_weekly_earnings) }];
  const householdIncome: Series[] = [{ id: "hh", label: "Real median household income", slot: 1, points: toPoints(s.real_median_household_income) }];

  // ---- Growth, rates, confidence ----
  const gdpGrowth: Series[] = [{ id: "gdp", label: "Real GDP growth, annual rate", slot: 1, points: toPoints(s.gdp_growth, 2000) }];
  const gdpPerPerson: Series[] = [{ id: "pc", label: "Real GDP per person, 2017 dollars", slot: 1, points: toPoints(s.real_gdp_per_capita) }];
  const rates: Series[] = [{ id: "ff", label: "Federal funds rate", slot: 1, points: toPoints(s.fed_funds_rate) }];
  const sentiment: Series[] = [{ id: "sent", label: "Consumer sentiment", slot: 1, points: toPoints(s.consumer_sentiment, 1978) }];

  // ---- Minimum wage, nominal and in today's dollars ----
  const cpiYear = new Map(annualAverage(s.cpi).map((p) => [p.period, p.value]));
  const cpiLatestYear = [...cpiYear.keys()].at(-1);
  const cpiNow = cpiLatestYear ? cpiYear.get(cpiLatestYear)! : null;
  const fedMin = s.federal_minimum_wage;
  const realMin = cpiNow
    ? fedMin.flatMap((p) => (cpiYear.has(p.period) ? [{ ...p, value: (p.value * cpiNow) / cpiYear.get(p.period)! }] : []))
    : [];
  const minimumWage: Series[] = [
    { id: "nominal", label: "Federal minimum wage", slot: 1, points: toPoints(fedMin, 1947) },
    { id: "real", label: `In ${cpiLatestYear} dollars`, slot: 2, points: toPoints(realMin, 1947) },
  ];

  // ---- States ----
  const states = await stateTable([
    { source: FRED, metric: "unemployment_rate", label: "Unemployment rate", unit: "percent", group: "Jobs", sourceLabel: "BLS Local Area Unemployment Statistics", description: "Seasonally adjusted, latest month." },
    { source: FRED, metric: "unemployment_rate_annual", label: "Unemployment rate, last full year", unit: "percent", group: "Jobs", sourceLabel: "BLS Local Area Unemployment Statistics" },
    { source: ACS, metric: "median_household_income", label: "Median household income", unit: "usd", group: "Income", sourceLabel: "American Community Survey" },
    { source: FRED, metric: "per_capita_income", label: "Per capita personal income", unit: "usd", group: "Income", sourceLabel: "BEA" },
    { source: ACS, metric: "poverty_rate", label: "Poverty rate", unit: "percent", group: "Income", sourceLabel: "American Community Survey", description: "Share of people below the official poverty line." },
    { source: FRED, metric: "state_minimum_wage", label: "State minimum wage", unit: "usd_cents", group: "Minimum wage", sourceLabel: "Department of Labor", description: "Blank where the state has no minimum wage law." },
  ]);
  // The wage most covered workers must be paid: the higher of state and federal.
  const fedNow = last(fedMin);
  if (fedNow) {
    const effective: StateMetric = {
      key: "effective_minimum_wage", label: "Minimum wage in effect", unit: "usd_cents", group: "Minimum wage", source: "Department of Labor",
      period: states.metrics.find((m) => m.key === "state_minimum_wage")?.period ?? "",
      description: `The higher of the state rate and the federal ${formatValue(fedNow.value, "usd_cents")}.`,
    };
    states.metrics.splice(states.metrics.findIndex((m) => m.key === "state_minimum_wage"), 0, effective);
    for (const r of states.rows) r.values.effective_minimum_wage = Math.max(r.values.state_minimum_wage ?? 0, fedNow.value);
  }

  // ---- Headline ----
  const u = last(s.unemployment_rate);
  const infl = last(s.inflation_rate);
  const jobs = last(s.payroll_jobs);
  const jobsYearAgo = yearAgo(s.payroll_jobs);
  const income = last(s.real_median_household_income);
  const incomePrior = s.real_median_household_income.at(-2) ?? null;
  const headline = {
    unemployment: { point: u, spark: s.unemployment_rate.slice(-36).map((p) => p.value) },
    inflation: { point: infl, spark: s.inflation_rate.slice(-36).map((p) => p.value) },
    jobs: { point: jobs, added: jobs && jobsYearAgo ? jobs.value - jobsYearAgo.value : null, since: jobsYearAgo, spark: s.payroll_jobs.slice(-36).map((p) => p.value) },
    income: { point: income, prior: incomePrior, spark: s.real_median_household_income.map((p) => p.value) },
  };

  return {
    headline,
    unemployment,
    payrolls,
    participation,
    inflation,
    wagesVsPrices,
    weekly,
    householdIncome,
    gdpGrowth,
    gdpPerPerson,
    rates,
    sentiment,
    minimumWage,
    recessions,
    states,
    datasets: await datasetsFor([FRED, ACS]),
  };
}
