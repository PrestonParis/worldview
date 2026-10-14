// Imports religion statistics into `area_stats` from two sources:
//
//   pew-rls            Pew Research Center Religious Landscape Study, 2007,
//                      2014 and 2023–24 (period '2024'), scraped from the
//                      study's state and religious-group pages
//     share_<group>    share of adults in each religious tradition, family,
//                      or the Christian / other religions / unaffiliated
//                      totals; state (all three years), nation (2024 from the
//                      full tree, 2007 and 2014 from each group's page)
//     attendance_weekly | _monthly | _yearly | _seldom
//     importance_very | _somewhat | _not
//     pray_daily | pray_weekly_monthly | pray_seldom
//     god_certain | god_not_certain | god_no
//     party_rep | party_none | party_dem
//                      state (all years), nation (2024), group (all years)
//     age_18_29 | _30_49 | _50_64 | _65plus, race_white | _black | _hispanic |
//     _asian | _other, educ_hs_or_less | _some_college | _college | _postgrad
//                      group only — who belongs to each tradition
//     share_of_adults  geo_level 'group' (tradition, family, or denomination
//                      slug), metadata { label, kind, parent }
//
//   gallup-religion    Gallup's annual religion trends (nation only)
//
// Usage:
//   node scripts/import-religion.mjs [--only=pew,gallup] [--states=alabama,texas] [--cache=dir]
//   ENV_FILE=.env.cloud node scripts/import-religion.mjs

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { STATE_FIPS, STATE_NAME_TO_ABBR, arg, fetchRetry, runImport, sleep, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { parseGallupTables } from "./lib/gallup.mjs";

const ONLY = new Set(arg("only", "pew,gallup").split(","));
const ONLY_STATES = arg("states", null)?.split(",") ?? null;
const KEY = ["source", "metric", "geo_level", "geoid", "period"];
const COLUMNS = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
const BROWSER = { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15" } };

// ---- HTML helpers -------------------------------------------------------------

const ENTITIES = { quot: '"', amp: "&", lt: "<", gt: ">", apos: "'", nbsp: " " };
const unescape = (s) =>
  s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (all, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITIES[e.toLowerCase()] ?? all;
  });
const text = (s) => unescape(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

// The JSON value (object or array) that starts at `from`, skipping strings.
function jsonAt(s, from) {
  const open = s[from];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  for (let i = from; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) return JSON.parse(s.slice(from, i + 1));
  }
  throw new Error("unterminated JSON");
}

// Pew's bot check answers bursts with a 403 "Checking your browser" page
// for a minute or so; back off and retry. --cache=<dir> keeps fetched pages
// so a rerun doesn't fetch them again.
const CACHE = arg("cache", null);
async function page(url) {
  const file = CACHE && path.join(CACHE, `${createHash("sha1").update(url).digest("hex")}.html`);
  if (file && existsSync(file)) return unescape(await readFile(file, "utf8"));
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(url, { ...BROWSER, signal: AbortSignal.timeout(120_000) });
    } catch (err) {
      if (attempt >= 6) throw err;
      await sleep(5000 * attempt);
      continue;
    }
    if (res.status === 403 && attempt < 6) {
      console.log(`    403 on ${url} — waiting ${30 * attempt}s`);
      await sleep(30_000 * attempt);
      continue;
    }
    if (!res.ok) return unescape(await (await fetchRetry(url, BROWSER, { label: url })).text());
    const body = await res.text();
    if (file) {
      await mkdir(CACHE, { recursive: true });
      await writeFile(file, body);
    }
    await sleep(500);
    return unescape(body);
  }
}

// Runs `fn` over `items`, `limit` at a time.
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

// ---- Pew Religious Landscape Study ---------------------------------------------

const PEW = "https://www.pewresearch.org/religious-landscape-study";
const YEARS = { "2023-24": "2024", "2014": "2014", "2007": "2007" };

// Dialogs (questions) read from each page, with each answer column's metric.
const QUESTIONS = {
  "religious-attendance": {
    "At least once a week": "attendance_weekly",
    "Once or twice a month": "attendance_monthly",
    "A few times a year": "attendance_yearly",
    "Seldom/ Never": "attendance_seldom",
  },
  "importance-of-religion": {
    "Very important": "importance_very",
    "Somewhat important": "importance_somewhat",
    "Not too/ Not at all important": "importance_not",
  },
  "prayer-frequency": {
    "At least daily": "pray_daily",
    "Weekly/ Monthly": "pray_weekly_monthly",
    "Seldom/ Never": "pray_seldom",
  },
  "belief-in-god-universal-spirit": {
    "Believe in God or universal spirit; absolutely certain": "god_certain",
    "Believe in God or universal spirit; not absolutely certain": "god_not_certain",
    "Do not believe in God or universal spirit": "god_no",
  },
  "political-party": { "Rep/ lean Rep": "party_rep", "No lean": "party_none", "Dem/ lean Dem": "party_dem" },
};
// Who belongs to each group: read on group pages only.
const PROFILE = {
  age: { "18- 29": "age_18_29", "30- 49": "age_30_49", "50- 64": "age_50_64", "65+": "age_65plus" },
  "race-and-ethnicity": { White: "race_white", Black: "race_black", Hispanic: "race_hispanic", Asian: "race_asian", "Other/ Multiracial": "race_other" },
  education: { "High school or less": "educ_hs_or_less", "Some college": "educ_some_college", "College graduate": "educ_college", Postgraduate: "educ_postgrad" },
};

