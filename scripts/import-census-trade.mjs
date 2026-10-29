// Imports U.S. trade in goods with selected partner countries from the
// Census Bureau's country pages (foreign-trade/balance/c<code>.html) into
// `area_stats` (source 'census-trade', geo_level 'country', geoid = ISO
// alpha-3), monthly ('2025-03') and calendar-year ('2025') rows:
//   exports   U.S. goods exports to the country
//   imports   U.S. goods imports from the country
//   balance   exports minus imports (negative is a U.S. deficit)
//
// Census publishes these pages for every partner; PARTNERS lists the ones
// Worldview's foreign-relations pages compare. The current year is partial
// (metadata.months says how many months it covers).
//
// Source: https://www.census.gov/foreign-trade/balance/ — free, no key.
//
// Usage:
//   node scripts/import-census-trade.mjs [--only=ISR]
//   ENV_FILE=.env.cloud node scripts/import-census-trade.mjs

import { arg, fetchRetry, runImport, sleep, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { htmlTables } from "./lib/html.mjs";

const SOURCE = "census-trade";
// ISO alpha-3 → [Census country code, name].
const PARTNERS = {
  ISR: ["5081", "Israel"],
  EGY: ["7290", "Egypt"],
  JOR: ["5110", "Jordan"],
  SAU: ["5170", "Saudi Arabia"],
  UKR: ["4623", "Ukraine"],
  TWN: ["5830", "Taiwan"],
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const millions = (s) => Math.round(Number(String(s).replace(/,/g, "")) * 1e6);

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const only = arg("only", "");
  const out = [];
  for (const [iso, [code, name]] of Object.entries(PARTNERS)) {
    if (only && only !== iso) continue;
    const html = await (await fetchRetry(`https://www.census.gov/foreign-trade/balance/c${code}.html`, {}, { label: name })).text();
    const row = (metric, period, periodStart, value, metadata = null) =>
      out.push({ source: SOURCE, metric, geo_level: "country", geoid: iso, geo_name: name, period, period_start: periodStart, value, unit: "usd", metadata });
    let years = 0;
    for (const t of htmlTables(html)) {
      if (t[0]?.join("|") !== "Month|Exports|Imports|Balance") continue;
      let months = 0;
      for (const [label, exp, imp, bal] of t.slice(1)) {
        const m = /^(\w+) (\d{4})$/.exec(label);
        const total = /^TOTAL (\d{4})$/.exec(label);
        if (m && MONTHS.includes(m[1])) {
          const period = `${m[2]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, "0")}`;
          row("exports", period, `${period}-01`, millions(exp));
          row("imports", period, `${period}-01`, millions(imp));
          row("balance", period, `${period}-01`, millions(bal));
          months++;
        } else if (total) {
          const meta = { months };
          row("exports", total[1], `${total[1]}-01-01`, millions(exp), meta);
          row("imports", total[1], `${total[1]}-01-01`, millions(imp), meta);
          row("balance", total[1], `${total[1]}-01-01`, millions(bal), meta);
          years++;
        }
      }
    }
    if (years < 20) throw new Error(`${name}: only ${years} years parsed`);
    console.log(`  ${name}: ${years} years`);
    await sleep(500);
  }
  const inserted = await upsertRows(pg, "area_stats", Object.keys(out[0]), out, ["source", "metric", "geo_level", "geoid", "period"], { batchSize: 1000 });
  return { inserted };
});
