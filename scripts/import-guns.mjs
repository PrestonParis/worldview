// Imports gun data into `area_stats` (firearm deaths from 2019 on are in
// cdc-violent-deaths, imported by import-cdc-violent-deaths.mjs):
//
//   cdc-injury-mortality  NCHS injury mortality, firearm deaths by intent and
//                         by age and by race, 1999–2016 (data.cdc.gov
//                         nt65-c7a7); age groups are geo_level 'age_group',
//                         races geo_level 'race' (white_nh, black_nh, hispanic)
//   gallup-guns           Gallup trend questions on gun ownership and laws
//   fbi-nics              FBI NICS firearm background checks: annual by state
//                         and transaction type (FBI's year-by-state PDF from
//                         2016; the BuzzFeed News monthly CSV, transcribed from
//                         the same FBI PDFs, for 1999–2015) and national
//                         monthly totals (BuzzFeed through 2021, FBI's
//                         month/year PDF from 2022)
//   cdc-quarterly-mortality  NCHS quarterly provisional estimates: firearm
//                         death rates by age group and sex for each calendar
//                         year that has them (data.cdc.gov 489q-934x)
//   pew-guns              Pew Research Center's June 2023 survey of gun
//                         owners: ownership by group and reasons for owning,
//                         transcribed from Pew's published figures
//
// Usage:
//   node scripts/import-guns.mjs [--only=cdc,gallup,nics,cdcq,pew]
//   ENV_FILE=.env.cloud node scripts/import-guns.mjs

