// Imports the foreign-born population from the Census ACS 1-year estimates
// into `area_stats` (source 'census-acs1-immigration', period = year) for
// the nation and every state, 2005 onward (no 2020 release):
//   foreign_born, foreign_born_share, naturalized, noncitizen,
//   naturalized_share_of_foreign_born                 nation + state
//   foreign_born_by_region   geo_level 'region',  geoid '<FIPS|US>:<region slug>'
//   foreign_born_by_country  geo_level 'country', geoid '<FIPS|US>:<country slug>'
// (area_stats has no category column, so a breakdown within a place scopes
// its geoid by the place.)
// Margins of error go in metadata.moe.
//
// ACS renumbers variables between years (B05006 grew from 123 to 178
// cells), so variables are resolved by label from each year's group
// metadata rather than hard-coded codes.
//
// Needs CENSUS_API_KEY (free, https://api.census.gov/data/key_signup.html —
// the key only works after clicking the activation link in the email).
//
// Usage:
//   node scripts/import-acs-immigration.mjs [--years=2005-2024]
//   ENV_FILE=.env.cloud node scripts/import-acs-immigration.mjs

import { arg, checkCensusKey, fetchJson, num, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const [FROM, TO] = arg("years", "2005-2024").split("-").map(Number);
const YEARS = Array.from({ length: (TO ?? FROM) - FROM + 1 }, (_, i) => FROM + i).filter((y) => y !== 2020);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// "Estimate!!Total:!!Foreign-born:!!Naturalized U.S. citizen" ->
// ["foreign born", "naturalized u.s. citizen"]
const path = (label) =>
  label
    .split("!!")
    .map((p) => p.replace(/:$/, "").replace(/-/g, " ").toLowerCase().trim())
    .filter((p) => p !== "estimate" && p !== "total");
const REGIONS = new Set(["europe", "asia", "africa", "oceania", "latin america", "northern america"]);
const title = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

async function groupVars(year, group) {
  const { variables } = await fetchJson(`https://api.census.gov/data/${year}/acs/acs1/groups/${group}.json`, {}, {
    label: `${group} ${year} metadata`,
  });
  return Object.entries(variables)
    .filter(([name]) => /_\d+E$/.test(name))
    .map(([name, v]) => ({ name, label: v.label, path: path(v.label) }));
}

async function fetchGroup(year, group, key) {
  const rows = [];
  for (const geo of [{ for: "us:1" }, { for: "state:*" }]) {
    const url = new URL(`https://api.census.gov/data/${year}/acs/acs1`);
    url.searchParams.set("get", `NAME,group(${group})`);
    url.searchParams.set("for", geo.for);
    url.searchParams.set("key", key);
    const [header, ...data] = await fetchJson(url, {}, { label: `ACS1 ${group} ${year} ${geo.for}` });
    rows.push(...data.map((d) => Object.fromEntries(header.map((h, i) => [h, d[i]]))));
  }
  return rows;
}

await runImport("census-acs1-immigration", async (pg) => {
  const key = process.env.CENSUS_API_KEY;
  await checkCensusKey(key);
  await registerDataset(pg, "census-acs1-immigration");
  let total = 0;
  for (const year of YEARS) {
    const out = [];
    const base = { source: "census-acs1-immigration", period: String(year), period_start: `${year}-01-01` };
    const value = (r, name) => {
      const v = num(r[name]);
      return v === null || v < -1e6 ? null : v; // ACS sentinels (-666666666)
    };
    const moe = (r, name) => {
      const v = num(r[name.replace(/E$/, "M")]);
      return v === null || v < 0 ? null : v;
    };
    const geoOf = (r) => (r.state ? r.state : "US");
    const push = (r, metric, geoLevel, geoid, geoName, v, unit, m) => {
      if (v === null) return;
      out.push({ ...base, metric, geo_level: geoLevel, geoid, geo_name: geoName, value: v, unit, metadata: m === null ? null : { moe: m } });
    };

    // B05002: place of birth by nativity and citizenship.
    const nat = await groupVars(year, "B05002");
    const find = (want) => nat.find((v) => v.path.join("|") === want)?.name;
    const vTotal = find("");
    const vForeign = find("foreign born");
    const vNatz = find("foreign born|naturalized u.s. citizen");
    const vNon = find("foreign born|not a u.s. citizen");
    if (!vTotal || !vForeign || !vNatz || !vNon) throw new Error(`${year}: B05002 labels not recognised`);
    for (const r of await fetchGroup(year, "B05002", key)) {
      const geo = geoOf(r);
      const level = geo === "US" ? "nation" : "state";
      const [all, fb, natz, non] = [vTotal, vForeign, vNatz, vNon].map((v) => value(r, v));
      push(r, "foreign_born", level, geo, r.NAME, fb, "people", moe(r, vForeign));
      push(r, "naturalized", level, geo, r.NAME, natz, "people", moe(r, vNatz));
      push(r, "noncitizen", level, geo, r.NAME, non, "people", moe(r, vNon));
      if (all && fb !== null) push(r, "foreign_born_share", level, geo, r.NAME, Math.round((fb / all) * 10000) / 100, "percent", null);
      if (fb && natz !== null) {
        push(r, "naturalized_share_of_foreign_born", level, geo, r.NAME, Math.round((natz / fb) * 10000) / 100, "percent", null);
      }
    }

    // B05006: place of birth for the foreign-born population. Regions are the
    // five continents with the Americas split Latin/Northern; countries are
    // the leaves of the label tree.
    const birth = await groupVars(year, "B05006");
    const labels = birth.map((v) => v.path.join("|"));
    const leaves = birth.filter((v) => v.path.length >= 2 && !labels.some((l) => l.startsWith(v.path.join("|") + "|")));
    const regions = birth.filter((v) => REGIONS.has(v.path.at(-1)) && (v.path.length === 1 || v.path[0] === "americas"));
    for (const r of await fetchGroup(year, "B05006", key)) {
      const geo = geoOf(r);
      for (const v of regions) {
        push(r, "foreign_born_by_region", "region", `${geo}:${slug(v.path.at(-1))}`, title(v.path.at(-1)), value(r, v.name), "people", moe(r, v.name));
      }
      for (const v of leaves) {
        const raw = v.label.split("!!").at(-1).replace(/:$/, "");
        push(r, "foreign_born_by_country", "country", `${geo}:${slug(raw)}`, raw, value(r, v.name), "people", moe(r, v.name));
      }
    }

    total += await upsertRows(pg, "area_stats", Object.keys(out[0]), out, ["source", "metric", "geo_level", "geoid", "period"], {
      batchSize: 1000,
    });
    console.log(`  ${year}: ${out.length} rows`);
  }
  return { inserted: total };
});
