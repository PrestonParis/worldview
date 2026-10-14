// Imports the federal budget into `area_stats` (nation only) from three
// sources:
//
//   omb-historical-tables   OMB Historical Tables (the latest President's
//                           Budget edition), actual fiscal years only —
//                           budget-year estimates are skipped. Period 'FY2025'.
//     receipts, outlays, deficit (outlays − receipts)            Table 1.1, 1901–
//     gdp, receipts_pct_gdp, outlays_pct_gdp, deficit_pct_gdp    Table 1.2, 1930–
//     outlays_<function>     outlays by budget function           Table 3.1, 1940–
//     payments_<program>     payments for individuals by program  Table 11.3, 1940–
//     grants_to_states, grants_to_states_individuals,
//     grants_to_states_capital                                    Table 12.1, 1940–
//     debt_gross, debt_public, debt_fed_reserve, debt_gross_pct_gdp,
//     debt_public_pct_gdp                                         Table 7.1, 1940–
//   Dollar amounts are stored in dollars (the tables are in millions).
//
//   treasury-fiscal-data    Treasury Fiscal Data API
//     debt_total, debt_public, debt_intragovernmental   Debt to the Penny,
//                           last business day of each month ('YYYY-MM'), 1993–
//     receipts, outlays, deficit   Monthly Treasury Statement Table 1, by
//                           month ('YYYY-MM'), FY2014–; later reports revise
//     avg_interest_rate     average interest rate on interest-bearing debt,
//                           monthly, 2001–
//
//   payment-accuracy        PaymentAccuracy.gov government-wide rates for
//                           programs susceptible to improper payments, FY2021–
//     payment_accuracy_rate, improper_payment_rate, unknown_payment_rate
//
// Usage:
//   node scripts/import-federal-budget.mjs [--only=omb,treasury,accuracy]
//   ENV_FILE=.env.cloud node scripts/import-federal-budget.mjs