import { arg, fetchJson, fetchRetry, num, parseCsv, runImport, sleep, STATE_FIPS, STATE_NAME_TO_ABBR, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { parseGallupTables } from "./lib/gallup.mjs";
import { pdfPages } from "./lib/pdf.mjs";

const ONLY = new Set(arg("only", "cdc,gallup,nics,cdcq,pew").split(","));
const KEY = ["source", "metric", "geo_level", "geoid", "period"];
const COLUMNS = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
const US = { geo_level: "nation", geoid: "US", geo_name: "United States" };
// Gallup serves its data tables only to full browser user agents.
const BROWSER = { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15" } };

// ---- CDC ---------------------------------------------------------------------

const INTENTS = {
  "All Intentions": "firearm",
  Suicide: "firearm_suicide",
  Homicide: "firearm_homicide",
  Unintentional: "firearm_unintentional",
  Undetermined: "firearm_undetermined",
  "Legal intervention/war": "firearm_legal_intervention",
};
// Intents stored with a rate; the rest are counts only. Rates are crude
// (deaths per 100,000 residents), matching cdc-violent-deaths from 2019 on.
const RATED = new Set(["All Intentions", "Suicide", "Homicide"]);

async function importCdc(pg) {
  const slug = "cdc-injury-mortality";
  await registerDataset(pg, slug);
  const where = "injury_mechanism = 'Firearm' and sex = 'Both sexes' and race = 'All races'";
  const raw = await fetchJson(
    `https://data.cdc.gov/resource/nt65-c7a7.json?$where=${encodeURIComponent(where)}&$limit=50000`,
    { timeoutMs: 300_000 },
    { label: "cdc injury mortality" },
  );
  const rows = [];
  for (const r of raw) {
    const prefix = INTENTS[r.injury_intent];
    if (!prefix) continue;
    const base = { source: slug, period: r.year, period_start: `${r.year}-01-01`, metadata: null };
    if (r.age_years === "All Ages") {
      const deaths = num(r.deaths);
      if (deaths !== null) rows.push({ ...base, ...US, metric: prefix === "firearm" ? "firearm_deaths" : `${prefix}_deaths`, value: deaths, unit: "deaths" });
      const rate = num(r.age_specific_rate);
      if (RATED.has(r.injury_intent) && rate !== null) {
        rows.push({ ...base, ...US, metric: prefix === "firearm" ? "firearm_deaths_rate" : `${prefix}_rate`, value: Math.round(rate * 100) / 100, unit: "per_100k" });
      }
    } else if (r.injury_intent === "All Intentions") {
      const rate = num(r.age_specific_rate);
      if (rate !== null) {
        rows.push({
          ...base, metric: "firearm_deaths_rate_by_age", geo_level: "age_group", geoid: r.age_years, geo_name: r.age_years,
          value: Math.round(rate * 100) / 100, unit: "per_100k",
        });
      }
    }
  }
  // Race and Hispanic origin (all ages, both sexes): firearm deaths and
  // crude rates by intent, geo_level 'race' (white_nh, black_nh, hispanic).
  const RACES = { "Non-Hispanic white": "white_nh", "Non-Hispanic black": "black_nh", Hispanic: "hispanic" };
  const byRace = await fetchJson(
    `https://data.cdc.gov/resource/nt65-c7a7.json?$where=${encodeURIComponent("injury_mechanism = 'Firearm' and sex = 'Both sexes' and age_years = 'All Ages' and race != 'All races'")}&$limit=50000`,
    { timeoutMs: 300_000 },
    { label: "cdc injury mortality by race" },
  );
  for (const r of byRace) {
    const prefix = INTENTS[r.injury_intent];
    const race = RACES[r.race];
    if (!prefix || !race || !RATED.has(r.injury_intent)) continue;
    const base = { source: slug, period: r.year, period_start: `${r.year}-01-01`, metadata: null, geo_level: "race", geoid: race, geo_name: r.race };
    const deaths = num(r.deaths);
    const rate = num(r.age_specific_rate);
    if (deaths !== null) rows.push({ ...base, metric: prefix === "firearm" ? "firearm_deaths" : `${prefix}_deaths`, value: deaths, unit: "deaths" });
    if (rate !== null) rows.push({ ...base, metric: prefix === "firearm" ? "firearm_deaths_rate" : `${prefix}_rate`, value: Math.round(rate * 100) / 100, unit: "per_100k" });
  }
  if (!rows.some((r) => r.metric === "firearm_suicide_rate")) throw new Error("CDC injury mortality: no firearm suicide rows — columns renamed?");
  const inserted = await upsertRows(pg, "area_stats", COLUMNS, rows, KEY);
  console.log(`  ${slug}: ${rows.length} rows`);
  return inserted;
}

// ---- Gallup ------------------------------------------------------------------

const GALLUP_TABLES = {
  "Guns > Have Gun in Home Table": { "Yes, do": "gun_in_home" },
  "Guns > Personally Own Gun Table": { "Personally own": "personally_own_gun" },
  "Guns > Firearm Sales Strict Table": { "More strict": "laws_more_strict", "Less strict": "laws_less_strict", "Kept as now": "laws_kept_as_now" },
  "Guns > Ban Possession of Handguns Table": { "Yes, should be": "ban_handguns" },
  "Guns > Should Not Ban Assault Weapons Table": { "Should be": "ban_assault_rifles" },
};

async function importGallup(pg) {
  const slug = "gallup-guns";
  await registerDataset(pg, slug);
  // Gallup's CDN sometimes serves a copy of the page without its data
  // tables; ask again until one has them.
  let html = "";
  for (let attempt = 1; attempt <= 8 && !html.includes("<table"); attempt++) {
    if (attempt > 1) await sleep(3000);
    html = await (await fetchRetry("https://news.gallup.com/poll/1645/guns.aspx", BROWSER)).text();
  }
  const rows = parseGallupTables(html, GALLUP_TABLES, slug);
  const inserted = await upsertRows(pg, "area_stats", COLUMNS, rows, KEY);
  console.log(`  ${slug}: ${rows.length} rows`);
  return inserted;
}

// ---- FBI NICS -----------------------------------------------------------------

const FBI_NICS = "https://www.fbi.gov/file-repository/cjis";
const BUZZFEED_NICS =
  "https://raw.githubusercontent.com/BuzzFeedNews/nics-firearm-background-checks/master/data/nics-firearm-background-checks.csv";
// FBI's 24 transaction columns, in table order, then the row total.
const NICS_COLUMNS = [
  "permit", "permit_recheck", "handgun", "long_gun", "other", "multiple", "admin",
  "prepawn_handgun", "prepawn_long_gun", "prepawn_other",
  "redemption_handgun", "redemption_long_gun", "redemption_other",
  "returned_handgun", "returned_long_gun", "returned_other",
  "rentals_handgun", "rentals_long_gun",
  "private_sale_handgun", "private_sale_long_gun", "private_sale_other",
  "return_to_seller_handgun", "return_to_seller_long_gun", "return_to_seller_other",
];
const NICS_METRICS = {
  nics_checks: (r) => r.totals,
  nics_checks_handgun: (r) => r.handgun,
  nics_checks_long_gun: (r) => r.long_gun,
  nics_checks_permit: (r) => r.permit + r.permit_recheck,
  nics_checks_private_sale: (r) => r.private_sale_handgun + r.private_sale_long_gun + r.private_sale_other,
};
const FIRST_FBI_YEAR = 2016; // the year-by-state PDF's current 24-column layout
const FIRST_FBI_MONTH_YEAR = 2022;

const nicsNum = (c) => Number(c.replace(/,/g, ""));
const NAME_TO_ABBR = { ...STATE_NAME_TO_ABBR, Guam: "GU", "Mariana Islands": "MP", "Puerto Rico": "PR", "Virgin Islands": "VI" };
const NICS_NAMES = Object.fromEntries(Object.keys(NAME_TO_ABBR).map((n) => [n.replace(/\s/g, ""), n]));

// FBI's "Year by State and Type" PDF: one page per year. Text runs sometimes
// merge two cells ("154,278 1,978,285") or overprint the last column with the
// state name ("Illin0.."); the latter is recovered from the row total.
function parseNicsYears(pages) {
  const out = [];
  for (const lines of pages) {
    const year = lines.map((l) => /^Year\s*(\d{4})$/.exec(l.replace(/\t/g, "").trim())).find(Boolean)?.[1];
    if (!year || Number(year) < FIRST_FBI_YEAR) continue;
    // "January 1, 2026 - September 30, 2026": the last month the page covers.
    const through = lines.map((l) => /-\s*([A-Za-z]+)\s*\d+,\s*\d{4}\s*$/.exec(l)).find(Boolean);
    for (const line of lines) {
      const m = /^([A-Z][A-Za-z. ]+?)\t(.*)$/.exec(line);
      if (!m) continue;
      // Newer pages drop the spaces in names ("NewHampshire"); match without them.
      const key = m[1].replace(/\s/g, "");
      const name = NICS_NAMES[key];
      const abbr = name && NAME_TO_ABBR[name];
      const grand = key === "GrandTotal" || key === "Totals";
      if (!abbr && !grand) continue;
      const cells = m[2].split(/\s+/).filter(Boolean);
      const total = nicsNum(cells.at(-1));
      const values = cells.slice(0, -1).map((c) => (/^[\d,]+$/.test(c) ? nicsNum(c) : null));
      if (values.length !== NICS_COLUMNS.length) throw new Error(`NICS ${year} ${name}: ${values.length} columns`);
      const missing = values.filter((v) => v === null).length;
      if (missing > 1) throw new Error(`NICS ${year} ${name}: ${missing} unreadable cells`);
      const known = values.reduce((a, v) => a + (v ?? 0), 0);
      const row = Object.fromEntries(NICS_COLUMNS.map((c, i) => [c, values[i] ?? total - known]));
      out.push({ year, abbr: grand ? "US" : abbr, name: grand ? "United States" : name, partial: through?.[1] !== "December", row: { ...row, totals: total } });
    }
  }
  return out;
}

async function importNics(pg) {
  const slug = "fbi-nics";
  await registerDataset(pg, slug);
  const geo = (abbr, name) =>
    abbr === "US" ? US : STATE_FIPS[abbr] && abbr.length === 2 && Number(STATE_FIPS[abbr]) <= 56 ? { geo_level: "state", geoid: STATE_FIPS[abbr], geo_name: name } : null;
  const rows = [];
  const push = (g, period, start, metrics, row, metadata = null) => {
    for (const [metric, f] of Object.entries(metrics)) {
      rows.push({ source: slug, metric, ...g, period, period_start: start, value: f(row), unit: "checks", metadata });
    }
  };

  // Annual by state and type, FBI's PDF (complete years only).
  const pdf = Buffer.from(await (await fetchRetry(`${FBI_NICS}/nics_firearm_checks_-_year_by_state_type.pdf`, { timeoutMs: 300_000 })).arrayBuffer());
  const fbiYears = parseNicsYears(await pdfPages(pdf));
  if (!fbiYears.some((r) => r.abbr === "US")) throw new Error("NICS: no grand total rows — layout changed?");
  for (const r of fbiYears) {
    const g = geo(r.abbr, r.name);
    if (!g || r.partial) continue;
    push(g, r.year, `${r.year}-01-01`, NICS_METRICS, r.row);
  }

  // 1999–2015 annual and national monthly through 2021, from the CSV.
  const data = parseCsv(await (await fetchRetry(BUZZFEED_NICS, { timeoutMs: 300_000 })).text());
  const annual = new Map();
  const monthly = new Map();
  for (const line of data) {
    const [y, mo] = line.month.split("-");
    const r = Object.fromEntries([...NICS_COLUMNS, "totals"].map((c) => [c, Number(line[c] || 0)]));
    const add = (map, key) => {
      const cur = map.get(key) ?? Object.fromEntries(Object.keys(r).map((k) => [k, 0]));
      for (const k of Object.keys(r)) cur[k] += r[k];
      map.set(key, cur);
    };
    if (Number(y) >= 1999 && Number(y) < FIRST_FBI_YEAR) {
      const abbr = STATE_NAME_TO_ABBR[line.state];
      if (abbr) add(annual, `${y}|${abbr}|${line.state}`);
      add(annual, `${y}|US|United States`);
    }
    if (Number(y) < FIRST_FBI_MONTH_YEAR) add(monthly, `${y}-${mo}`);
  }
  for (const [key, r] of annual) {
    const [y, abbr, name] = key.split("|");
    const g = geo(abbr, name);
    if (g) push(g, y, `${y}-01-01`, NICS_METRICS, r);
  }
  const months = [...monthly].filter(([m]) => m >= "1998-12");
  for (const [m, r] of months) push(US, m, `${m}-01`, { nics_checks_monthly: (x) => x.totals }, r);

  // National monthly from 2022, FBI's month/year PDF.
  const my = await pdfPages(Buffer.from(await (await fetchRetry(`${FBI_NICS}/nics_firearm_checks_-_month_year.pdf`, { timeoutMs: 300_000 })).arrayBuffer()));
  for (const line of my.flat()) {
    const cells = line.split(/\t+/);
    if (!/^\d{4}$/.test(cells[0]) || Number(cells[0]) < FIRST_FBI_MONTH_YEAR) continue;
    const values = cells.slice(1).map((c) => c.trim());
    // A full year has 12 months plus the total; the current year has fewer.
    const monthsIn = values.length - 1;
    for (let i = 0; i < monthsIn; i++) {
      if (!/^\d{1,3}(,\d{3})*$/.test(values[i])) throw new Error(`NICS month/year ${cells[0]}: unreadable "${values[i]}"`);
      const m = `${cells[0]}-${String(i + 1).padStart(2, "0")}`;
      rows.push({ source: slug, metric: "nics_checks_monthly", ...US, period: m, period_start: `${m}-01`, value: nicsNum(values[i]), unit: "checks", metadata: null });
    }
  }

  const inserted = await upsertRows(pg, "area_stats", COLUMNS, rows, KEY);
  console.log(`  ${slug}: ${rows.length} rows`);
  return inserted;
}

// ---- CDC quarterly provisional mortality --------------------------------------

const CDC_AGES = {
  rate_age_1_4: "1–4", rate_age_5_14: "5–14", rate_age_15_24: "15–24", rate_age_25_34: "25–34",
  rate_age_35_44: "35–44", rate_age_45_54: "45–54", rate_age_55_64: "55–64", rate_age_65_74: "65–74",
  rate_age_75_84: "75–84", rate_age_85_plus: "85+",
};

async function importCdcQuarterly(pg) {
  const slug = "cdc-quarterly-mortality";
  await registerDataset(pg, slug);
  const where = "cause_of_death = 'Firearm-related injury' and rate_type = 'Crude' and time_period = '12 months ending with quarter' and year_and_quarter like '% Q4'";
  const raw = await fetchJson(`https://data.cdc.gov/resource/489q-934x.json?$where=${encodeURIComponent(where)}&$limit=1000`, {}, { label: "cdc quarterly mortality" });
  const rows = [];
  for (const r of raw) {
    const year = r.year_and_quarter.slice(0, 4);
    const base = { source: slug, period: year, period_start: `${year}-01-01`, unit: "per_100k", metadata: null };
    // The 12 months ending with Q4 are the calendar year.
    for (const [col, label] of Object.entries(CDC_AGES)) {
      const v = num(r[col]);
      if (v !== null) rows.push({ ...base, metric: "firearm_deaths_rate_by_age", geo_level: "age_group", geoid: label, geo_name: label, value: v });
    }
    for (const [col, label] of [["rate_sex_male", "Male"], ["rate_sex_female", "Female"]]) {
      const v = num(r[col]);
      if (v !== null) rows.push({ ...base, metric: "firearm_deaths_rate_by_sex", geo_level: "sex", geoid: label.toLowerCase(), geo_name: label, value: v });
    }
  }
  if (!rows.length) throw new Error("CDC quarterly: no firearm age or sex rows");
  const inserted = await upsertRows(pg, "area_stats", COLUMNS, rows, KEY);
  console.log(`  ${slug}: ${rows.length} rows`);
  return inserted;
}

// ---- Pew -----------------------------------------------------------------------

// Pew Research Center, American Trends Panel, June 5–11, 2023 (n = 5,115),
// as published in "Key facts about Americans and guns" (July 24, 2024) and
// "For most U.S. gun owners, protection is the main reason they own a gun"
// (Aug. 16, 2023). Pew publishes these as rounded percentages.
const PEW_OWNERSHIP = [
  ["all", "All adults", 32],
  ["men", "Men", 40],
  ["women", "Women", 25],
  ["rural", "Rural", 47],
  ["suburban", "Suburban", 30],
  ["urban", "Urban", 20],
  ["white", "White", 38],
  ["black", "Black", 24],
  ["hispanic", "Hispanic", 20],
  ["asian", "Asian", 10],
  ["rep", "Republican or lean Republican", 45],
  ["dem", "Democrat or lean Democrat", 20],
];
const PEW_REASONS = [
  ["protection", "Protection", 72],
  ["hunting", "Hunting", 32],
  ["sport", "Sport shooting", 30],
  ["collection", "Gun collection", 15],
  ["job", "For their job", 7],
];

async function importPew(pg) {
  const slug = "pew-guns";
  await registerDataset(pg, slug);
  const base = { source: slug, period: "2023", period_start: "2023-06-05", unit: "percent", metadata: { fielded: "2023-06-05/2023-06-11", n: 5115 } };
  const rows = [
    ...PEW_OWNERSHIP.map(([geoid, geo_name, value]) => ({ ...base, metric: "personally_own_gun", geo_level: "group", geoid, geo_name, value })),
    ...PEW_REASONS.map(([geoid, geo_name, value]) => ({ ...base, metric: "major_reason_to_own", geo_level: "reason", geoid, geo_name, value })),
  ];
  const inserted = await upsertRows(pg, "area_stats", COLUMNS, rows, KEY);
  console.log(`  ${slug}: ${rows.length} rows`);
  return inserted;
}

await runImport("guns", async (pg) => {
  let inserted = 0;
  if (ONLY.has("cdc")) inserted += await importCdc(pg);
  if (ONLY.has("gallup")) inserted += await importGallup(pg);
  if (ONLY.has("nics")) inserted += await importNics(pg);
  if (ONLY.has("cdcq")) inserted += await importCdcQuarterly(pg);
  if (ONLY.has("pew")) inserted += await importPew(pg);
  return { inserted };
});