// Religious groups with their own national page.
const GROUPS = [
  ["christians/christian", "christian", "Christian"],
  ["religious-tradition/evangelical-protestant", "evangelical_protestant", "Evangelical Protestant"],
  ["religious-tradition/mainline-protestant", "mainline_protestant", "Mainline Protestant"],
  ["religious-tradition/historically-black-protestant", "historically_black_protestant", "Historically Black Protestant"],
  ["religious-tradition/catholic", "catholic", "Catholic"],
  ["religious-tradition/latter-day-saint-mormon", "latter_day_saint_mormon", "Latter-day Saint (Mormon)"],
  ["religious-tradition/orthodox-christian", "orthodox_christian", "Orthodox Christian"],
  ["religious-tradition/jewish", "jewish", "Jewish"],
  ["religious-tradition/muslim", "muslim", "Muslim"],
  ["religious-tradition/buddhist", "buddhist", "Buddhist"],
  ["religious-tradition/hindu", "hindu", "Hindu"],
  ["religious-family/atheist", "atheist", "Atheist"],
  ["religious-family/agnostic", "agnostic", "Agnostic"],
  ["religious-family/nothing-in-particular", "nothing_in_particular", "Nothing in particular"],
];

const AGGREGATE = { christians: "christian", others: "other_religions", unaffiliated: "unaffiliated" };
const groupKey = (name) => name.replace(/-/g, "_");

// The three top-level branches (Christians, other religions, unaffiliated)
// of the page's religious tree: shares computed from the weighted counts,
// which are more precise than the rounded percentages Pew prints.
function readTree(html) {
  const branches = [];
  for (const m of html.matchAll(/"selectedTradition":"([a-z]+)"/g)) {
    const at = html.indexOf('"treeData":', m.index);
    if (at < 0) continue;
    branches.push({ branch: m[1], items: jsonAt(html, at + '"treeData":'.length) });
  }
  if (branches.length < 3) throw new Error(`religious tree: found ${branches.length} of 3 branches`);
  const share = (item) => {
    if (item.data && item.percent?.total) return (item.data.value / item.percent.total) * 100;
    return item.percent ? Number(item.percent.value) || 0 : null;
  };
  const shares = {};
  const nodes = [];
  for (const { branch, items } of branches.slice(0, 3)) {
    let total = 0;
    for (const item of items) {
      const v = share(item);
      if (v === null) continue;
      shares[groupKey(item.name)] = v;
      total += v;
      // Families and denominations below each tradition.
      const walk = (children, parent, depth) => {
        for (const c of children ?? []) {
          const cv = share(c);
          const kind = /religious-denomination/.test(c.url ?? "") ? "denomination" : depth === 1 ? "family" : "denomination";
          if (cv !== null) nodes.push({ slug: c.name, label: c.label, kind, parent, value: cv });
          walk(c.children, c.name, depth + 1);
        }
      };
      nodes.push({ slug: item.name, label: item.label, kind: "tradition", parent: branch, value: v });
      walk(item.children, item.name, 1);
    }
    if (AGGREGATE[branch]) shares[AGGREGATE[branch]] = total;
  }
  return { shares, nodes };
}

const chartIds = (html) => Object.fromEntries([...html.matchAll(/dialogId=dialog_([a-z0-9-]+)&activeChartId=([0-9a-f]{32})/g)].map((m) => [m[1], m[2]]));

