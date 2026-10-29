// Imports the Texas Department of Public Safety's criminal illegal
// noncitizen figures into `area_stats` (source texas-dps-noncitizen),
// geo_level 'state', geoid '48'. DPS republishes cumulative totals from
// June 1, 2011 to a recent date each month; each run stores that snapshot
// (period = the as-of date, YYYY-MM-DD).
//
//   booked_noncitizens, booked_illegal      people booked into Texas jails
//                                           and identified by DHS
//   <pop>_<scope>_charges[_<offense>]       criminal charges
//   <pop>_<scope>_convictions[_<offense>]   convictions on those charges
//     pop   = jail (identified at booking through Secure Communities) |
//             prison (identified only once in state prison)
//     scope = window (arrests since June 2011) | career (entire Texas
//             criminal history)
//     offense = homicide, assault, burglary, drug, kidnapping, theft,
//               obstructing_police, robbery, sexual_assault, sexual_offense,
//               weapon
//
// The figures are parsed from the page text; a changed sentence fails the
// run instead of loading nothing.
//
// Source: https://www.dps.texas.gov/section/crime-records/texas-criminal-illegal-noncitizen-data
//
// Usage:
//   node scripts/import-texas-dps.mjs
//   ENV_FILE=.env.cloud node scripts/import-texas-dps.mjs

import { fetchRetry, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { htmlLines } from "./lib/html.mjs";

const SOURCE = "texas-dps-noncitizen";
const URL = "https://www.dps.texas.gov/section/crime-records/texas-criminal-illegal-noncitizen-data";
const BROWSER = { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15" } };
const n = (s) => Number(s.replace(/,/g, ""));
const slug = (s) => s.toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "");

// "1,134 homicide charges; 79,089 assault charges; …" -> { homicide: 1134, … }
function byOffense(text, kind) {
  const out = {};
  for (const [, count, offense] of text.matchAll(new RegExp(`([\\d,]+) ([a-z ]+?) ${kind}`, "g"))) out[slug(offense)] = n(count);
  return out;
}

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const html = await (await fetchRetry(URL, BROWSER)).text();
  // One paragraph per line; the page splits a few sentences across tags.
  const text = htmlLines(html).join(" ").replace(/\s+/g, " ");

  const booked = text.match(/over ([\d,]+) criminal noncitizens have been booked into local Texas jails between June 1, 2011,? and ([A-Z][a-z]+ \d{1,2}, \d{4}), of which over ([\d,]+) were classified as illegal/);
  if (!booked) throw new Error("DPS: booking sentence not found — page changed?");
  const asOf = new Date(`${booked[2]} UTC`).toISOString().slice(0, 10);

  const values = { booked_noncitizens: n(booked[1]), booked_illegal: n(booked[3]) };
  // Four blocks, in page order: jail/window, prison/window, jail/career, prison/career.
  const blocks = [
    ["jail_window", /these [\d,]+ illegal noncitizens were charged with more than ([\d,]+) criminal offenses which included (.+?)\. DPS criminal history records reflect those criminal charges have thus far resulted in over ([\d,]+) convictions including (.+?)\./],
    ["prison_window", /individual identified as illegal noncitizens while in prison, but who were not previously identified through Secure Communities, were charged with more than ([\d,]+) criminal offenses which included (.+?)\. DPS criminal history records reflect those criminal charges have thus far resulted in over ([\d,]+) convictions including (.+?)\./],
    ["jail_career", /Over the course of their entire Texas criminal careers, these [\d,]+ illegal noncitizens were charged with more than ([\d,]+) criminal offenses which included (.+?)\.\s*DPS criminal history records reflect those criminal charges have thus far resulted in over ([\d,]+) convictions including (.+?)\./],
    ["prison_career", /Over the course of their entire Texas criminal careers, these [\d,]+ individuals identified as illegal noncitizens while in prison, were charged with more than ([\d,]+) criminal offenses which included (.+?)\.\s*DPS criminal history records reflect those criminal charges have thus far resulted in over ([\d,]+) convictions including (.+?)\./],
  ];
  for (const [prefix, re] of blocks) {
    const m = text.match(re);
    if (!m) throw new Error(`DPS: ${prefix} paragraph not found — page changed?`);
    values[`${prefix}_charges`] = n(m[1]);
    values[`${prefix}_convictions`] = n(m[3]);
    for (const [o, v] of Object.entries(byOffense(m[2], "charges"))) values[`${prefix}_charges_${o}`] = v;
    for (const [o, v] of Object.entries(byOffense(m[4], "convictions"))) values[`${prefix}_convictions_${o}`] = v;
    if (!values[`${prefix}_charges_homicide`]) throw new Error(`DPS: ${prefix} has no homicide charges — sentence changed?`);
  }

  const out = Object.entries(values).map(([metric, value]) => ({
    source: SOURCE, metric, geo_level: "state", geoid: "48", geo_name: "Texas", period: asOf, period_start: asOf,
    value, unit: metric.startsWith("booked") ? "people" : metric.includes("convictions") ? "convictions" : "charges",
    metadata: { url: URL, cumulative_from: "2011-06-01" },
  }));
  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, out, ["source", "metric", "geo_level", "geoid", "period"]);
  console.log(`  as of ${asOf}: ${out.length} figures`);
  return { inserted, cursor: asOf };
});
