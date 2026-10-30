// Imports Gallup's confidence-in-institutions trend into `area_stats`
// (source gallup-confidence, nation, yearly since 1973): the percent of U.S.
// adults with "a great deal" or "quite a lot" of confidence in each of 17
// institutions, and the percent with "very little".
//
// Source: https://news.gallup.com/poll/1597/confidence-institutions.aspx
// (read with scripts/lib/gallup.mjs; a year with several polls keeps the
// latest).
//
// Usage:
//   node scripts/import-gallup-confidence.mjs
//   ENV_FILE=.env.cloud node scripts/import-gallup-confidence.mjs

import { fetchRetry, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { parseGallupTables } from "./lib/gallup.mjs";

const SOURCE = "gallup-confidence";
const URL = "https://news.gallup.com/poll/1597/confidence-institutions.aspx";
// Gallup serves table-less pages to short User-Agents.
const BROWSER = {
  headers: {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  },
};

// table title → metric suffix
const INSTITUTIONS = {
  "The Church or Organized Religion": "religion",
  "The Military": "military",
  "Supreme Court": "supreme_court",
  Banks: "banks",
  "Public Schools": "public_schools",
  Newspapers: "newspapers",
  Congress: "congress",
  "Television news": "television_news",
  "Organized Labor": "organized_labor",
  "The Presidency": "presidency",
  "The Police": "police",
  "Medical System": "medical_system",
  "Criminal Justice System": "criminal_justice",
  "Big Business": "big_business",
  "Small Business": "small_business",
  "Large Technology Companies": "big_tech",
  "Higher Education": "higher_education",
};

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const html = await (await fetchRetry(URL, BROWSER)).text();
  const tables = Object.fromEntries(
    Object.entries(INSTITUTIONS).map(([title, id]) => [title, {
      // Some tables' combined header carries an escaped "<br>" as literal text.
      "Great deal/Quite a lot": `confidence_${id}`,
      "Great deal/<br>Quite a lot": `confidence_${id}`,
      "Very little": `very_little_confidence_${id}`,
    }]),
  );
  // Each table uses one of the two header spellings; check coverage ourselves.
  const rows = [];
  for (const [title, spec] of Object.entries(tables)) {
    for (const variant of [["Great deal/Quite a lot", "Very little"], ["Great deal/<br>Quite a lot", "Very little"]]) {
      try {
        rows.push(...parseGallupTables(html, { [title]: Object.fromEntries(variant.map((h) => [h, spec[h]])) }, SOURCE));
        break;
      } catch (err) {
        if (!/missing|no header/.test(err.message)) throw err;
      }
    }
  }
  const metrics = new Set(rows.map((r) => r.metric));
  const missing = Object.values(INSTITUTIONS).filter((id) => !metrics.has(`confidence_${id}`));
  if (missing.length) throw new Error(`Gallup confidence tables missing: ${missing.join(", ")} — page layout changed?`);
  const latest = rows.map((r) => r.period).sort().at(-1);
  console.log(`  ${rows.length} rows, 1973–${latest}`);
  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, rows, ["source", "metric", "geo_level", "geoid", "period"]);
  return { inserted, cursor: latest };
});
