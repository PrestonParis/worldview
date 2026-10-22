// Everything /housing shows: home prices and affordability, mortgage rates,
// construction, rents and rent burden, homeownership, and the states — FRED
// series (S&P CoreLogic, Census, Freddie Mac, FHFA, BLS) and the ACS, all
// from area_stats.

import { getSeriesMany, type Point } from "@/lib/db/stats";
import { datasetsFor, last, stateTable, toPoints, yearAgo } from "@/lib/issues/series";
import type { Series } from "@/components/charts/time-series-chart";

const FRED = "fred-housing";
const ECON = "fred-economy";
const ACS = "census-acs1-housing";
const SOCIAL = "census-acs1-social";

// Monthly principal and interest on a 30-year fixed loan for 80% of the price.
const payment = (price: number, ratePct: number) => {
  const r = ratePct / 100 / 12;
  const loan = price * 0.8;
  return (loan * r) / (1 - (1 + r) ** -360);
};

const quarterOf = (period: string) => `${period.slice(0, 4)}-Q${Math.floor((Number(period.slice(5, 7)) - 1) / 3) + 1}`;

export async function loadHousing() {
  const [f, econ, acs] = await Promise.all([
    getSeriesMany(FRED, ["home_price_index", "home_price_growth", "median_home_sale_price", "mortgage_rate_30y", "housing_starts", "homeownership_rate", "rental_vacancy_rate", "rent_inflation"]),
    getSeriesMany(ECON, ["median_household_income", "inflation_rate"]),
    getSeriesMany(ACS, ["median_gross_rent", "median_home_value", "rent_burdened_share", "severely_rent_burdened_share", "median_rent_share_of_income", "owner_occupied_share"]),
  ]);
  if (!f.mortgage_rate_30y.length) return null;

  // ---- Prices and affordability ----
  const prices: Series[] = [{ id: "median", label: "Median sales price of houses sold", slot: 1, points: toPoints(f.median_home_sale_price, 1975) }];
  const priceGrowth: Series[] = [
    { id: "homes", label: "Home prices", slot: 1, points: toPoints(f.home_price_growth) },
    { id: "rent", label: "Rents", slot: 2, points: toPoints(f.rent_inflation, 1988) },
    { id: "cpi", label: "All consumer prices", slot: 3, color: "var(--viz-muted)", points: toPoints(econ.inflation_rate, 1988) },
  ];

  // Price-to-income: the year's average median sale price over median household income.
  const yearPrice = new Map<string, number[]>();
  for (const p of f.median_home_sale_price) yearPrice.set(p.period.slice(0, 4), [...(yearPrice.get(p.period.slice(0, 4)) ?? []), p.value]);
  const priceToIncome: Point[] = econ.median_household_income.flatMap((p) => {
    const qs = yearPrice.get(p.period);
    return qs?.length === 4 ? [{ ...p, value: qs.reduce((a, b) => a + b, 0) / 4 / p.value }] : [];
  });
  const ratio: Series[] = [{ id: "ratio", label: "Median house price ÷ median household income", slot: 1, points: toPoints(priceToIncome) }];

  // Mortgage payment on the median house, by quarter.
  const rateByQuarter = new Map<string, number[]>();
  for (const p of f.mortgage_rate_30y) rateByQuarter.set(quarterOf(p.period), [...(rateByQuarter.get(quarterOf(p.period)) ?? []), p.value]);
  const payments: Point[] = f.median_home_sale_price.flatMap((p) => {
    const rs = rateByQuarter.get(p.period);
    return rs?.length === 3 ? [{ ...p, value: payment(p.value, rs.reduce((a, b) => a + b, 0) / 3) }] : [];
  });
  const paymentSeries: Series[] = [{ id: "pay", label: "Monthly principal and interest", slot: 2, points: toPoints(payments) }];
  const mortgage: Series[] = [{ id: "rate", label: "30-year fixed mortgage rate", slot: 1, points: toPoints(f.mortgage_rate_30y) }];

  // ---- Supply ----
  const starts: Series[] = [{ id: "starts", label: "Housing starts, annual rate", slot: 1, points: toPoints(f.housing_starts) }];
  const vacancy: Series[] = [{ id: "vac", label: "Rental vacancy rate", slot: 3, points: toPoints(f.rental_vacancy_rate, 1980) }];

  // ---- Renting ----
  const rentBurden: Series[] = [
    { id: "30", label: "Paying 30% or more of income", slot: 2, points: toPoints(acs.rent_burdened_share) },
    { id: "50", label: "Paying 50% or more", slot: 3, points: toPoints(acs.severely_rent_burdened_share) },
  ];
  const rent: Series[] = [{ id: "rent", label: "Median gross rent", slot: 1, points: toPoints(acs.median_gross_rent) }];

  // ---- Ownership ----
  const ownership: Series[] = [{ id: "own", label: "Homeownership rate", slot: 1, points: toPoints(f.homeownership_rate) }];

  // ---- States ----
  const states = await stateTable([
    { source: ACS, metric: "median_home_value", label: "Median home value", unit: "usd", group: "Prices", sourceLabel: "American Community Survey", description: "Owner's estimate, owner-occupied homes." },
    { source: FRED, metric: "home_price_growth", label: "Home price growth, last full year", unit: "percent", group: "Prices", sourceLabel: "FHFA", description: "Change in the annual average of the FHFA all-transactions index." },
    { source: ACS, metric: "median_gross_rent", label: "Median gross rent", unit: "usd", group: "Rent", sourceLabel: "American Community Survey", description: "Monthly rent plus utilities." },
    { source: ACS, metric: "rent_burdened_share", label: "Renters paying 30%+ of income", unit: "percent", group: "Rent", sourceLabel: "American Community Survey" },
    { source: ACS, metric: "severely_rent_burdened_share", label: "Renters paying 50%+ of income", unit: "percent", group: "Rent", sourceLabel: "American Community Survey" },
    { source: FRED, metric: "homeownership_rate", label: "Homeownership rate", unit: "percent", group: "Ownership", sourceLabel: "Census Housing Vacancy Survey" },
    { source: SOCIAL, metric: "median_household_income", key: "income", label: "Median household income", unit: "usd", group: "Income", sourceLabel: "American Community Survey" },
  ]);
  const valueMetric = states.metrics.find((m) => m.key === "median_home_value")!;
  states.metrics.splice(1, 0, {
    key: "value_to_income", label: "Home value to income", unit: "times", group: "Prices", source: "American Community Survey",
    period: valueMetric.period, description: "Median home value divided by median household income.",
  });
  for (const r of states.rows) {
    const v = r.values.median_home_value;
    const inc = r.values.income;
    r.values.value_to_income = v !== null && inc ? v / inc : null;
  }

  // ---- Headline ----
  const price = last(f.median_home_sale_price);
  const rate = last(f.mortgage_rate_30y);
  const burden = last(acs.rent_burdened_share);
  const own = last(f.homeownership_rate);
  const headline = {
    price: { point: price, prior: yearAgo(f.median_home_sale_price), spark: f.median_home_sale_price.slice(-24).map((p) => p.value) },
    rate: { point: rate, spark: f.mortgage_rate_30y.slice(-60).map((p) => p.value) },
    burden: { point: burden, spark: acs.rent_burdened_share.map((p) => p.value) },
    own: { point: own, spark: f.homeownership_rate.slice(-40).map((p) => p.value) },
  };

  return {
    headline,
    prices,
    priceGrowth,
    ratio,
    paymentSeries,
    mortgage,
    starts,
    vacancy,
    rentBurden,
    rent,
    ownership,
    states,
    datasets: await datasetsFor([FRED, ACS, ECON, SOCIAL]),
  };
}
