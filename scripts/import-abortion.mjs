// Imports abortion statistics into `area_stats` from four sources:
//
//   guttmacher-monthly-abortions   Guttmacher Monthly Abortion Provision Study
//     abortions_monthly            nation | state | group ('total-ban' |
//                                  'no-total-ban'), period 'YYYY-MM',
//                                  metadata { lower, upper } (90% interval)
//     abortions, abortions_from_other_states, abortions_from_other_states_share,
//     abortions_virtual_only       annual by state of occurrence, 2023–
//     abortions_by_residence, abortions_residents_out_of_state
//                                  annual by state of residence, summed from
//     abortion_travel              the occurrence × residence table (geo_level
//                                  'flow', geoid '<occurrence FIPS>:<residence
//                                  FIPS>'; cells under 100 are suppressed)
//
//   guttmacher-pregnancy-history   Pregnancies, Births and Abortions in the
//                                  United States, 1973–2020 (state of residence)
//     abortions, abortion_rate, abortion_ratio, pregnancy_rate,
//     abortion_rate_<age>          nation 1973–2020, states 1988–2020 (gaps)
//
//   cdc-abortion-surveillance      CDC Abortion Surveillance (MMWR), parsed
//                                  from the reports' tables on PubMed Central
//     abortions_reported, abortion_rate, abortion_ratio
//                                  nation (Table 1, latest report) and state of
//                                  occurrence (Table 2, each report year)
//     abortions_nonresidents, abortions_nonresidents_share (Table 2)
//     medication_share             nation and state (Table 12)
//     share_age_<group>            nation (Table 4)
//     share_weeks_<range>          nation (Table 11)
//     abortion_rate_<race>, share_<race>   nation (Table 6)
//
//   abortion-gestational-limits    Each state's gestational limit as in effect
//                                  (Guttmacher state policy pages), period =
//                                  the month imported
//     gestational_limit_category   1 total ban … 5 no gestational limit,
//                                  metadata { label, detail }
//     gestational_limit_weeks      weeks (0 = total ban); no row without a limit
//
// Usage:
//   node scripts/import-abortion.mjs [--only=monthly,history,cdc,limits]
//   ENV_FILE=.env.cloud node scripts/import-abortion.mjs

