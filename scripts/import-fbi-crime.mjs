// Imports FBI Crime Data Explorer monthly summarized offenses (UCR/NIBRS)
// for the nation and every state into `area_stats`: per offense, the
// reported count and the rate per 100,000, plus clearances. source =
// 'fbi-cde', period = 'YYYY-MM', geo_level 'nation' | 'state' (FIPS geoid).
// metadata.coverage = percent of the population covered by agencies that
// reported that month. Months after the API's max_data_date (which it
// returns as 0 or null) are dropped.
//
// Needs an api.data.gov key — FBI_API_KEY, or the FEC_API_KEY already in
// .env (api.data.gov keys work across agencies). DEMO_KEY is 30 req/hour,
// too slow for the ~530 calls a full run makes.
//
// Usage:
//   node scripts/import-fbi-crime.mjs [--from=2015] [--states=TX,FL] [--offenses=V,P]
//   ENV_FILE=.env.cloud node scripts/import-fbi-crime.mjs

import { STATE_FIPS, arg, fetchJson, num, runImport, sleep, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const OFFENSES = {
  V: "violent_crime", P: "property_crime", HOM: "homicide", RPE: "rape", ROB: "robbery",
  ASS: "aggravated_assault", BUR: "burglary", LAR: "larceny", MVT: "motor_vehicle_theft", ARS: "arson",
};
const FROM = Number(arg("from", "2015"));
const ONLY_STATES = arg("states", "").toUpperCase().split(",").filter(Boolean);
const ONLY_OFFENSES = arg("offenses", "").toUpperCase().split(",").filter(Boolean);
const now = new Date();
const TO = `${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;

const STATES = Object.keys(STATE_FIPS).filter(
  (s) => !["AS", "GU", "MP", "VI"].includes(s) && (!ONLY_STATES.length || ONLY_STATES.includes(s)),
);

// "09/2026" -> "2026-09"
const maxPeriod = (d) => {
  const [mm, yyyy] = String(d.cde_properties?.max_data_date?.UCR ?? "").split("/");
  return yyyy ? `${yyyy}-${mm}` : "9999-12";
};

function seriesRows(series, metric, unit, geoLevel, geoid, geoName, { through, coverage }) {
  return Object.entries(series ?? {}).flatMap(([mmYYYY, value]) => {
    const [mm, yyyy] = mmYYYY.split("-");
    const period = `${yyyy}-${mm}`;
    if (period > through || num(value) === null) return [];
    const cov = coverage?.[mmYYYY];
    return [{
      source: "fbi-cde", metric, geo_level: geoLevel, geoid, geo_name: geoName,
      period, period_start: `${period}-01`, value: num(value), unit,
      metadata: cov === undefined ? null : { coverage: cov },
    }];
  });
}

await runImport("fbi-cde", async (pg) => {
  await registerDataset(pg, "fbi-cde");
  const key = process.env.FBI_API_KEY || process.env.FEC_API_KEY || "DEMO_KEY";
  const delay = key === "DEMO_KEY" ? 120_000 : 300;
  const offenses = Object.keys(OFFENSES).filter((o) => !ONLY_OFFENSES.length || ONLY_OFFENSES.includes(o));
  let total = 0;
  const targets = [["national", null], ...STATES.map((s) => ["state", s])];
  for (const [kind, st] of targets) {
    for (const off of offenses) {
      const path = kind === "national" ? `national/${off}` : `state/${st}/${off}`;
      const d = await fetchJson(
        `https://api.usa.gov/crime/fbi/cde/summarized/${path}?from=01-${FROM}&to=${TO}&API_KEY=${key}`,
        {},
        { label: `fbi ${path}` },
      );
      const rates = d.offenses?.rates ?? {};
      const actuals = d.offenses?.actuals ?? {};
      const label = Object.keys(actuals).find((k) => k.endsWith(" Offenses"))?.replace(/ Offenses$/, "") ?? "";
      const geoLevel = kind === "national" ? "nation" : "state";
      const geoid = kind === "national" ? "US" : STATE_FIPS[st];
      const metric = OFFENSES[off];
      const opts = { through: maxPeriod(d), coverage: d.tooltips?.["Percent of Population Coverage"]?.[label] };
      const rows = [
        ...seriesRows(actuals[`${label} Offenses`], `${metric}_count`, "offenses", geoLevel, geoid, label, opts),
        ...seriesRows(rates[`${label} Offenses`], `${metric}_rate`, "per_100k", geoLevel, geoid, label, opts),
        ...seriesRows(actuals[`${label} Clearances`], `${metric}_clearances`, "clearances", geoLevel, geoid, label, opts),
      ];
      if (rows.length) {
        total += await upsertRows(pg, "area_stats", Object.keys(rows[0]), rows, [
          "source", "metric", "geo_level", "geoid", "period",
        ]);
      }
      await sleep(delay);
    }
    console.log(`  ${st ?? "US"} done`);
  }
  return { inserted: total };
});
