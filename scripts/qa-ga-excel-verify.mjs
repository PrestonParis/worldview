#!/usr/bin/env node
// Independent QA: compare stored GA results (tracked_contests / tracked_contest_options)
// against the Georgia SOS "Total Votes Excel" report from results.sos.ga.gov.
//
// This script deliberately shares no code with the results ingester. It downloads the
// official .xlsx, unzips it with the system `unzip`, parses the sheet XML itself and
// reads the DB read-only.
//
// Usage:
//   node scripts/qa-ga-excel-verify.mjs --election=GeneralPrimary51926
//     [--counties=none|all|fulton-county-ga,appling-county-ga,...]   (default none)
//     [--workdir=/path/for/downloads] [--delay=1500] [--json]
//
// Report URL pattern (from the site's Angular "download reports" page):
//   https://results.sos.ga.gov/cdn/results/{jurisdictionId}/{encodeURIComponent(blobName)}
// where jurisdictionId and publicReportCategories[].reports[].blobName come from
//   https://results.sos.ga.gov/results/public/api/elections/{Georgia|<county-slug>}/{electionId}

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import pg from "pg";

const BASE = "https://results.sos.ga.gov";
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);
const ELECTION = args.election;
if (!ELECTION) {
  console.error("usage: node scripts/qa-ga-excel-verify.mjs --election=<id> [--counties=none|all|slug,slug]");
  process.exit(2);
}
const WORKDIR = args.workdir || path.join(os.tmpdir(), "ga-excel-qa");
const DELAY = Number(args.delay ?? 1500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- download + xlsx parse

let lastRequest = 0;
async function politeFetch(url) {
  const wait = lastRequest + DELAY - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();
  const res = await fetch(url, { headers: { "user-agent": "worldview-qa/1.0" } });
  return res;
}

async function getHeader(jurisdiction, electionId) {
  const res = await politeFetch(`${BASE}/results/public/api/elections/${jurisdiction}/${electionId}`);
  if (!res.ok) return null;
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function reportUrl(header) {
  const reports = (header.publicReportCategories || []).flatMap((c) => c.reports || []);
  const r = reports.find((x) => /total votes excel/i.test(x.reportName)) || reports.find((x) => /\.xlsx$/i.test(x.blobName));
  if (!r) return null;
  return `${BASE}/cdn/results/${header.jurisdictionId}/${encodeURIComponent(r.blobName)}`;
}

async function downloadAndUnzip(url, label) {
  fs.mkdirSync(WORKDIR, { recursive: true });
  const dir = fs.mkdtempSync(path.join(WORKDIR, `${label}-`)); // fresh empty dir per download
  const res = await politeFetch(url);
  if (!res.ok) throw new Error(`download ${url} -> HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const file = path.join(dir, "report.xlsx");
  fs.writeFileSync(file, buf);
  const out = path.join(dir, "x");
  execFileSync("unzip", ["-q", "-o", file, "-d", out]);
  return out;
}

function xmlDecode(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

function textOf(fragment) {
  // concatenates all <t> runs (handles rich text <r><t>..</t></r>)
  return xmlDecode([...fragment.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));
}

function readSheet(xdir, sheetName) {
  const sstPath = path.join(xdir, "xl", "sharedStrings.xml");
  const sst = fs.existsSync(sstPath)
    ? [...fs.readFileSync(sstPath, "utf8").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]))
    : [];
  const wb = fs.readFileSync(path.join(xdir, "xl", "workbook.xml"), "utf8");
  const rels = fs.readFileSync(path.join(xdir, "xl", "_rels", "workbook.xml.rels"), "utf8");
  const sheet = [...wb.matchAll(/<sheet\b([^>]*)\/?>/g)]
    .map((m) => ({ name: xmlDecode(/name="([^"]*)"/.exec(m[1])?.[1] ?? ""), rid: /r:id="([^"]*)"/.exec(m[1])?.[1] }))
    .find((s) => s.name === sheetName);
  if (!sheet) throw new Error(`sheet "${sheetName}" not found`);
  const rel = [...rels.matchAll(/<Relationship\b([^>]*)\/?>/g)]
    .map((m) => ({ id: /Id="([^"]*)"/.exec(m[1])?.[1], target: /Target="([^"]*)"/.exec(m[1])?.[1] }))
    .find((r) => r.id === sheet.rid);
  const target = rel.target.replace(/^\/?xl\//, "").replace(/^\//, "");
  const sheetPath = path.join(xdir, "xl", target);
  if (!path.resolve(sheetPath).startsWith(path.resolve(xdir))) throw new Error("bad sheet path");
  const xml = fs.readFileSync(sheetPath, "utf8");
  const rows = [];
  for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = {};
    for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const ref = /r="([A-Z]+)\d+"/.exec(attrs)?.[1];
      const t = /t="(\w+)"/.exec(attrs)?.[1];
      const inner = c[2] || "";
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let val = null;
      if (t === "s") val = v != null ? sst[Number(v)] : null;
      else if (t === "inlineStr") val = textOf(/<is>([\s\S]*?)<\/is>/.exec(inner)?.[1] ?? "");
      else if (t === "str") val = v != null ? xmlDecode(v) : null;
      else if (v != null) val = xmlDecode(v);
      if (ref) row[ref] = val;
    }
    rows.push(row);
  }
  return rows;
}

// "Total Votes" sheet: Office Name | Contest ID | Ballot Name | Choice ID | Party | Total
function parseTotalVotes(xdir) {
  const rows = readSheet(xdir, "Total Votes");
  const header = rows[0] || {};
  const col = {};
  for (const [k, v] of Object.entries(header)) if (v) col[String(v).trim()] = k;
  for (const need of ["Office Name", "Contest ID", "Ballot Name", "Party", "Total"])
    if (!col[need]) throw new Error(`missing column ${need}; header=${JSON.stringify(header)}`);
  const contests = new Map(); // contestId -> contest
  for (const row of rows.slice(1)) {
    const office = row[col["Office Name"]];
    const cid = row[col["Contest ID"]];
    const ballot = row[col["Ballot Name"]];
    if (!office || !ballot) continue;
    const key = `${cid}|${office}`;
    if (!contests.has(key)) contests.set(key, { contestId: cid, office, candidates: [], total: null });
    const c = contests.get(key);
    const n = Number(row[col["Total"]]);
    if (!Number.isFinite(n)) throw new Error(`non-numeric total in ${office}/${ballot}: ${row[col["Total"]]}`);
    if (ballot === "Total Votes") c.total = n;
    else if (ballot === "Ballots Cast") continue;
    else c.candidates.push({ raw: ballot, party: row[col["Party"]] || null, votes: n, choiceId: row[col["Choice ID"]] });
  }
  return [...contests.values()];
}

function workbookTimestamp(xdir) {
  const p = path.join(xdir, "docProps", "core.xml");
  if (!fs.existsSync(p)) return null;
  return /<dcterms:modified[^>]*>([^<]*)</.exec(fs.readFileSync(p, "utf8"))?.[1] ?? null;
}

// ---------------------------------------------------------------- normalization

const PARTY_WORD = { rep: "R", republican: "R", dem: "D", democrat: "D", democratic: "D", lib: "L", libertarian: "L", np: "NP", nonpartisan: "NP" };

function basicNorm(s) {
  return s
    .normalize("NFKC")
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Returns { name, party } where name has the bilingual "/ ..." translation and trailing
// " - Rep"/" - Dem" party suffix removed.
function splitContestName(raw) {
  let s = basicNorm(raw);
  let party = null;
  const suf = /\s-\s(rep|dem|lib|np|republican|democrat|democratic|libertarian|nonpartisan)$/.exec(s);
  if (suf) {
    party = PARTY_WORD[suf[1]];
    s = s.slice(0, suf.index);
  }
  const slash = s.indexOf("/");
  if (slash > 0) {
    // English half of "X/ Spanish X (Seat)"; keep a trailing seat qualifier like "(Bethel)"
    const qual = /\s*(\([^()]*\))$/.exec(s.slice(slash));
    s = s.slice(0, slash).trim() + (qual ? ` ${qual[1]}` : "");
  }
  s = s.replace(/\s-\s*$/, "").trim();
  return { name: s, party };
}
const contestKeyName = (n) => n.replace(/[^a-z0-9]+/g, " ").trim();

const MARKER = /\((?:i|rep|dem|lib|ind|np|r|d|l|grn|green|republican|democrat|libertarian|independent|incumbent)\)/gi;
function candNorm(raw) {
  return basicNorm(raw.replace(MARKER, " ")).replace(/\s+/g, " ").trim();
}
const candLoose = (raw) => candNorm(raw).replace(/[^a-z0-9]+/g, "");

// ---------------------------------------------------------------- matching

function candidateOverlap(xCands, dCands) {
  const xs = new Set(xCands.map((c) => candLoose(c.raw)));
  const ds = new Set(dCands.map((c) => candLoose(c.name)));
  let inter = 0;
  for (const x of xs) if (ds.has(x)) inter++;
  return inter / Math.max(1, new Set([...xs, ...ds]).size);
}

// Pair Excel contests to DB contests that share a key; disambiguate by candidate set.
function pairGroup(xList, dList) {
  const pairs = [];
  const usedD = new Set();
  const cands = [];
  for (const [xi, x] of xList.entries())
    for (const [di, d] of dList.entries()) cands.push({ xi, di, score: candidateOverlap(x.candidates, d.options) });
  cands.sort((a, b) => b.score - a.score);
  const usedX = new Set();
  for (const c of cands) {
    if (usedX.has(c.xi) || usedD.has(c.di) || c.score === 0) continue;
    usedX.add(c.xi);
    usedD.add(c.di);
    pairs.push({ x: xList[c.xi], d: dList[c.di], score: c.score, ambiguous: xList.length > 1 || dList.length > 1 });
  }
  return {
    pairs,
    xLeft: xList.filter((_, i) => !usedX.has(i)),
    dLeft: dList.filter((_, i) => !usedD.has(i)),
  };
}

function compareContest(x, d, where) {
  const issues = [];
  const dByStrict = new Map();
  const dByLoose = new Map();
  for (const o of d.options) {
    dByStrict.set(candNorm(o.name), o);
    dByLoose.set(candLoose(o.name), o);
  }
  const usedOpt = new Set();
  let matchedCands = 0;
  let exactCands = 0;
  for (const c of x.candidates) {
    let o = dByStrict.get(candNorm(c.raw));
    let loose = false;
    if (!o) {
      o = dByLoose.get(candLoose(c.raw));
      loose = !!o;
    }
    if (!o || usedOpt.has(o)) {
      issues.push({ kind: "candidate_missing_in_db", where, contest: x.office, candidate: c.raw, excelVotes: c.votes });
      continue;
    }
    usedOpt.add(o);
    matchedCands++;
    if (loose) issues.push({ kind: "candidate_name_differs", where, contest: x.office, excel: c.raw, db: o.name });
    if (o.votes !== c.votes)
      issues.push({ kind: "vote_mismatch", where, contest: x.office, candidate: c.raw, excelVotes: c.votes, dbVotes: o.votes, diff: (o.votes ?? 0) - c.votes });
    else exactCands++;
  }
  for (const o of d.options)
    if (!usedOpt.has(o))
      issues.push({ kind: "candidate_missing_in_excel", where, contest: d.name, candidate: o.name, dbVotes: o.votes, writeIn: o.is_write_in });
  if (x.total != null && d.total_votes !== x.total)
    issues.push({ kind: "total_mismatch", where, contest: x.office, excelTotal: x.total, dbTotal: d.total_votes, diff: (d.total_votes ?? 0) - x.total });
  return { issues, matchedCands, exactCands };
}

function keyFor(name, party) {
  const s = splitContestName(name);
  return { full: `${contestKeyName(s.name)}|${party ?? s.party ?? ""}`, nameOnly: contestKeyName(s.name) };
}

function excelKey(x) {
  return keyFor(x.office, null);
}
function dbKey(d) {
  const s = splitContestName(d.name);
  const p = s.party ?? (d.primary_party ? PARTY_WORD[String(d.primary_party).toLowerCase()] ?? d.primary_party : null);
  return keyFor(d.name, p);
}

// Matches a list of Excel contests to a list of DB contests. Returns per-contest results.
function matchSets(xContests, dContests, where) {
  const xBy = new Map();
  const dBy = new Map();
  for (const x of xContests) {
    const k = excelKey(x).full;
    if (!xBy.has(k)) xBy.set(k, []);
    xBy.get(k).push(x);
  }
  for (const d of dContests) {
    const k = dbKey(d).full;
    if (!dBy.has(k)) dBy.set(k, []);
    dBy.get(k).push(d);
  }
  const pairs = [];
  let xLeft = [];
  let dLeft = [];
  for (const [k, xs] of xBy) {
    const ds = dBy.get(k) || [];
    const r = pairGroup(xs, ds);
    pairs.push(...r.pairs);
    xLeft.push(...r.xLeft);
    dLeft.push(...r.dLeft);
    dBy.delete(k);
  }
  for (const ds of dBy.values()) dLeft.push(...ds);
  // Second pass: same name ignoring party key (records a naming note), candidate-set disambiguated.
  const nameNotes = [];
  if (xLeft.length && dLeft.length) {
    const xN = new Map();
    for (const x of xLeft) {
      const k = excelKey(x).nameOnly;
      if (!xN.has(k)) xN.set(k, []);
      xN.get(k).push(x);
    }
    const dN = new Map();
    for (const d of dLeft) {
      const k = dbKey(d).nameOnly;
      if (!dN.has(k)) dN.set(k, []);
      dN.get(k).push(d);
    }
    const nx = [];
    const nd = [];
    for (const [k, xs] of xN) {
      const ds = dN.get(k) || [];
      const r = pairGroup(xs, ds);
      for (const p of r.pairs) {
        pairs.push(p);
        nameNotes.push({ kind: "party_key_differs", where, excel: p.x.office, db: p.d.name, dbPrimaryParty: p.d.primary_party });
      }
      nx.push(...r.xLeft);
      nd.push(...r.dLeft);
      dN.delete(k);
    }
    for (const ds of dN.values()) nd.push(...ds);
    xLeft = nx;
    dLeft = nd;
  }
  const issues = [...nameNotes];
  let exactContests = 0;
  let cands = 0;
  let exactCands = 0;
  for (const p of pairs) {
    const r = compareContest(p.x, p.d, where);
    if (p.ambiguous && p.score < 1)
      issues.push({ kind: "ambiguous_pairing", where, contest: p.x.office, overlap: Number(p.score.toFixed(2)) });
    issues.push(...r.issues);
    cands += p.x.candidates.length;
    exactCands += r.exactCands;
    if (!r.issues.some((i) => i.kind !== "candidate_name_differs")) exactContests++;
  }
  for (const x of xLeft)
    issues.push({ kind: "contest_missing_in_db", where, contest: x.office, excelContestId: x.contestId, total: x.total, candidates: x.candidates.map((c) => `${c.raw}=${c.votes}`) });
  for (const d of dLeft)
    issues.push({ kind: "contest_missing_in_excel", where, contest: d.name, dbId: d.id, county: d.county, scope: d.scope, total: d.total_votes });
  return { pairs: pairs.length, exactContests, cands, exactCands, xCount: xContests.length, dCount: dContests.length, issues };
}

// ---------------------------------------------------------------- DB

async function loadDb(electionId) {
  process.loadEnvFile(path.join(import.meta.dirname, "..", ".env.local"));
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("set default_transaction_read_only = on");
    const { rows: contests } = await client.query(
      `select id, name, raw_name, county, county_slug, counties, scope, primary_party, total_votes, as_of, source_updated_at
         from tracked_contests where source_election_id = $1 and removed_at is null`,
      [electionId],
    );
    const { rows: opts } = await client.query(
      `select o.contest_id, o.name, o.party, o.votes, o.is_write_in
         from tracked_contest_options o join tracked_contests c on c.id = o.contest_id
        where c.source_election_id = $1 and c.removed_at is null`,
      [electionId],
    );
    const byId = new Map(contests.map((c) => [c.id, { ...c, options: [] }]));
    for (const o of opts) byId.get(o.contest_id)?.options.push(o);
    return [...byId.values()];
  } finally {
    await client.end();
  }
}

// ---------------------------------------------------------------- main

function summarizeIssues(issues) {
  const counts = {};
  for (const i of issues) counts[i.kind] = (counts[i.kind] || 0) + 1;
  return counts;
}

async function main() {
  const db = await loadDb(ELECTION);
  const out = { election: ELECTION, state: null, counties: [], notCoveredDb: {} };

  const header = await getHeader("Georgia", ELECTION);
  if (!header) throw new Error(`no state header for ${ELECTION}`);
  const url = reportUrl(header);
  if (!url) throw new Error("no Total Votes Excel report in header");
  const xdir = await downloadAndUnzip(url, `state-${ELECTION}`);
  const stateExcel = parseTotalVotes(xdir);
  const stateKeys = new Set(stateExcel.map((x) => excelKey(x).full));
  const dbState = db.filter((d) => d.scope === "state");
  const res = matchSets(stateExcel, dbState, "state");
  out.state = {
    url,
    workbookModified: workbookTimestamp(xdir),
    headerPublishDate: header.publishDate,
    headerAsOf: header.asOf,
    dbAsOf: [...new Set(dbState.map((d) => d.as_of?.toISOString?.()))].slice(0, 3),
    ...res,
  };

  // County reports
  let slugs = [];
  if (args.counties === "all") slugs = [...new Set(db.filter((d) => d.county_slug).map((d) => d.county_slug))].sort();
  else if (args.counties && args.counties !== "none") slugs = String(args.counties).split(",").map((s) => s.trim()).filter(Boolean);
  // multi-county DB contests need all of their counties; also pull in their counties when requested
  const multi = db.filter((d) => d.scope === "multi_county");
  const countyLocal = new Map(); // slug -> local excel contests
  for (const slug of slugs) {
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`bad slug ${slug}`);
    const h = await getHeader(slug, ELECTION);
    if (!h) {
      out.counties.push({ slug, error: "no county election header" });
      continue;
    }
    const u = reportUrl(h);
    if (!u) {
      out.counties.push({ slug, error: "no Total Votes Excel in county header" });
      continue;
    }
    const cdir = await downloadAndUnzip(u, `${slug}-${ELECTION}`);
    const all = parseTotalVotes(cdir);
    const local = all.filter((x) => !stateKeys.has(excelKey(x).full));
    countyLocal.set(slug, local);
    // local contests shared with a multi-county DB contest are handled below
    const multiKeys = new Set(multi.filter((m) => (m.counties || []).includes(slug)).map((m) => dbKey(m).full));
    const localSingle = local.filter((x) => !multiKeys.has(excelKey(x).full));
    const dbCounty = db.filter((d) => d.scope === "county" && d.county_slug === slug);
    const r = matchSets(localSingle, dbCounty, slug);
    out.counties.push({ slug, url: u, workbookModified: workbookTimestamp(cdir), excelContestsTotal: all.length, excelLocal: local.length, ...r });
  }
  // Multi-county: sum per-county parts when every county is downloaded.
  const multiRes = [];
  for (const m of multi) {
    const cs = m.counties || [];
    if (!cs.every((c) => countyLocal.has(c))) {
      multiRes.push({ contest: m.name, counties: cs, skipped: "not all counties downloaded" });
      continue;
    }
    const k = dbKey(m).full;
    const parts = cs.flatMap((c) => countyLocal.get(c).filter((x) => excelKey(x).full === k));
    const agg = new Map();
    let total = 0;
    for (const p of parts) {
      total += p.total ?? 0;
      for (const c of p.candidates) {
        const ck = candNorm(c.raw);
        if (!agg.has(ck)) agg.set(ck, { raw: c.raw, party: c.party, votes: 0 });
        agg.get(ck).votes += c.votes;
      }
    }
    const x = { office: parts[0]?.office ?? m.name, candidates: [...agg.values()], total };
    const r = matchSets(parts.length ? [x] : [], [m], `multi:${cs.join("+")}`);
    multiRes.push({ contest: m.name, counties: cs, parts: parts.length, ...r });
  }
  out.multiCounty = multiRes;

  const coveredSlugs = new Set(countyLocal.keys());
  const uncovered = db.filter((d) => (d.scope === "county" && !coveredSlugs.has(d.county_slug)) || (d.scope === "multi_county" && !(d.counties || []).every((c) => coveredSlugs.has(c))));
  out.notCoveredDb = { contests: uncovered.length, options: uncovered.reduce((a, d) => a + d.options.length, 0) };

  if (args.json) {
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  const print = (label, r) => {
    console.log(`\n== ${label}`);
    if (r.url) console.log(`   report: ${r.url}`);
    if (r.workbookModified) console.log(`   workbook modified: ${r.workbookModified}`);
    console.log(`   excel contests: ${r.xCount}  db contests in scope: ${r.dCount}  paired: ${r.pairs}  exact contests: ${r.exactContests}`);
    console.log(`   excel candidates in paired contests: ${r.cands}  exact candidate matches: ${r.exactCands}`);
    console.log(`   issue counts: ${JSON.stringify(summarizeIssues(r.issues))}`);
    for (const i of r.issues) console.log("   - " + JSON.stringify(i));
  };
  console.log(`Election ${ELECTION}  (state header publishDate=${out.state.headerPublishDate} asOf=${out.state.headerAsOf}; db as_of sample=${out.state.dbAsOf.join(",")})`);
  print("STATE report vs DB scope=state", out.state);
  for (const c of out.counties) {
    if (c.error) console.log(`\n== county ${c.slug}: ${c.error}`);
    else print(`county ${c.slug} (local contests: ${c.excelLocal} of ${c.excelContestsTotal} in county report)`, c);
  }
  for (const m of out.multiCounty) {
    if (m.skipped) console.log(`\n== multi-county "${m.contest}" [${m.counties.join(",")}]: skipped (${m.skipped})`);
    else print(`multi-county "${m.contest}" summed over ${m.parts} county parts`, m);
  }
  console.log(`\nDB contests NOT covered by downloaded reports: ${out.notCoveredDb.contests} contests / ${out.notCoveredDb.options} options`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
