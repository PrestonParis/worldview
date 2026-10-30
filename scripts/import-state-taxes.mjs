// Imports state tax rates and who bears state and local taxes into
// `area_stats`:
//
//   tax-foundation-state-income-tax  each state's individual income tax,
//       2015 onward: top marginal rate, number of brackets, income where the
//       top rate starts, standard deduction and personal exemption (single
//       filer). States without a wage income tax have a top rate of 0
//       (metadata.note keeps Tax Foundation's text, e.g. Washington's tax on
//       capital gains only).
//   itep-who-pays  ITEP's Who Pays? (7th edition, 2024 law at 2023 incomes):
//       state and local taxes as a share of family income for seven income
//       groups (lowest 20% … top 1%), in total and by kind of tax, the ITEP
//       tax inequality index, and each kind of tax's share of collections.
//       "Average across all states" is stored as the nation.
//
// Sources: https://taxfoundation.org/data/all/state/state-income-tax-rates/
// (2015–2025 workbook; --rates-url= for a newer one) and
// https://itep.org/whopays-7th-edition/ (data workbook).
//
// Usage:
//   node scripts/import-state-taxes.mjs [--only=rates,whopays] [--rates-url=...]
//   ENV_FILE=.env.cloud node scripts/import-state-taxes.mjs

import { arg, fetchRetry, runImport, STATE_FIPS, STATE_NAME_TO_ABBR, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { readXlsx } from "./lib/xlsx.mjs";

const ONLY = new Set(arg("only", "rates,whopays").split(","));
const RATES_URL = arg("rates-url", "https://taxfoundation.org/wp-content/uploads/2025/02/State-Individual-Income-Tax-Rates-and-Brackets-2015-2025_fv.xlsx");
const ITEP_URL = "https://sfo2.digitaloceanspaces.com/itep/ITEP_WhoPays7_Data_Jan2024rev.xlsx";
const ITEP_YEAR = "2024";
const COLUMNS = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
const CONFLICT = ["source", "metric", "geo_level", "geoid", "period"];
const FIPS_TO_NAME = Object.fromEntries(Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [STATE_FIPS[abbr], name]));

// Tax Foundation uses AP-style state abbreviations.
const AP = {
  "Ala.": "AL", Alaska: "AK", "Ariz.": "AZ", "Ark.": "AR", "Calif.": "CA", "Colo.": "CO", "Conn.": "CT", "Del.": "DE", "Fla.": "FL",
  "Ga.": "GA", Hawaii: "HI", Idaho: "ID", "Ill.": "IL", "Ind.": "IN", Iowa: "IA", "Kans.": "KS", "Kan.": "KS", "Ky.": "KY", "La.": "LA",
  Maine: "ME", "Md.": "MD", "Mass.": "MA", "Mich.": "MI", "Minn.": "MN", "Miss.": "MS", "Mo.": "MO", "Mont.": "MT", "Nebr.": "NE",
  "Neb.": "NE", "Nev.": "NV", "N.H.": "NH", "N.J.": "NJ", "N.M.": "NM", "N.Y.": "NY", "N.C.": "NC", "N.D.": "ND", Ohio: "OH",
  "Okla.": "OK", "Ore.": "OR", "Pa.": "PA", "R.I.": "RI", "S.C.": "SC", "S.D.": "SD", "Tenn.": "TN", "Tex.": "TX", Utah: "UT",
  "Vt.": "VT", "Va.": "VA", "Wash.": "WA", "W.Va.": "WV", "W. Va.": "WV", "Wis.": "WI", "Wyo.": "WY", "D.C.": "DC", "DC": "DC",
};
const stateRow = (fips, metric, year, value, unit, source, metadata = {}) => ({
  source, metric, geo_level: fips === "US" ? "nation" : "state", geoid: fips, geo_name: fips === "US" ? "United States" : FIPS_TO_NAME[fips],
  period: String(year), period_start: `${year}-01-01`, value, unit, metadata,
});
const asRate = (v) => (typeof v === "number" ? Math.round((v < 1 ? v * 100 : v) * 1e4) / 1e4 : null);