import { arg, fetchJson, fetchRetry, num, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { readXlsx } from "./lib/xlsx.mjs";

const ONLY = new Set(arg("only", "omb,treasury,accuracy").split(","));
const KEY = ["source", "metric", "geo_level", "geoid", "period"];
const COLUMNS = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
const US = { geo_level: "nation", geoid: "US", geo_name: "United States" };
const MILLION = 1e6;

// Fiscal year Y runs October Y-1 to September Y.
const fyRow = (source, metric, year, value, unit, metadata = null) => ({
  source, metric, ...US, period: `FY${year}`, period_start: `${year - 1}-10-01`, value, unit, metadata,
});
const monthRow = (source, metric, month, value, unit, metadata = null) => ({
  source, metric, ...US, period: month, period_start: `${month}-01`, value, unit, metadata,
});

// ---- OMB Historical Tables -------------------------------------------------------

const OMB_PAGE = "https://www.whitehouse.gov/omb/information-resources/budget/historical-tables/";

async function ombTable(links, id) {
  const url = links.find((l) => l.includes(`hist${id}_`));
  if (!url) throw new Error(`OMB: no link for table ${id}`);
  const buf = Buffer.from(await (await fetchRetry(url, {}, { label: url })).arrayBuffer());
  return { rows: Object.values(readXlsx(buf))[0], url };
}

const isYear = (v) => /^\d{4}$/.test(String(v ?? "").trim());

// Budget functions in Table 3.1 (label -> metric suffix).
const FUNCTIONS = {
  "National Defense": "national_defense",
  "Education, Training, Employment, and Social Services": "education_training",
  Health: "health",
  Medicare: "medicare",
  "Income Security": "income_security",
  "Social Security": "social_security",
  "Veterans Benefits and Services": "veterans",
  Energy: "energy",
  "Natural Resources and Environment": "natural_resources",
  "Commerce and Housing Credit": "commerce_housing",
  Transportation: "transportation",
  "Community and Regional Development": "community_development",
  "Net interest": "net_interest",
  "International Affairs": "international_affairs",
  "General Science, Space, and Technology": "science_space",
  Agriculture: "agriculture",
  "Administration of Justice": "justice",
  "General Government": "general_government",
  "Undistributed offsetting receipts": "offsetting_receipts",
  "Total, Federal outlays": "total",
};

// Payments for individuals in Table 11.3 (label -> metric suffix).
const PROGRAMS = {
  "Social security: old age and survivors insurance": "social_security_retirement",
  "Social security: disability insurance": "social_security_disability",
  "Medicare: hospital insurance": "medicare_hospital",
  "Medicare: supplementary medical insurance": "medicare_supplementary",
  Medicaid: "medicaid",
  "Children's health insurance": "chip",
  "Refundable Premium Tax Credit and Cost Sharing Reductions": "aca_premium_credits",
  "Hospital and medical care for veterans": "veterans_health",
  "Veterans service-connected compensation": "veterans_compensation",
  "Military retirement": "military_retirement",
  "Civil service retirement": "civil_service_retirement",
  "Unemployment Assistance": "unemployment",
  "SNAP (formerly Food stamps)(including Puerto Rico)": "snap",
  "Child nutrition and special milk programs": "child_nutrition",
  "Supplemental feeding programs (WIC and CSFP)": "wic",
  "Housing assistance": "housing_assistance",
  "Supplemental security income program": "ssi",
  "Family support payments to States and TANF": "tanf",
  "Earned income tax credit": "eitc",
  "Child Tax Credit and Child and Dependent Care Tax Credit": "child_tax_credit",
  "Student assistance--Department of Education and other": "student_assistance",
  "U.S. Coronavirus payments and credits": "coronavirus_payments",
  "Total, payments for individuals": "total",
};

async function importOmb(pg) {
  const S = "omb-historical-tables";
  await registerDataset(pg, S);
  const page = await (await fetchRetry(OMB_PAGE, {}, { label: "OMB historical tables page" })).text();
  const links = [...new Set(page.match(/https?:\/\/[^"'\s]+hist\d\dz\d+_fy\d{4}\.xlsx/g) ?? [])];
  const edition = links[0]?.match(/_fy(\d{4})/)?.[1];
  if (!edition) throw new Error("OMB: no table links found — page layout changed?");
  const meta = { edition: `FY${edition} Budget` };
  const rows = [];
  const add = (metric, year, value, unit) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return;
    rows.push(fyRow(S, metric, Number(year), value, unit, meta));
  };

  // 1.1 receipts, outlays, surplus (millions).
  const t11 = (await ombTable(links, "01z1")).rows;
  for (const r of t11) {
    if (!isYear(r[0])) continue;
    const [receipts, outlays] = [num(r[1]), num(r[2])];
    if (receipts === null || outlays === null) continue;
    add("receipts", r[0], receipts * MILLION, "usd");
    add("outlays", r[0], outlays * MILLION, "usd");
    add("deficit", r[0], (outlays - receipts) * MILLION, "usd");
  }

  // 1.2 as % of GDP.
  const t12 = (await ombTable(links, "01z2")).rows;
  for (const r of t12) {
    if (!isYear(r[0])) continue;
    add("gdp", r[0], num(r[1]) === null ? null : num(r[1]) * 1e9, "usd");
    add("receipts_pct_gdp", r[0], num(r[2]), "percent");
    add("outlays_pct_gdp", r[0], num(r[3]), "percent");
    const surplus = num(r[4]);
    add("deficit_pct_gdp", r[0], surplus === null ? null : -surplus, "percent");
  }

  // 7.1 federal debt, end of year.
  const t71 = (await ombTable(links, "07z1")).rows;
  for (const r of t71) {
    if (!isYear(r[0])) continue;
    const m = (v) => (num(v) === null ? null : num(v) * MILLION);
    add("debt_gross", r[0], m(r[1]), "usd");
    add("debt_public", r[0], m(r[3]), "usd");
    add("debt_fed_reserve", r[0], m(r[4]), "usd");
    add("debt_gross_pct_gdp", r[0], num(r[6]), "percent");
    add("debt_public_pct_gdp", r[0], num(r[8]), "percent");
  }

  // 3.1 outlays by function: years across, dollar block first.
  const t31 = (await ombTable(links, "03z1")).rows;
  const years31 = t31.find((r) => r.filter(isYear).length > 10);
  const end31 = t31.findIndex((r) => /As percentages of outlays/i.test(String(r[0] ?? "")));
  const seen = new Set();
  for (const r of t31.slice(0, end31 < 0 ? undefined : end31)) {
    const key = FUNCTIONS[String(r[0] ?? "").trim()];
    if (!key || seen.has(key)) continue; // a function's first row, not its (On-/Off-budget) lines
    seen.add(key);
    years31.forEach((y, i) => isYear(y) && add(`outlays_${key}`, y, num(r[i]) === null ? null : num(r[i]) * MILLION, "usd"));
  }
  const missing31 = Object.values(FUNCTIONS).filter((k) => !seen.has(k));
  if (missing31.length) throw new Error(`OMB 3.1: functions not found: ${missing31.join(", ")}`);

  // 11.3 payments for individuals: each year has Total (and later Direct,
  // Grants) columns; take Total.
  const t113 = (await ombTable(links, "11z3")).rows;
  const yearRow = t113.findIndex((r) => r.filter(isYear).length > 10);
  const yearCols = [];
  let year = null;
  t113[yearRow].forEach((cell, i) => {
    if (isYear(cell)) year = String(cell).trim();
    else if (cell !== null && cell !== undefined && cell !== "") year = null; // "2026 estimate"
    if (year && /^Total$/i.test(String(t113[yearRow + 1]?.[i] ?? ""))) yearCols.push([year, i]);
  });
  const found = new Set();
  for (const r of t113.slice(yearRow + 2)) {
    const key = PROGRAMS[String(r[0] ?? "").trim()];
    if (!key || found.has(key)) continue;
    found.add(key);
    for (const [y, i] of yearCols) add(`payments_${key}`, y, num(r[i]) === null ? null : num(r[i]) * MILLION, "usd");
  }
  const missing113 = Object.values(PROGRAMS).filter((k) => !found.has(k));
  if (missing113.length) throw new Error(`OMB 11.3: programs not found: ${missing113.join(", ")}`);

  // 12.1 grants to state and local governments.
  const t121 = (await ombTable(links, "12z1")).rows;
  for (const r of t121) {
    if (!isYear(r[0])) continue;
    const m = (v) => (num(v) === null ? null : num(v) * MILLION);
    add("grants_to_states", r[0], m(r[1]), "usd");
    add("grants_to_states_individuals", r[0], m(r[2]), "usd");
    add("grants_to_states_capital", r[0], m(r[3]), "usd");
  }

  const inserted = await upsertRows(pg, "area_stats", COLUMNS, rows, KEY);
  console.log(`  ${S}: FY${edition} edition, ${rows.length} rows`);
  return inserted;
}

// ---- Treasury Fiscal Data ---------------------------------------------------------

const FISCAL = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service";

async function allPages(path, params) {
  const out = [];
  for (let page = 1; ; page++) {
    const url = `${FISCAL}/${path}?${params}&page%5Bsize%5D=10000&page%5Bnumber%5D=${page}`;
    const res = await fetchJson(url, {}, { label: path });
    out.push(...res.data);
    if (page >= (res.meta?.["total-pages"] ?? 1)) return out;
  }
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

async function importTreasury(pg) {
  const S = "treasury-fiscal-data";
  await registerDataset(pg, S);
  const rows = [];

  // Debt to the Penny: the last business day of each month.
  const debt = await allPages("v2/accounting/od/debt_to_penny", "fields=record_date,tot_pub_debt_out_amt,debt_held_public_amt,intragov_hold_amt&sort=record_date");
  const monthEnd = new Map();
  for (const r of debt) monthEnd.set(r.record_date.slice(0, 7), r);
  for (const [month, r] of monthEnd) {
    const meta = { as_of: r.record_date };
    const add = (metric, v) => v !== null && rows.push(monthRow(S, metric, month, v, "usd", meta));
    add("debt_total", num(r.tot_pub_debt_out_amt));
    add("debt_public", num(r.debt_held_public_amt));
    add("debt_intragovernmental", num(r.intragov_hold_amt));
  }

  // Monthly Treasury Statement, Table 1: each report lists the prior fiscal
  // year's months (section 1) and the current year to date (section 2).
  // Reports are applied oldest first, so revisions win.
  const mts = await allPages(
    "v1/accounting/mts/mts_table_1",
    "fields=record_date,classification_desc,record_type_cd,sequence_number_cd,current_month_gross_rcpt_amt,current_month_gross_outly_amt&sort=record_date",
  );
  const byReport = new Map();
  for (const r of mts) (byReport.get(r.record_date) ?? byReport.set(r.record_date, []).get(r.record_date)).push(r);
  const months = new Map();
  for (const [date, report] of [...byReport].sort(([a], [b]) => a.localeCompare(b))) {
    const fyOfSection = {};
    for (const r of report) {
      const fy = r.record_type_cd === "SL" && r.classification_desc.match(/^FY (\d{4})$/)?.[1];
      if (fy) fyOfSection[r.sequence_number_cd.split(".")[0]] = Number(fy);
    }
    for (const r of report) {
      const mi = MONTHS.indexOf(r.classification_desc);
      const fy = fyOfSection[r.sequence_number_cd.split(".")[0]];
      if (r.record_type_cd !== "MTH" || mi < 0 || !fy) continue;
      const calYear = mi >= 9 ? fy - 1 : fy;
      const month = `${calYear}-${String(mi + 1).padStart(2, "0")}`;
      const receipts = num(r.current_month_gross_rcpt_amt);
      const outlays = num(r.current_month_gross_outly_amt);
      if (receipts === null || outlays === null) continue;
      months.set(month, { receipts, outlays, report: date });
    }
  }
  for (const [month, m] of months) {
    const meta = { report: m.report };
    rows.push(monthRow(S, "receipts", month, m.receipts, "usd", meta));
    rows.push(monthRow(S, "outlays", month, m.outlays, "usd", meta));
    rows.push(monthRow(S, "deficit", month, m.outlays - m.receipts, "usd", meta));
  }

  // Average interest rate on all interest-bearing debt.
  const rates = await allPages(
    "v2/accounting/od/avg_interest_rates",
    "fields=record_date,security_desc,avg_interest_rate_amt&filter=security_desc:eq:Total%20Interest-bearing%20Debt&sort=record_date",
  );
  for (const r of rates) {
    const v = num(r.avg_interest_rate_amt);
    if (v !== null) rows.push(monthRow(S, "avg_interest_rate", r.record_date.slice(0, 7), v, "percent"));
  }

  const inserted = await upsertRows(pg, "area_stats", COLUMNS, rows, KEY);
  console.log(`  ${S}: ${monthEnd.size} months of debt, ${months.size} MTS months, ${rates.length} interest-rate months`);
  return inserted;
}

// ---- PaymentAccuracy.gov -----------------------------------------------------------

async function importAccuracy(pg) {
  const S = "payment-accuracy";
  await registerDataset(pg, S);
  const html = await (await fetchRetry("https://www.paymentaccuracy.gov/", {}, { label: "paymentaccuracy.gov" })).text();
  // The home page's three government-wide charts, in order: accuracy,
  // improper, unknown — each labeled in the text just before it.
  const charts = [...html.matchAll(/data-series="\[([^\]]+)\]"[\s\S]*?data-years="\[([^\]]+)\]"/g)];
  const metrics = ["payment_accuracy_rate", "improper_payment_rate", "unknown_payment_rate"];
  const labels = ["Payment accuracy rate", "Improper payments rate", "Unknown payments rate"];
  const order = labels.map((l) => html.indexOf(l));
  if (charts.length < 3 || order.some((i) => i < 0) || !(order[0] < order[1] && order[1] < order[2])) {
    throw new Error("PaymentAccuracy.gov: government-wide charts not found — page layout changed?");
  }
  const rows = [];
  charts.slice(0, 3).forEach((m, i) => {
    const values = m[1].split(",").map(Number);
    const years = m[2].split(",").map((y) => Number(y.trim()));
    years.forEach((y, j) => Number.isFinite(values[j]) && rows.push(fyRow(S, metrics[i], y, Math.round(values[j] * 100) / 100, "percent")));
  });
  const inserted = await upsertRows(pg, "area_stats", COLUMNS, rows, KEY);
  console.log(`  ${S}: ${rows.length} rows`);
  return inserted;
}

await runImport("federal-budget", async (pg) => {
  let inserted = 0;
  if (ONLY.has("omb")) inserted += await importOmb(pg);
  if (ONLY.has("treasury")) inserted += await importTreasury(pg);
  if (ONLY.has("accuracy")) inserted += await importAccuracy(pg);
  return { inserted };
});

