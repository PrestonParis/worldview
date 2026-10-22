// Everything /spending shows: the federal budget from OMB's Historical
// Tables (receipts, outlays by function and program, deficits, debt),
// Treasury's monthly figures (debt to the penny, Monthly Treasury
// Statement, interest rates), improper-payment rates, and federal awards by
// state and congressional district from USAspending — all from area_stats.

import { datasetCoverage, getCrossSection, getSeriesMany, listDatasets, type Point } from "@/lib/db/stats";
import { STATES_51 } from "@/lib/geo/states";
import { formatPeriod, pctChange } from "@/lib/format";
import type { RankedItem } from "@/components/charts/ranked-bars";
import type { StateMetric, StateRow } from "@/components/charts/state-explorer";
import type { Series, SeriesPoint } from "@/components/charts/time-series-chart";

const OMB = "omb-historical-tables";
const TREASURY = "treasury-fiscal-data";
const ACCURACY = "payment-accuracy";
const AWARDS = "usaspending";
const PEP = "census-pep";

const fyX = (period: string) => Number(period.replace(/^FY/, ""));
const fySeries = (points: Point[] | undefined, scale = 1): SeriesPoint[] =>
  (points ?? []).map((p) => ({ x: fyX(p.period), label: p.period.replace(/^FY/, "FY "), value: p.value * scale }));
const monthSeries = (points: Point[] | undefined): SeriesPoint[] =>
  (points ?? []).map((p) => ({ x: Number(p.period.slice(0, 4)) + (Number(p.period.slice(5, 7)) - 1) / 12, label: formatPeriod(p.period), value: p.value }));
const last = (points: Point[] | undefined) => points?.at(-1) ?? null;
const at = (points: Point[] | undefined, period: string) => points?.find((p) => p.period === period)?.value ?? null;
const billions = (v: number) => `$${Math.round(v / 1e9).toLocaleString("en-US")} billion`;

// A share of GDP for each fiscal year a dollar series has.
function shareOfGdp(points: Point[] | undefined, gdp: Map<string, number>): SeriesPoint[] {
  return (points ?? []).flatMap((p) => {
    const g = gdp.get(p.period);
    return g ? [{ x: fyX(p.period), label: p.period.replace(/^FY/, "FY "), value: (p.value / g) * 100 }] : [];
  });
}

const FUNCTIONS: [key: string, label: string][] = [
  ["social_security", "Social Security"],
  ["medicare", "Medicare"],
  ["health", "Health (mostly Medicaid)"],
  ["net_interest", "Net interest"],
  ["national_defense", "National defense"],
  ["income_security", "Income security (SNAP, SSI, EITC, housing, …)"],
  ["veterans", "Veterans benefits"],
  ["education_training", "Education, training, and social services"],
  ["transportation", "Transportation"],
  ["community_development", "Community and regional development"],
  ["natural_resources", "Natural resources and environment"],
  ["international_affairs", "International affairs"],
  ["agriculture", "Agriculture"],
  ["justice", "Administration of justice"],
  ["science_space", "Science, space, and technology"],
  ["general_government", "General government"],
  ["energy", "Energy"],
  ["commerce_housing", "Commerce and housing credit"],
];

const PROGRAMS: [key: string, label: string][] = [
  ["social_security_retirement", "Social Security: retirement and survivors"],
  ["medicare_supplementary", "Medicare Parts B and D"],
  ["medicaid", "Medicaid"],
  ["medicare_hospital", "Medicare Part A (hospital)"],
  ["veterans_compensation", "Veterans' disability compensation"],
  ["veterans_health", "Veterans' healthcare"],
  ["social_security_disability", "Social Security disability"],
  ["civil_service_retirement", "Federal civilian retirement"],
  ["aca_premium_credits", "ACA premium tax credits"],
  ["snap", "SNAP (food stamps)"],
  ["military_retirement", "Military retirement"],
  ["eitc", "Earned income tax credit"],
  ["ssi", "Supplemental Security Income"],
  ["housing_assistance", "Housing assistance"],
  ["student_assistance", "Student aid"],
  ["child_nutrition", "School meals and child nutrition"],
  ["child_tax_credit", "Child tax credit"],
  ["unemployment", "Unemployment benefits"],
  ["chip", "Children's Health Insurance Program"],
  ["tanf", "TANF (cash welfare)"],
  ["wic", "WIC"],
];

