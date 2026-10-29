// Imports who commits and who suffers serious violent crime, from the FBI
// Crime Data Explorer, into `area_stats`:
//
//   fbi-shr          Supplementary Homicide Reports (murder and
//                    nonnegligent manslaughter), nation 1990– and states
//                    2010–, per year:
//     victims_<group>, offenders_<group>   race, ethnicity, sex, age band
//     victims_weapon_<w>, victims_relationship_<r>, victims_circumstance_<c>
//   fbi-nibrs-people NIBRS victims and offenders for rape, robbery and
//                    aggravated assault (and homicide, for comparison),
//                    nation 2016–:
//     <offense>_victims_<group>, <offense>_offenders_<group>
//
// Groups: white, black, aian, asian, nhpi, race_unknown; hispanic,
// not_hispanic, ethnicity_unknown; male, female, sex_unknown; age_0_9 …
// age_90_plus, age_unknown. Offender counts include offenders the victim
// or police could not describe ("unknown"); "not specified" is folded in.
//
// Usage:
//   node scripts/import-fbi-homicide.mjs [--only=shr,nibrs] [--from=1990] [--nation-only]
//   ENV_FILE=.env.cloud node scripts/import-fbi-homicide.mjs

import { STATE_FIPS, STATE_NAME_TO_ABBR, arg, fetchJson, flag, num, runImport, sleep, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const ONLY = new Set(arg("only", "shr,nibrs").split(","));
const FROM = Number(arg("from", "1990"));
const STATE_FROM = 2010;
const NIBRS_FROM = 2016;
const CDE = "https://api.usa.gov/crime/fbi/cde";
const STATES = flag("nation-only") ? [] : Object.keys(STATE_FIPS).filter((s) => !["AS", "GU", "MP", "VI", "PR"].includes(s));
const STATE_NAMES = Object.fromEntries(Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [abbr, name]));
const NIBRS_OFFENSES = { homicide: "09A", rape: "11A", robbery: "120", aggravated_assault: "13A" };

const RACES = {
  White: "white", "Black or African American": "black", "American Indian or Alaska Native": "aian", Asian: "asian",
  "Native Hawaiian or Other Pacific Islander": "nhpi", "Asian, Native Hawaiian, or Other Pacific Islander": "asian",
  Unknown: "race_unknown", "Not Specified": "race_unknown", Multiple: "race_unknown",
};
const ETHNICITY = { "Hispanic or Latino": "hispanic", "Not Hispanic or Latino": "not_hispanic", Unknown: "ethnicity_unknown", "Not Specified": "ethnicity_unknown", Multiple: "ethnicity_unknown" };
const SEX = { Male: "male", Female: "female", Unknown: "sex_unknown", "Not Specified": "sex_unknown" };
const age = (label) => (label === "Unknown" ? "age_unknown" : label === "90-Older" ? "age_90_plus" : `age_${label.replace("-", "_")}`);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// One person block (victim or offender) -> { group: count }.
function people(block) {
  const out = {};
  const add = (k, v) => (out[k] = (out[k] ?? 0) + (num(v) ?? 0));
  for (const [l, v] of Object.entries(block?.race ?? {})) if (RACES[l]) add(RACES[l], v);
  for (const [l, v] of Object.entries(block?.ethnicity ?? {})) if (ETHNICITY[l]) add(ETHNICITY[l], v);
  for (const [l, v] of Object.entries(block?.sex ?? {})) if (SEX[l]) add(SEX[l], v);
  for (const [l, v] of Object.entries(block?.age ?? {})) add(age(l), v);
  out.total = (out.male ?? 0) + (out.female ?? 0) + (out.sex_unknown ?? 0);
  return out;
}