// The question's trend table: { period: { metric: value } } plus sample notes.
function readTrendTable(html, chartId, columns) {
  const at = html.indexOf(`id="${chartId}"`);
  const table = at >= 0 ? html.slice(at).match(/<table data-iframe-height[\s\S]*?<\/table>/)?.[0] : null;
  if (!table) return null;
  const caution = /Trend for comparison, with caution/.test(table);
  const header = [...table.matchAll(/<th>([\s\S]*?)<\/th>/g)].map((m) => text(m[1]));
  const out = {};
  for (const row of table.matchAll(/<tr[^>]*data-independent-var=?"?(\d{4})"?[^>]*>([\s\S]*?)<\/tr>|<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...(row[2] ?? row[3]).matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) => text(m[1]));
    const label = cells[0]?.replace(/\*$/, "");
    const period = YEARS[label];
    if (!period) continue;
    const values = {};
    header.forEach((h, i) => {
      const metric = columns[h];
      if (!metric || !cells[i]) return;
      values[metric] = cells[i].startsWith("<") ? 0 : Number(cells[i].replace("%", ""));
    });
    const n = Number(cells[header.indexOf("Unweighted sample size")]?.replace(/,/g, "")) || null;
    const moe = Number(cells[header.indexOf("Margin of error")]?.match(/[\d.]+/)?.[0]) || null;
    out[period] = { values, meta: { survey: label, n, moe, ...(caution && period === "2024" ? { mode_change: true } : {}) } };
  }
  return out;
}

// The compare chart's "U.S. population" row: national 2024 shares.
function readNational(html, chartId, columns) {
  const at = html.indexOf(`"${chartId}-compare-chart":{"data":`);
  if (at < 0) return null;
  const rows = jsonAt(html, html.indexOf("[", at));
  const us = rows.find((r) => r.x === "U.S. population");
  if (!us) return null;
  const values = {};
  for (const [label, metric] of Object.entries(columns)) {
    const key = Object.keys(us).find((k) => k.replace(/\s/g, "") === label.replace(/\s/g, ""));
    if (key && typeof us[key] === "number") values[metric] = us[key];
  }
  return values;
}

async function readQuestions(url, html, questions, label) {
  const ids = chartIds(html);
  const out = [];
  for (const [dialog, columns] of Object.entries(questions)) {
    const id = ids[dialog];
    if (!id) throw new Error(`${label}: no "${dialog}" chart`);
    const view = await page(`${url}?dialogId=dialog_${dialog}&activeChartId=${id}`);
    const trend = readTrendTable(view, id, columns);
    if (!trend || !Object.keys(trend).length) throw new Error(`${label}: "${dialog}" table not found — page layout changed?`);
    out.push({ dialog, trend, national: readNational(view, id, columns) });
  }
  return out;
}

const row = (metric, geo, period, value, metadata = null) => ({
  source: "pew-rls", metric, ...geo, period, period_start: `${period}-01-01`, value: Math.round(value * 100) / 100, unit: "percent", metadata,
});