async function importRates(pg) {
  const source = "tax-foundation-state-income-tax";
  await registerDataset(pg, source);
  const book = readXlsx(Buffer.from(await (await fetchRetry(RATES_URL, { timeoutMs: 300_000 })).arrayBuffer()));
  const out = [];
  for (const [year, rows] of Object.entries(book)) {
    if (!/^\d{4}$/.test(year)) continue;
    const hi = rows.findIndex((r) => String(r[0] ?? "").trim() === "State");
    const header = rows[hi].map((c) => String(c ?? "").trim());
    const iRate = header.indexOf("Rates");
    const iBracket = header.indexOf("Brackets");
    const iStd = header.indexOf("Single");
    const iExempt = header.indexOf("Single", iStd + 1);
    // Group rows by state: a state's name starts its block; the bracket rows
    // after it carry a rate (their first cell is empty or a footnote
    // fragment like "(a, e," / "r, s)").
    const blocks = [];
    for (const r of rows.slice(hi + 1)) {
      const name = String(r[0] ?? "").replace(/\s*\(.*$/, "").trim();
      if (AP[name]) blocks.push({ abbr: AP[name], rows: [r] });
      else if (blocks.length && asRate(r[iRate]) !== null) blocks.at(-1).rows.push(r);
    }
    for (const { abbr, rows: br } of blocks) {
      const fips = STATE_FIPS[abbr];
      const rates = br.map((r) => [asRate(r[iRate]), typeof r[iBracket] === "number" ? r[iBracket] : null]).filter(([rate]) => rate !== null);
      const text = typeof br[0][iRate] === "string" ? br[0][iRate].trim() : null;
      const meta = text && text.toLowerCase() !== "none" ? { note: text } : {};
      if (!rates.length) {
        out.push(stateRow(fips, "income_tax_top_rate", year, 0, "percent", source, meta));
        out.push(stateRow(fips, "income_tax_brackets", year, 0, "count", source, meta));
        continue;
      }
      const [topRate, topStart] = rates.reduce((a, b) => (b[0] >= a[0] ? b : a));
      out.push(stateRow(fips, "income_tax_top_rate", year, topRate, "percent", source));
      out.push(stateRow(fips, "income_tax_brackets", year, rates.length, "count", source));
      if (topStart !== null) out.push(stateRow(fips, "income_tax_top_bracket_start", year, topStart, "usd", source));
      if (typeof br[0][iStd] === "number") out.push(stateRow(fips, "standard_deduction_single", year, br[0][iStd], "usd", source));
      if (typeof br[0][iExempt] === "number") out.push(stateRow(fips, "personal_exemption_single", year, br[0][iExempt], "usd", source));
    }
  }
  const latest = out.map((r) => r.period).sort().at(-1);
  const states = new Set(out.filter((r) => r.period === latest).map((r) => r.geoid));
  if (states.size < 51) throw new Error(`Tax Foundation ${latest}: only ${states.size} states parsed — layout changed?`);
  console.log(`  tax-foundation-state-income-tax: ${out.length} rows, 2015–${latest}`);
  return upsertRows(pg, "area_stats", COLUMNS, out, CONFLICT);
}

const GROUPS = { "Lowest 20%": "lowest_20", "Second 20%": "second_20", "Middle 20%": "middle_20", "Fourth 20%": "fourth_20", "Next 15%": "next_15", "Next 4%": "next_4", "Top 1%": "top_1" };
const ITEP_SHEETS = { APP_A: "total", SE_TOTAL: "sales_excise", PROP_TOTAL: "property", INC_TOTAL: "income", INC_PIT: "personal_income", INC_CIT: "corporate_income", OTH_TOTAL: "other" };

async function importWhoPays(pg) {
  const source = "itep-who-pays";
  await registerDataset(pg, source);
  const book = readXlsx(Buffer.from(await (await fetchRetry(ITEP_URL, { timeoutMs: 300_000 })).arrayBuffer()));
  const out = [];
  const fipsOf = (name) => (/^(Average Across All States|All States Total)$/.test(name) ? "US" : STATE_FIPS[STATE_NAME_TO_ABBR[name]]);
  for (const [sheet, tax] of Object.entries(ITEP_SHEETS)) {
    const rows = book[sheet];
    const hi = rows.findIndex((r) => r[0] === "State");
    const header = rows[hi];
    for (const r of rows.slice(hi + 1)) {
      const fips = fipsOf(String(r[0] ?? "").trim());
      if (!fips) continue;
      header.forEach((h, i) => {
        if (GROUPS[h] && typeof r[i] === "number") out.push(stateRow(fips, `${tax}_tax_rate_${GROUPS[h]}`, ITEP_YEAR, Math.round(r[i] * 1e5) / 1e3, "percent", source));
      });
    }
  }
  // Appendix B: Rank | State | Index Value | …
  for (const r of book.APP_B) {
    const fips = fipsOf(String(r[1] ?? "").trim());
    if (fips && typeof r[2] === "number") out.push(stateRow(fips, "tax_inequality_index", ITEP_YEAR, Math.round(r[2] * 1e5) / 1e3, "percent", source, { rank: r[0] }));
  }
  // Appendix C: State | | Property | Sales & Excise | Income | Other (share of tax revenue, CY2023)
  for (const r of book.APP_C) {
    const fips = fipsOf(String(r[0] ?? "").trim());
    if (!fips) continue;
    ["property", "sales_excise", "income", "other"].forEach((tax, k) => {
      if (typeof r[2 + k] === "number") out.push(stateRow(fips, `${tax}_tax_share_of_revenue`, "2023", Math.round(r[2 + k] * 1e5) / 1e3, "percent", source));
    });
  }
  if (out.filter((r) => r.metric === "total_tax_rate_top_1").length < 51) throw new Error("ITEP: fewer than 51 states with a top-1% rate — layout changed?");
  console.log(`  itep-who-pays: ${out.length} rows`);
  return upsertRows(pg, "area_stats", COLUMNS, out, CONFLICT);
}

await runImport("state-taxes", async (pg) => {
  let inserted = 0;
  if (ONLY.has("rates")) inserted += await importRates(pg);
  if (ONLY.has("whopays")) inserted += await importWhoPays(pg);
  return { inserted };
});
