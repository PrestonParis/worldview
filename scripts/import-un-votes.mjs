// Imports recorded UN votes on Israel, the Palestinians and the wider
// Middle East — General Assembly and Security Council — from the UN Digital
// Library's Voting Data collection into `area_stats` (source 'un-votes',
// metric 'vote', geo_level 'country', geoid 'USA' | 'ISR', period = the
// resolution symbol, period_start = the vote date). value is 1 yes, -1 no,
// 0 abstain; a member that didn't vote has no row. metadata carries the
// title, body, draft symbol, subjects and the whole chamber's tally.
//
// Security Council drafts that fail (vetoes included) are not in the Voting
// Data collection, only adopted resolutions.
//
// Source: https://digitallibrary.un.org/ (Voting Data) — free, no key.
//
// Usage:
//   node scripts/import-un-votes.mjs
//   ENV_FILE=.env.cloud node scripts/import-un-votes.mjs

import { fetchRetry, runImport, sleep, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { decodeEntities } from "./lib/html.mjs";

const SOURCE = "un-votes";
// Title words only: every voting record lists Israel among the members
// voting, so an any-field search matches the whole collection.
const QUERY = ["Palestin*", "Israel*", '"Middle East"', "Jerusalem", "Golan", "UNRWA", "Gaza"]
  .map((t) => `title:${t}`)
  .join(" OR ");
const PAGE = 200;
const FIRST_YEAR = 1946;
const COUNTRIES = { USA: "United States", ISR: "Israel" };
const VOTE = { Y: 1, N: -1, A: 0 };

// Each MARC datafield as { tag, subfields: { code: [values] } }.
function records(xml) {
  return [...xml.matchAll(/<record>([\s\S]*?)<\/record>/g)].map(([, rec]) =>
    [...rec.matchAll(/<datafield tag="(\d+)"[^>]*>([\s\S]*?)<\/datafield>/g)].map(([, tag, body]) => {
      const subfields = {};
      for (const [, code, text] of body.matchAll(/<subfield code="(\w)">([\s\S]*?)<\/subfield>/g))
        (subfields[code] ??= []).push(decodeEntities(text).trim());
      return { tag, subfields };
    }),
  );
}

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const out = [];
  let seen = 0;
  // One search per year keeps each under the engine's paging cap (past it,
  // every page repeats the last one).
  for (let year = FIRST_YEAR; year <= new Date().getFullYear(); year++) {
    const ids = new Set();
    for (let jrec = 1; ; jrec += PAGE) {
      const url = `https://digitallibrary.un.org/search?ln=en&cc=Voting+Data&of=xm&rg=${PAGE}&jrec=${jrec}&p=${encodeURIComponent(`(${QUERY}) AND 992__a:${year}*`)}`;
      const xml = await (await fetchRetry(url, {}, { label: `UN votes ${year} from ${jrec}` })).text();
      const recs = records(xml);
      const first = /<controlfield tag="001">(\d+)/.exec(xml)?.[1];
      if (!recs.length || ids.has(first)) break;
      ids.add(first);
      seen += recs.length;
      for (const fields of recs) {
        const one = (tag, code) => fields.find((f) => f.tag === tag)?.subfields[code]?.[0] ?? null;
        const symbol = one("791", "a");
        const date = one("992", "a");
        if (!symbol || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) continue;
        const tally = (code) => Number(one("996", code) ?? NaN);
        const metadata = {
          title: one("245", "a"),
          body: one("981", "a"),
          draft: one("993", "a"),
          subjects: [...new Set(fields.filter((f) => f.tag === "991").flatMap((f) => f.subfields.d ?? []))],
          yes: tally("b"),
          no: tally("c"),
          abstain: tally("d"),
          nonVoting: tally("e"),
        };
        for (const f of fields) {
          if (f.tag !== "967") continue;
          const iso = f.subfields.c?.[0];
          const vote = VOTE[f.subfields.d?.[0] ?? ""];
          if (!COUNTRIES[iso] || vote === undefined) continue;
          out.push({
            source: SOURCE,
            metric: "vote",
            geo_level: "country",
            geoid: iso,
            geo_name: COUNTRIES[iso],
            period: symbol,
            period_start: date,
            value: vote,
            unit: "vote",
            metadata,
          });
        }
      }
      await sleep(300);
      if (recs.length < PAGE) break;
    }
    process.stdout.write(`\r  ${year}: ${seen} records`);
  }
  console.log();
  if (seen < 500) throw new Error(`only ${seen} voting records found`);
  const inserted = await upsertRows(
    pg,
    "area_stats",
    Object.keys(out[0]),
    out,
    ["source", "metric", "geo_level", "geoid", "period"],
    { batchSize: 1000 },
  );
  return {
    inserted,
    cursor: out
      .map((o) => o.period_start)
      .sort()
      .at(-1),
  };
});
