// Imports Gallup's annual LGBTQ+ identification release into `area_stats`
// (source gallup-lgbt):
//
//   lgbtq_total                     nation, 2012–
//   lesbian, gay, bisexual, transgender, other_lgbtq   nation, 2020–
//   lgbtq_total, lesbian, gay, bisexual, transgender   latest year by
//       subgroup: geo_level 'group', geoid = age_18_29, gender_male,
//       party_identification_republican, …
//
// All values are percent of U.S. adults (of the subgroup for group rows).
// Gallup suppresses small subgroup cells ("*"); those are skipped.
//
// Source: https://news.gallup.com/poll/702206/lgbtq-identification-holds.aspx
// (pass --url= for a newer year's release).
//
// Usage:
//   node scripts/import-gallup-lgbt.mjs [--url=...]
//   ENV_FILE=.env.cloud node scripts/import-gallup-lgbt.mjs

import { arg, fetchRetry, runImport, sleep, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { decodeEntities } from "./lib/html.mjs";

const SOURCE = "gallup-lgbt";
const URL = arg("url", "https://news.gallup.com/poll/702206/lgbtq-identification-holds.aspx");
// Gallup serves table-less pages to short User-Agents.
const BROWSER = {
  headers: {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  },
};
const IDENTITIES = { "% Lesbian": "lesbian", "% Gay": "gay", "% Bisexual": "bisexual", "% Transgender": "transgender", "% Other LGBTQ+": "other_lgbtq" };
const SUBGROUP_METRICS = ["lgbtq_total", "lesbian", "gay", "bisexual", "transgender"];
const slug = (s) => s.toLowerCase().replace(/ years old$/, "").replace(/\//g, "_").replace(/\+/g, "_plus").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const cellText = (s) => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const tableRows = (t) => [...t.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) => [...m[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => cellText(c[1])));

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  let html = "";
  for (let attempt = 1; attempt <= 8 && !html.includes("<table"); attempt++) {
    if (attempt > 1) await sleep(3000);
    html = await (await fetchRetry(URL, BROWSER)).text();
  }
  const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/g)].map((m) => m[0]);
  const out = [];
  const row = (geoLevel, geoid, name, metric, year, value) =>
    out.push({
      source: SOURCE, metric, geo_level: geoLevel, geoid, geo_name: name, period: String(year),
      period_start: `${year}-01-01`, value, unit: "percent", metadata: { url: URL },
    });
  const nation = (metric, year, value) => row("nation", "US", "United States", metric, year, value);
  let latest = null;

  for (const t of tables) {
    const rows = tableRows(t);
    const title = cellText(t.match(/<caption[\s\S]*?<\/caption>/)?.[0] ?? rows[0]?.join(" ") ?? "");
    if (/Self-Identification as Lesbian, Gay, Bisexual, Transgender or Something Other/.test(title)) {
      // Year | % Identify as LGBTQ+
      for (const r of rows) if (/^\d{4}$/.test(r[0]) && Number.isFinite(Number(r[1]))) nation("lgbtq_total", r[0], Number(r[1]));
    } else if (/Percentage of U\.S\. Adults who Identify as Lesbian, Gay, Bisexual or Transgender/.test(title)) {
      const years = rows.find((r) => r.filter((c) => /^\d{4}$/.test(c)).length > 2)?.filter((c) => /^\d{4}$/.test(c)) ?? [];
      for (const r of rows) {
        const metric = IDENTITIES[r[0]];
        if (!metric) continue;
        r.slice(1).forEach((v, i) => years[i] && Number.isFinite(Number(v)) && nation(metric, years[i], Number(v)));
      }
      latest = years.at(-1) ?? latest;
    } else if (/LGBTQ\+ Identity Among U\.S\. Adults, by Subgroup, (\d{4})/.test(title)) {
      const year = title.match(/by Subgroup, (\d{4})/)[1];
      let section = "";
      for (const r of rows) {
        const values = r.slice(1);
        // Section headings ("Age", "Gender", …) are rows with empty cells.
        if (r[0] && values.every((v) => v === "")) section = r[0];
        if (!r[0] || !values.some((v) => /^\d/.test(v))) continue;
        const id = slug(section ? `${section} ${r[0]}` : r[0]);
        const name = section ? `${section}: ${r[0]}` : r[0];
        SUBGROUP_METRICS.forEach((metric, i) => {
          const v = Number(values[i]);
          if (values[i] !== "*" && Number.isFinite(v)) row("group", id, name, metric, year, v);
        });
      }
    }
  }
  const metrics = new Set(out.map((r) => `${r.geo_level}:${r.metric}`));
  for (const want of ["nation:lgbtq_total", "nation:bisexual", "group:lgbtq_total"]) {
    if (!metrics.has(want)) throw new Error(`Gallup page has no ${want} values — layout changed?`);
  }
  console.log(`  ${out.length} rows (identities through ${latest})`);
  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, out, ["source", "metric", "geo_level", "geoid", "period"]);
  return { inserted, cursor: latest };
});