async function importPew(pg) {
  await registerDataset(pg, "pew-rls");
  const rows = [];

  // National tree, 2024.
  const home = await page(`${PEW}/database/`);
  const nationTree = readTree(home);
  const nation = { geo_level: "nation", geoid: "US", geo_name: "United States" };
  for (const [key, v] of Object.entries(nationTree.shares)) rows.push(row(`share_${key}`, nation, "2024", v));
  for (const n of nationTree.nodes) {
    if (n.value < 0.05) continue;
    rows.push(row("share_of_adults", { geo_level: "group", geoid: n.slug, geo_name: n.label }, "2024", n.value, { label: n.label, kind: n.kind, parent: n.parent }));
  }

  // States.
  const locations = [...home.matchAll(/\{"name":"([^"]+)","type":"state"(?:,"region":"[a-z]+")?,"slug":"([a-z0-9-]+)"/g)];
  const states = [...new Map(locations.map((m) => [m[2], m[1]])).entries()].filter(([slug]) => !ONLY_STATES || ONLY_STATES.includes(slug));
  if (states.length < (ONLY_STATES ? 1 : 51)) throw new Error(`Pew location list: found ${states.length} states`);
  let nationalDone = false;
  await pool(states, 2, async ([slug, name]) => {
    const fips = STATE_FIPS[STATE_NAME_TO_ABBR[name] ?? (name === "Washington, D.C." ? "DC" : "")];
    if (!fips) throw new Error(`Pew state "${name}" has no FIPS`);
    const geo = { geo_level: "state", geoid: fips, geo_name: name };
    const url = `${PEW}/state/${slug}/`;
    const latest = await page(url);
    for (const [period, html] of [["2024", latest], ["2014", await page(`${url}?selectedYear=2014`)], ["2007", await page(`${url}?selectedYear=2007`)]]) {
      for (const [key, v] of Object.entries(readTree(html).shares)) rows.push(row(`share_${key}`, geo, period, v));
    }
    for (const q of await readQuestions(url, latest, QUESTIONS, name)) {
      for (const [period, { values, meta }] of Object.entries(q.trend)) {
        for (const [metric, v] of Object.entries(values)) rows.push(row(metric, geo, period, v, meta));
      }
      if (!nationalDone && q.national) {
        for (const [metric, v] of Object.entries(q.national)) rows.push(row(metric, nation, "2024", v, { survey: "2023-24" }));
      }
    }
    nationalDone = true;
    console.log(`  ${name}`);
  });

  // Religious groups: national share by year, beliefs, practice, party, and
  // who belongs.
  await pool(GROUPS, 2, async ([groupPath, key, label]) => {
    const url = `${PEW}/${groupPath}/`;
    const geo = { geo_level: "group", geoid: groupPath.split("/")[1], geo_name: label };
    const latest = await page(url);
    for (const [period, html] of [["2024", latest], ["2014", await page(`${url}?selectedYear=2014`)], ["2007", await page(`${url}?selectedYear=2007`)]]) {
      const pct = html.match(/(\d+)% of U\.S\. adults/)?.[1];
      if (pct === undefined) throw new Error(`${label} ${period}: no "% of U.S. adults"`);
      // 2024 shares come from the national tree (unrounded); earlier years
      // only from the group page.
      if (period !== "2024") {
        rows.push(row(`share_${key}`, nation, period, Number(pct), { rounded: true }));
        rows.push(row("share_of_adults", geo, period, Number(pct), { label, kind: "tradition", rounded: true }));
      }
    }
    for (const q of await readQuestions(url, latest, { ...QUESTIONS, ...PROFILE }, label)) {
      for (const [period, { values, meta }] of Object.entries(q.trend)) {
        for (const [metric, v] of Object.entries(values)) rows.push(row(metric, geo, period, v, meta));
      }
    }
    console.log(`  ${label}`);
  });

  // A group with its own page and a tree node keeps the tree's 2024 share.
  // Pew's page for the unaffiliated as a whole is broken (it redirects to
  // the study's home page), so their national share in 2007 and 2014 is the
  // sum of atheists, agnostics, and "nothing in particular".
  for (const period of ["2007", "2014"]) {
    const parts = ["share_atheist", "share_agnostic", "share_nothing_in_particular"].map(
      (m) => rows.find((r) => r.metric === m && r.geo_level === "nation" && r.period === period)?.value,
    );
    if (parts.every((v) => v !== undefined)) {
      rows.push(row("share_unaffiliated", nation, period, parts.reduce((a, b) => a + b, 0), { rounded: true, summed: "atheist + agnostic + nothing in particular" }));
    }
  }

  const unique = new Map(rows.map((r) => [KEY.map((k) => r[k]).join("|"), r]));
  const inserted = await upsertRows(pg, "area_stats", COLUMNS, [...unique.values()], KEY);
  console.log(`  pew-rls: ${states.length} states, ${GROUPS.length} groups, ${unique.size} rows`);
  return inserted;
}

// ---- Gallup ----------------------------------------------------------------------

// Table title -> { column header: metric }. Rows are newest first; a year with
// several polls keeps the latest.
const GALLUP_TABLES = {
  "Religion > Religion Important Table": { "Very important": "religion_very_important", "Fairly important": "religion_fairly_important", "Not very important": "religion_not_very_important" },
  "Religion > Religious Preference Table": {
    Protestant: "preference_protestant", "Christian (nonspecific)": "preference_christian_nonspecific", Catholic: "preference_catholic",
    Jewish: "preference_jewish", Mormon: "preference_mormon", Other: "preference_other", None: "preference_none",
  },
  "Religion > Member of Church Table": { Yes: "church_member" },
  "Religion > Attend Church Last Seven Days Table": { Yes: "attended_past_week" },
  "Religion > How Often Attend Church Table": {
    "Every week": "attend_every_week", "Almost every week": "attend_almost_every_week", "About once a month": "attend_monthly",
    Seldom: "attend_seldom", Never: "attend_never",
  },
  "Religion > Confidence Institutions Organized Religion Table": { "Great deal": "confidence_great_deal", "Quite a lot": "confidence_quite_a_lot" },
  "Religion > Born Again Evangelical Table": { Yes: "born_again" },
};

async function importGallup(pg) {
  const slug = "gallup-religion";
  await registerDataset(pg, slug);
  const rows = parseGallupTables(await page("https://news.gallup.com/poll/1690/religion.aspx"), GALLUP_TABLES, slug);
  const inserted = await upsertRows(pg, "area_stats", COLUMNS, rows, KEY);
  console.log(`  ${slug}: ${rows.length} rows, ${new Set(rows.map((r) => r.metric)).size} series`);
  return inserted;
}

await runImport("religion", async (pg) => {
  let inserted = 0;
  if (ONLY.has("gallup")) inserted += await importGallup(pg);
  if (ONLY.has("pew")) inserted += await importPew(pg);
  return { inserted };
});