const AWARD_METRICS: [key: string, label: string][] = [
  ["federal_grants", "Grants"],
  ["federal_contracts", "Contracts"],
  ["federal_direct_payments", "Direct payments"],
  ["federal_spending_total", "All awards"],
  ["federal_loans", "Loans"],
];

export async function loadSpending() {
  const [omb, programs, treasury, accuracy, datasets] = await Promise.all([
    getSeriesMany(OMB, [
      "receipts", "outlays", "deficit", "gdp", "receipts_pct_gdp", "outlays_pct_gdp", "deficit_pct_gdp",
      "debt_public", "debt_gross", "debt_fed_reserve", "debt_public_pct_gdp", "debt_gross_pct_gdp",
      "grants_to_states", "grants_to_states_individuals", "grants_to_states_capital",
      ...FUNCTIONS.map(([k]) => `outlays_${k}`),
    ]),
    getSeriesMany(OMB, [...PROGRAMS.map(([k]) => `payments_${k}`), "payments_total"]),
    getSeriesMany(TREASURY, ["debt_total", "debt_public", "receipts", "outlays", "deficit", "avg_interest_rate"]),
    getSeriesMany(ACCURACY, ["payment_accuracy_rate", "improper_payment_rate", "unknown_payment_rate"]),
    listDatasets({ topic: "spending" }),
  ]);
  if (!omb.outlays.length) return null;

  const gdp = new Map(omb.gdp.map((p) => [p.period, p.value]));
  const fy = last(omb.outlays)!.period; // latest actual fiscal year
  const fyPrior = `FY${fyX(fy) - 1}`;
  const fy10 = `FY${fyX(fy) - 10}`;

  // ---- Where the money goes ----
  const byFunction: RankedItem[] = FUNCTIONS.flatMap(([k, label]) => {
    const v = at(omb[`outlays_${k}`], fy);
    const share = v !== null ? (v / at(omb.outlays, fy)!) * 100 : null;
    return v === null || v <= 0 ? [] : [{ label, value: v, note: share !== null ? `${share.toFixed(1)}% of spending` : undefined }];
  }).sort((a, b) => b.value - a.value);
  const byProgram: RankedItem[] = PROGRAMS.flatMap(([k, label]) => {
    const v = at(programs[`payments_${k}`], fy);
    const then = at(programs[`payments_${k}`], fy10);
    const ch = pctChange(v, then);
    return v === null || v <= 0 ? [] : [{ label, value: v, note: ch !== null ? `${ch > 0 ? "+" : ""}${Math.round(ch)}% since ${fy10.replace(/^FY/, "FY ")}` : undefined }];
  }).sort((a, b) => b.value - a.value);

  // ---- Over time, as shares of GDP ----
  const balance: Series[] = [
    { id: "outlays", label: "Outlays", slot: 2, points: fySeries(omb.outlays_pct_gdp) },
    { id: "receipts", label: "Receipts", slot: 1, points: fySeries(omb.receipts_pct_gdp) },
  ];
  const deficitShare: Series[] = [{ id: "deficit", label: "Deficit (share of GDP)", slot: 2, points: fySeries(omb.deficit_pct_gdp) }];
  const bigThree: Series[] = [
    { id: "ss", label: "Social Security", slot: 1, points: shareOfGdp(omb.outlays_social_security, gdp) },
    { id: "defense", label: "National defense", slot: 3, points: shareOfGdp(omb.outlays_national_defense, gdp) },
    { id: "interest", label: "Net interest", slot: 2, points: shareOfGdp(omb.outlays_net_interest, gdp) },
  ];
  const healthSeries: Series[] = [
    { id: "medicare", label: "Medicare", slot: 1, points: shareOfGdp(omb.outlays_medicare, gdp) },
    { id: "health", label: "Health (mostly Medicaid)", slot: 3, points: shareOfGdp(omb.outlays_health, gdp) },
    { id: "income", label: "Income security", slot: 2, points: shareOfGdp(omb.outlays_income_security, gdp) },
  ];

  // ---- Debt and interest ----
  const debtShare: Series[] = [
    { id: "public", label: "Held by the public", slot: 1, points: fySeries(omb.debt_public_pct_gdp) },
    { id: "gross", label: "Gross debt (including trust funds)", slot: 1, color: "var(--viz-muted)", points: fySeries(omb.debt_gross_pct_gdp) },
  ];
  const debtMonthly: Series[] = [
    { id: "total", label: "Total public debt", slot: 1, points: monthSeries(treasury.debt_total) },
    { id: "public", label: "Held by the public", slot: 3, points: monthSeries(treasury.debt_public) },
  ];
  const interestRate: Series[] = [{ id: "rate", label: "Average interest rate on federal debt", slot: 2, points: monthSeries(treasury.avg_interest_rate) }];
  const since = (s: SeriesPoint[], year: number) => s.filter((p) => p.x >= year);
  const interestVsDefense: Series[] = [
    { id: "interest", label: "Net interest", slot: 2, points: since(fySeries(omb.outlays_net_interest), 2000) },
    { id: "defense", label: "National defense", slot: 3, points: since(fySeries(omb.outlays_national_defense), 2000) },
    { id: "medicaid", label: "Medicaid", slot: 1, points: since(fySeries(programs.payments_medicaid), 2000) },
  ];

  // ---- This fiscal year so far (Monthly Treasury Statement) ----
  const lastMonth = last(treasury.deficit);
  const ytd = (() => {
    if (!lastMonth) return null;
    const [y, m] = lastMonth.period.split("-").map(Number);
    const fyNow = m >= 10 ? y + 1 : y;
    const inFy = (period: string, f: number) => {
      const [py, pm] = period.split("-").map(Number);
      const pf = pm >= 10 ? py + 1 : py;
      const monthIndex = (pm + 2) % 12; // October = 0
      return pf === f && monthIndex <= (m + 2) % 12;
    };
    const total = (points: Point[], f: number) => points.filter((p) => inFy(p.period, f)).reduce((t, p) => t + p.value, 0);
    return {
      fy: `FY ${fyNow}`,
      through: formatPeriod(lastMonth.period),
      deficit: total(treasury.deficit, fyNow),
      receipts: total(treasury.receipts, fyNow),
      outlays: total(treasury.outlays, fyNow),
      priorDeficit: total(treasury.deficit, fyNow - 1),
      prior: `FY ${fyNow - 1}`,
    };
  })();
  const monthly: Series[] = [
    { id: "outlays", label: "Outlays", slot: 2, points: monthSeries(treasury.outlays).slice(-36) },
    { id: "receipts", label: "Receipts", slot: 1, points: monthSeries(treasury.receipts).slice(-36) },
  ];

  // ---- Grants to states ----
  const grants: Series[] = [
    { id: "individuals", label: "For payments to individuals (mostly Medicaid)", slot: 1, points: since(fySeries(omb.grants_to_states_individuals), 1980) },
    { id: "capital", label: "For capital investment (highways, transit, …)", slot: 3, points: since(fySeries(omb.grants_to_states_capital), 1980) },
  ];

  // ---- Improper payments ----
  const improper: Series[] = [
    { id: "improper", label: "Improper payments", slot: 2, points: fySeries(accuracy.improper_payment_rate) },
    { id: "unknown", label: "Unknown (could not be verified)", slot: 1, color: "var(--viz-muted)", points: fySeries(accuracy.unknown_payment_rate) },
  ];

  // ---- States and districts (USAspending awards) ----
  const awardYear = (await getCrossSection(AWARDS, "federal_spending_total", "state")).period;
  const [stateCross, pop, districts] = await Promise.all([
    Promise.all(AWARD_METRICS.map(([k]) => getCrossSection(AWARDS, k, "state", { period: awardYear ?? undefined }))),
    getCrossSection(PEP, "population", "state", { period: awardYear ? awardYear.replace(/^FY/, "") : undefined }),
    getCrossSection(AWARDS, "federal_contracts", "cd", { period: awardYear ?? undefined }),
  ]);
  const popOf = new Map(pop.values.map((v) => [v.geoid, v.value]));
  const awardMaps = stateCross.map((c) => new Map(c.values.map((v) => [v.geoid, v.value])));
  const awardLabel = awardYear?.replace(/^FY/, "FY ") ?? "";
  const stateMetrics: StateMetric[] = [
    ...AWARD_METRICS.map(([k, label]) => ({
      key: `${k}_per_capita`, label: `${label} per resident`, unit: "usd", period: awardLabel, source: "USAspending.gov, Census population estimates", group: "Per resident",
      ...(k === "federal_direct_payments" || k === "federal_spending_total"
        ? { description: "Direct payments are recorded where USAspending places the payment, not where recipients live, so a few states (such as North Dakota and Minnesota) show very large totals." }
        : {}),
    })),
    ...AWARD_METRICS.map(([k, label]) => ({ key: k, label, unit: "usd", period: awardLabel, source: "USAspending.gov", group: "Total" })),
  ];
  const stateRows: StateRow[] = STATES_51.map((s) => {
    const people = popOf.get(s.fips) ?? null;
    const values: Record<string, number | null> = {};
    AWARD_METRICS.forEach(([k], i) => {
      const v = awardMaps[i].get(s.fips) ?? null;
      values[k] = v;
      values[`${k}_per_capita`] = v !== null && people ? v / people : null;
    });
    return { abbr: s.abbr, name: s.name, values };
  });
  const topDistricts: RankedItem[] = districts.values
    .filter((v) => !/-(98|99)$/.test(v.geoName ?? "")) // non-voting / unassigned codes
    .slice(0, 15)
    .map((v) => ({ label: v.geoName ?? v.geoid, value: v.value }));

  // ---- Headline ----
  const debtNow = last(treasury.debt_total);
  const headline = {
    fy: fy.replace(/^FY/, "FY "),
    debt: { point: debtNow, asOf: (debtNow?.metadata?.as_of as string | undefined) ?? null, spark: treasury.debt_total.slice(-60).map((p) => p.value) },
    outlays: { value: at(omb.outlays, fy), share: at(omb.outlays_pct_gdp, fy), change: pctChange(at(omb.outlays, fy), at(omb.outlays, fyPrior)), spark: omb.outlays.slice(-20).map((p) => p.value) },
    deficit: { value: at(omb.deficit, fy), share: at(omb.deficit_pct_gdp, fy), spark: omb.deficit.slice(-20).map((p) => p.value) },
    interest: { value: at(omb.outlays_net_interest, fy), spark: omb.outlays_net_interest.slice(-20).map((p) => p.value) },
  };

  const order = [OMB, TREASURY, AWARDS, ACCURACY];
  const cov = await datasetCoverage(datasets.map((d) => d.slug));
  return {
    headline,
    fy: headline.fy,
    byFunction,
    byProgram,
    balance,
    deficitShare,
    bigThree,
    healthSeries,
    debtShare,
    debtMonthly,
    interestRate,
    interestVsDefense,
    ytd: ytd && { ...ytd, priorLabel: billions(ytd.priorDeficit), deficitLabel: billions(ytd.deficit) },
    monthly,
    grants,
    improper,
    states: { metrics: stateMetrics, rows: stateRows },
    awardYear: awardLabel,
    topDistricts,
    datasets: [...datasets]
      .sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug))
      .map((d) => ({ ...d, coverage: cov[d.slug] ?? null })),
  };
}