import { STATE_FIPS, STATE_NAME_TO_ABBR, arg, fetchJson, fetchRetry, num, parseCsv, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { readXlsx } from "./lib/xlsx.mjs";

const ONLY = new Set((arg("only", "monthly,history,cdc,limits") ?? "").split(","));
const KEY = ["source", "metric", "geo_level", "geoid", "period"];
const NAME = Object.fromEntries(Object.entries(STATE_NAME_TO_ABBR).map(([n, a]) => [a, n]));

// ---- Guttmacher OSF files ---------------------------------------------------

// Files are looked up by name, so a re-upload (which keeps the name) is
// picked up without code changes.
async function osfFiles(node, folder) {
  const root = await fetchJson(`https://api.osf.io/v2/nodes/${node}/files/osfstorage/`, {}, { label: `osf ${node}` });
  const dir = root.data.find((f) => f.attributes.kind === "folder" && f.attributes.name === folder);
  if (!dir) throw new Error(`OSF ${node}: no folder "${folder}"`);
  const list = await fetchJson(dir.relationships.files.links.related.href, {}, { label: `osf ${node}/${folder}` });
  return Object.fromEntries(list.data.map((f) => [f.attributes.name, f.links.download]));
}
const download = async (url) => Buffer.from(await (await fetchRetry(url, {}, { label: url })).arrayBuffer());

// "US" -> nation, "TX" -> state FIPS, group rows -> group.
function place(code) {
  if (code === "US") return { geo_level: "nation", geoid: "US", geo_name: "United States" };
  if (/total bans/i.test(code)) {
    const without = /without/i.test(code);
    return { geo_level: "group", geoid: without ? "no-total-ban" : "total-ban", geo_name: without ? "States without total bans" : "States with total bans" };
  }
  const fips = STATE_FIPS[code];
  return fips ? { geo_level: "state", geoid: fips, geo_name: NAME[code] ?? code } : null;
}

// "(1,046,210‒1,072,740)" -> [1046210, 1072740]
const interval = (s) => {
  const m = String(s ?? "").replace(/,/g, "").match(/(-?\d+(?:\.\d+)?)%?\s*[‒–-]\s*(-?\d+(?:\.\d+)?)/);
  return m ? { lower: Number(m[1]), upper: Number(m[2]) } : null;
};
const count = (v) => (typeof v === "number" ? v : num(String(v ?? "").replace(/[,%]/g, "")));

async function importMonthly(pg) {
  const slug = "guttmacher-monthly-abortions";
  await registerDataset(pg, slug);
  const files = await osfFiles("k4x7t", "CSV and Excel");
  const need = (name) => files[name] ?? (() => { throw new Error(`OSF k4x7t: missing ${name}`); })();
  const rows = [];

  // Monthly estimates.
  const monthly = parseCsv((await download(need("MonthlyAbortionProvisionMonthly.csv"))).toString("utf8"));
  for (const r of monthly) {
    const p = place(r.state);
    const value = num(r.median);
    if (!p || value === null) continue;
    const period = r.month.slice(0, 7);
    rows.push({
      source: slug, metric: "abortions_monthly", ...p, period, period_start: `${period}-01`, value, unit: "abortions",
      metadata: { lower: num(r.lowerbound), upper: num(r.upperbound) },
    });
  }
  const published = monthly[0]?.publishdate ?? null;

  // Annual summary: counts, travelers in, virtual-only — one column per
  // (measure, year) followed by its 90% interval.
  const summary = Object.values(readXlsx(await download(need("Summary_Table_Annual_2023_2024_2025.xlsx"))))[0];
  const groups = summary[1];
  const years = summary[2];
  const MEASURES = [
    [/^Abortion counts/i, "abortions", "abortions"],
    [/^Number traveling/i, "abortions_from_other_states", "abortions"],
    [/^% traveling/i, "abortions_from_other_states_share", "percent"],
    [/virtual-only/i, "abortions_virtual_only", "abortions"],
  ];
  const cols = [];
  let group = null;
  years.forEach((y, c) => {
    if (groups[c]) group = String(groups[c]);
    const measure = group && MEASURES.find(([re]) => re.test(group));
    if (measure && typeof y === "number") cols.push({ c, year: String(y), metric: measure[1], unit: measure[2] });
  });
  for (const m of MEASURES) {
    if (!cols.some((c) => c.metric === m[1])) throw new Error(`Summary table: no "${m[1]}" columns — layout changed?`);
  }
  for (const r of summary.slice(3)) {
    const p = r[0] && place(String(r[0]).trim());
    if (!p) continue;
    for (const { c, year, metric, unit } of cols) {
      const value = count(r[c]);
      if (value === null) continue;
      const ui = interval(r[c + 1]);
      rows.push({ source: slug, metric, ...p, period: year, period_start: `${year}-01-01`, value, unit, metadata: ui });
    }
  }

  // Travel: state of occurrence (rows) × state of residence (columns), one
  // sheet per year. Empty cells are suppressed (<100) or zero.
  const travel = readXlsx(await download(need("State_Abortion_Travel_2023_2024_2025.xlsx")));
  for (const [sheet, table] of Object.entries(travel)) {
    if (!/^\d{4}$/.test(sheet)) continue;
    const header = table[0].map((h) => String(h ?? "").replace(/_residence$/, ""));
    const byResidence = {};
    for (const r of table.slice(1)) {
      const dest = STATE_FIPS[String(r[0] ?? "").trim()];
      if (!dest) continue;
      header.forEach((code, c) => {
        const origin = STATE_FIPS[code];
        const value = c > 0 && origin ? count(r[c]) : null;
        if (value === null) return;
        rows.push({
          source: slug, metric: "abortion_travel", geo_level: "flow", geoid: `${dest}:${origin}`,
          geo_name: `${NAME[code]} → ${NAME[String(r[0]).trim()]}`, period: sheet, period_start: `${sheet}-01-01`, value, unit: "abortions", metadata: null,
        });
        const t = (byResidence[origin] ??= { code, total: 0, out: 0 });
        t.total += value;
        if (origin !== dest) t.out += value;
      });
    }
    for (const [fips, t] of Object.entries(byResidence)) {
      const base = { source: slug, geo_level: "state", geoid: fips, geo_name: NAME[t.code], period: sheet, period_start: `${sheet}-01-01`, unit: "abortions", metadata: { suppressed_cells_excluded: true } };
      rows.push({ ...base, metric: "abortions_by_residence", value: t.total });
      rows.push({ ...base, metric: "abortions_residents_out_of_state", value: t.out });
    }
  }

  const inserted = await upsertRows(pg, "area_stats", Object.keys(rows[0]), rows, KEY);
  console.log(`  ${slug}: ${monthly.length} monthly source rows, published ${published}`);
  return inserted;
}

// ---- Guttmacher 1973–2020 ------------------------------------------------------

const AGES = { "1519": "15–19", "2024": "20–24", "2529": "25–29", "3034": "30–34", "3539": "35–39", "40plus": "40 and over" };

async function importHistory(pg) {
  const slug = "guttmacher-pregnancy-history";
  await registerDataset(pg, slug);
  // The CSV sits one level down, in Data set/CSV.
  const root = await fetchJson("https://api.osf.io/v2/nodes/kthnf/files/osfstorage/", {}, { label: "osf kthnf" });
  const dataSet = root.data.find((f) => f.attributes.name === "Data set");
  const sub = await fetchJson(dataSet.relationships.files.links.related.href, {}, { label: "osf kthnf/Data set" });
  const csvDir = sub.data.find((f) => f.attributes.kind === "folder" && f.attributes.name === "CSV");
  const csvList = await fetchJson(csvDir.relationships.files.links.related.href, {}, { label: "osf kthnf/Data set/CSV" });
  const csv = csvList.data.find((f) => f.attributes.name.endsWith(".csv"));
  if (!csv) throw new Error("OSF kthnf: no CSV in Data set/CSV");
  const data = parseCsv((await download(csv.links.download)).toString("utf8"));

  const rows = [];
  for (const r of data) {
    const p = place(r.state);
    if (!p) continue;
    const base = { source: slug, ...p, period: r.year, period_start: `${r.year}-01-01`, metadata: r.notes ? { note: r.notes } : null };
    const add = (metric, v, unit) => {
      const value = num(v);
      if (value !== null) rows.push({ ...base, metric, value, unit });
    };
    add("abortions", r.abortionstotal, "abortions");
    add("abortion_rate", r.abortionratetotal, "per_1000");
    add("abortion_ratio", r.abortionratiototal, "per_1000");
    add("pregnancy_rate", r.pregnancyratetotal, "per_1000");
    for (const age of Object.keys(AGES)) add(`abortion_rate_${age}`, r[`abortionrate${age}`], "per_1000");
  }
  const inserted = await upsertRows(pg, "area_stats", Object.keys(rows[0]), rows, KEY);
  console.log(`  ${slug}: ${data.length} source rows (version ${data[0]?.versiondate?.trim()})`);
  return inserted;
}

// ---- CDC Abortion Surveillance -------------------------------------------------

// One report per data year; the newest report's Table 1 carries the national
// series. Add each new report here when CDC publishes it.
const CDC_REPORTS = [
  { year: "2019", pmc: "PMC8654281" },
  { year: "2020", pmc: "PMC9707346" },
  { year: "2021", pmc: "PMC10684357" },
  { year: "2022", pmc: "PMC11616987" },
];

const decodeHtml = (s) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ")
    .trim();

// { T1: [[cell, ...], ...], ... } from a PMC article's table sections.
function pmcTables(html) {
  const out = {};
  for (const m of html.matchAll(/<section[^>]*id="(T\d+)"[\s\S]*?<\/section>/g)) {
    out[m[1]] = [...m[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => [...r[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => decodeHtml(c[1])));
  }
  return out;
}

const n = (s) => num(String(s ?? "").replace(/[,\s]/g, "").replace(/^[−–]/, "-").match(/^-?[\d.]+/)?.[0]);
// "794 (21.0)" -> [794, 21.0]
const pair = (s) => {
  const m = String(s ?? "").replace(/,/g, "").match(/^(\d+)\s*\(([\d.]+)\)/);
  return m ? [Number(m[1]), Number(m[2])] : [n(s), null];
};
// "Virginia§§" -> "VA"; null for sub-state rows (New York City / State) and totals.
const stateCode = (label) => STATE_NAME_TO_ABBR[label.replace(/[^A-Za-z .]/g, "").trim()] ?? null;

const AGE_ROWS = { "<15": "under15", "15–19": "15_19", "20–24": "20_24", "25–29": "25_29", "30–34": "30_34", "35–39": "35_39", "≥40": "40plus" };
const WEEK_ROWS = { "≤13 weeks": "le13", "≤6": "le6", "7–9": "7_9", "10–13": "10_13", ">13 weeks": "gt13", "14–15": "14_15", "16–17": "16_17", "18–20": "18_20", "≥21": "ge21" };

async function importCdc(pg) {
  const slug = "cdc-abortion-surveillance";
  await registerDataset(pg, slug);
  const rows = [];
  const nation = { geo_level: "nation", geoid: "US", geo_name: "United States" };
  const row = (p, metric, period, value, unit, metadata = null) =>
    value !== null && value !== undefined && Number.isFinite(value) && rows.push({ source: slug, metric, ...p, period, period_start: `${period}-01-01`, value, unit, metadata });

  for (const [i, rep] of CDC_REPORTS.entries()) {
    const html = (await download(`https://pmc.ncbi.nlm.nih.gov/articles/${rep.pmc}/`)).toString("utf8");
    const t = pmcTables(html);
    if (!t.T2 || !t.T12) throw new Error(`CDC ${rep.year} (${rep.pmc}): tables not found — page layout changed?`);
    const meta = { report: rep.pmc };
    const latest = i === CDC_REPORTS.length - 1;

    // Table 1: national series. Only the newest report's, since each report
    // recomputes rates over its own set of continuously reporting areas.
    if (latest) {
      for (const r of t.T1) {
        if (!/^\d{4}$/.test(r[0])) continue;
        row(nation, "abortions_reported", r[0], n(r[1]), "abortions", meta);
        row(nation, "abortion_rate", r[0], n(r.at(-2)), "per_1000", { ...meta, areas: "continuously reporting" });
        row(nation, "abortion_ratio", r[0], n(r.at(-1)), "per_1000", { ...meta, areas: "continuously reporting" });
      }
      // Table 4: age distribution by year.
      const years4 = t.T4[1].filter((c) => /^\d{4}$/.test(c));
      let block = null;
      for (const r of t.T4) {
        if (r.length === 1) block = /%/.test(r[0]) ? "share" : /rate/i.test(r[0]) ? "rate" : /ratio/i.test(r[0]) ? "ratio" : null;
        const key = AGE_ROWS[r[0]];
        if (!key || block !== "share") continue;
        years4.forEach((y, j) => row(nation, `share_age_${key}`, y, n(r[j + 1]), "percent", meta));
      }
      // Table 11: weeks of gestation by year.
      const years11 = t.T11[1].filter((c) => /^\d{4}$/.test(c));
      for (const r of t.T11) {
        const label = r[0].replace(/\s*\(%\).*$/, "").replace(/[†§¶*]+$/, "").trim();
        const key = WEEK_ROWS[label];
        if (key) years11.forEach((y, j) => row(nation, `share_weeks_${key}`, y, n(r[j + 1]), "percent", meta));
      }
    }

    // Table 2: by area of occurrence.
    for (const r of t.T2) {
      const code = stateCode(r[0]);
      if (!code || r.length < 5) continue;
      const p = { geo_level: "state", geoid: STATE_FIPS[code], geo_name: NAME[code] };
      row(p, "abortions_reported", rep.year, n(r[1]), "abortions", meta);
      row(p, "abortion_rate", rep.year, n(r[2]), "per_1000", meta);
      row(p, "abortion_ratio", rep.year, n(r[3]), "per_1000", meta);
      const [non, share] = pair(r[4]);
      row(p, "abortions_nonresidents", rep.year, non, "abortions", meta);
      row(p, "abortions_nonresidents_share", rep.year, share, "percent", meta);
    }
    const total2 = t.T2.find((r) => r[0] === "Total");
    if (total2 && !latest) row(nation, "abortions_reported", rep.year, n(total2[1]), "abortions", meta);

    // Table 12: method. Medication = the three medication columns, as a share
    // of abortions with a known method.
    for (const r of t.T12) {
      const code = r[0] === "Total" ? "US" : stateCode(r[0]);
      if (!code || r.length < 10) continue;
      const known = pair(r[9])[0];
      const medication = [4, 5, 6].reduce((s, c) => s + (pair(r[c])[0] ?? 0), 0);
      if (!known) continue;
      const p = code === "US" ? nation : { geo_level: "state", geoid: STATE_FIPS[code], geo_name: NAME[code] };
      row(p, "medication_share", rep.year, Math.round((medication / known) * 1000) / 10, "percent", { ...meta, known_method: known });
    }

    // Table 6: race and ethnicity, national total row plus rate and ratio
    // rows. Column order varies by report: the second header row names the
    // three non-Hispanic groups, and Hispanic follows them.
    const total6 = t.T6?.find((r) => r[0] === "Total");
    const rate6 = t.T6?.find((r) => /^Abortion rate/.test(r[0]));
    const ratio6 = t.T6?.find((r) => /^Abortion ratio/.test(r[0]));
    const order = [...(t.T6?.[1] ?? []).slice(0, 3).map((h) => h.replace(/[^A-Za-z]/g, "").toLowerCase()), "hispanic"];
    if (order.slice(0, 3).sort().join() !== "black,other,white") throw new Error(`CDC ${rep.year} Table 6: unexpected columns ${order}`);
    order.forEach((race, j) => {
      if (total6) row(nation, `share_${race}`, rep.year, pair(total6[j + 1])[1], "percent", meta);
      if (rate6) row(nation, `abortion_rate_${race}`, rep.year, n(rate6[j + 1]), "per_1000", meta);
      if (ratio6) row(nation, `abortion_ratio_${race}`, rep.year, n(ratio6[j + 1]), "per_1000", meta);
    });
  }

  const inserted = await upsertRows(pg, "area_stats", Object.keys(rows[0]), rows, KEY);
  console.log(`  ${slug}: reports ${CDC_REPORTS.map((r) => r.year).join(", ")}`);
  return inserted;
}

// ---- Gestational limits ------------------------------------------------------

const CATEGORY_LABELS = { 1: "Total ban", 2: "Banned at 6–12 weeks", 3: "Banned at 15–22 weeks", 4: "Banned at 24 weeks, viability, or third trimester", 5: "No gestational limit" };

// The "Abortion is …" clause of a state's policy summary -> limit.
function parseLimit(text) {
  const clause = text.split("|").map((c) => c.trim()).find((c) => /^Abortion is (completely banned|banned|not restricted)/i.test(c));
  if (!clause) return null;
  const detail = clause.split(/\.\s/)[0].replace(/\.$/, "");
  if (/completely banned/i.test(clause)) return { category: 1, weeks: 0, detail };
  if (/not restricted based on gestational/i.test(clause)) return { category: 5, weeks: null, detail };
  const w = clause.match(/banned at (\d+) weeks/i);
  if (w) {
    const weeks = Number(w[1]);
    return { category: weeks <= 12 ? 2 : weeks < 24 ? 3 : 4, weeks, detail };
  }
  if (/viability/i.test(clause)) return { category: 4, weeks: 24, detail };
  if (/third trimester/i.test(clause)) return { category: 4, weeks: 27, detail };
  return null;
}

async function importLimits(pg) {
  const slug = "abortion-gestational-limits";
  await registerDataset(pg, slug);
  const data = await fetchJson("https://states.guttmacher.org/policies/admin/api/collections/get/states/?populate=1", {}, { label: "guttmacher states" });
  const period = new Date().toISOString().slice(0, 7);
  const rows = [];
  const unparsed = [];
  for (const e of data.entries) {
    const code = e.state === "DC" ? "DC" : STATE_NAME_TO_ABBR[e.state];
    const limit = parseLimit(e.policies_currently_in_effect ?? "");
    if (!code || !limit) {
      unparsed.push(e.state);
      continue;
    }
    const base = { source: slug, geo_level: "state", geoid: STATE_FIPS[code], geo_name: NAME[code], period, period_start: `${period}-01`, unit: null };
    const metadata = { label: CATEGORY_LABELS[limit.category], detail: limit.detail, updated: new Date(Number(e._modified) * 1000).toISOString().slice(0, 10) };
    rows.push({ ...base, metric: "gestational_limit_category", value: limit.category, metadata });
    if (limit.weeks !== null) rows.push({ ...base, metric: "gestational_limit_weeks", value: limit.weeks, unit: "weeks", metadata });
  }
  if (unparsed.length) throw new Error(`Gestational limit not recognized for: ${unparsed.join(", ")}`);
  const inserted = await upsertRows(pg, "area_stats", Object.keys(rows[0]), rows, KEY);
  console.log(`  ${slug}: ${data.entries.length} states as of ${period}`);
  return inserted;
}

await runImport("abortion", async (pg) => {
  let inserted = 0;
  if (ONLY.has("monthly")) inserted += await importMonthly(pg);
  if (ONLY.has("history")) inserted += await importHistory(pg);
  if (ONLY.has("cdc")) inserted += await importCdc(pg);
  if (ONLY.has("limits")) inserted += await importLimits(pg);
  return { inserted };
});