const labels = {};
// Category breakdowns (weapon, relationship, …) -> { `${kind}_${slug}`: count }.
function categories(obj, kind) {
  const out = {};
  for (const [l, v] of Object.entries(obj ?? {})) {
    const key = `${kind}_${slug(l)}`;
    labels[key] = l;
    out[key] = (out[key] ?? 0) + (num(v) ?? 0);
  }
  return out;
}

async function sweep(pg, source, { paths, from, rowsFor, states, extra }) {
  const key = process.env.FBI_API_KEY || process.env.FEC_API_KEY || process.env.CONGRESS_GOV_API_KEY || "DEMO_KEY";
  const delay = key === "DEMO_KEY" ? 120_000 : 150;
  const thisYear = new Date().getFullYear();
  let maxYear = thisYear;
  let inserted = 0;
  for (const st of [null, ...states]) {
    const rows = [];
    for (let y = st ? Math.max(from, STATE_FROM) : from; y <= Math.min(thisYear, maxYear); y++) {
      const values = {};
      let partial = false;
      for (const [name, path] of Object.entries(paths(st))) {
        const d = await fetchJson(`${CDE}/${path}${path.includes("?") ? "&" : "?"}from=01-${y}&to=12-${y}&API_KEY=${key}`, {}, { label: `fbi ${path} ${y}` });
        await sleep(delay);
        const max = Number(String(d.cde_properties?.max_data_date?.UCR ?? "").split("/")[1]);
        if (max) {
          maxYear = max;
          partial = y === max;
        }
        Object.assign(values, rowsFor(name, d));
      }
      for (const [metric, value] of Object.entries(values)) {
        rows.push({
          source, metric, geo_level: st ? "state" : "nation", geoid: st ? STATE_FIPS[st] : "US",
          geo_name: st ? STATE_NAMES[st] : "United States", period: String(y), period_start: `${y}-01-01`,
          value, unit: metric.includes("offenders") ? "offenders" : "victims", metadata: partial ? { partial: true } : null,
        });
      }
    }
    // Labels for the category metrics seen so far, before their rows land.
    await registerDataset(pg, source, extra?.());
    const keep = rows.filter((r) => r.value !== null);
    if (keep.length) inserted += await upsertRows(pg, "area_stats", Object.keys(keep[0]), keep, ["source", "metric", "geo_level", "geoid", "period"]);
    console.log(`  ${source} ${st ?? "US"}: ${keep.length} rows`);
  }
  return inserted;
}

const prefixed = (prefix, obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [`${prefix}_${k}`, v]));
const m = (label, unit) => ({ label, unit });

await runImport("fbi-homicide", async (pg) => {
  let inserted = 0;
  if (ONLY.has("shr")) {
    inserted += await sweep(pg, "fbi-shr", {
      from: FROM,
      states: STATES,
      paths: (st) => ({ shr: `shr/${st ? `state/${st}` : "national"}?type=totals` }),
      rowsFor: (_, d) => ({
        ...prefixed("victims", people(d.victim)),
        ...prefixed("offenders", people(d.offender)),
        ...prefixed("victims", categories(d.offense?.weapons, "weapon")),
        ...prefixed("victims", categories(d.offense?.relationship, "relationship")),
        ...prefixed("victims", categories(d.offense?.circumstance, "circumstance")),
      }),
      extra: () =>
        Object.fromEntries(
          Object.entries(labels).map(([k, l]) => [`victims_${k}`, m(`Victims by ${k.split("_")[0]}: ${l}`, "victims")]),
        ),
    });
  }
  if (ONLY.has("nibrs")) {
    inserted += await sweep(pg, "fbi-nibrs-people", {
      from: NIBRS_FROM,
      states: [],
      paths: () => Object.fromEntries(Object.entries(NIBRS_OFFENSES).map(([o, code]) => [o, `nibrs/national/${code}`])),
      rowsFor: (o, d) => ({ ...prefixed(`${o}_victims`, people(d.victim)), ...prefixed(`${o}_offenders`, people(d.offender)) }),
    });
  }
  return { inserted };
});
