// Builds the state-law and research files behind /guns' Policy Explorer and
// Policy Research workspaces, into public/data/guns/:
//
//   laws.json          every state's category for each policy in
//                      src/lib/guns/policies.ts, from the laws in force at the
//                      end of the RAND State Firearm Law Database
//   states/<ST>.json   every RAND record for the state (and the federal rows
//                      RAND repeats per state): subtype, dates, statutory
//                      citation, quoted statute text, notes
//   studies.json       the study-level effect estimates (incidence rate ratios
//                      with 95% intervals and RAND's quality rating) behind the
//                      forest plots in The Science of Gun Policy, 5th ed.,
//                      Appendix B
//
// The RAND database is published under the Open Database License; the page
// credits RAND and links the source. Downloads are cached in .cache/guns.
//
// Usage: node scripts/build-guns.mjs

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fetchRetry } from "./lib/bulk.mjs";
import { readXlsx } from "./lib/xlsx.mjs";
import { POLICIES, covers, inForce, isFederal } from "../src/lib/guns/policies.ts";

const CACHE = ".cache/guns";
const OUT = "public/data/guns";
const RAND = "https://www.rand.org/content/dam/rand/pubs";
const FILES = {
  laws: {
    url: `${RAND}/tools/TLA200/TLA243-2-v4/RAND_TLA243-2-v4.database.zip`,
    sheet: "TL-A243-2-v4 State Firearm Law Database 6.0.xlsx",
  },
  studies: {
    url: `${RAND}/research_reports/RRA4300/RRA4360-2/RAND_RRA4360-2-AppendixB.zip`,
    sheet: "RR-A4360-2-AppendixB.xlsx",
  },
};
// RAND's CDN refuses short user agents.
const BROWSER = {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  },
};
// Statute text and notes are trimmed; the citation leads to the full law.
const CONTENT_MAX = 1600;
const NOTES_MAX = 700;

async function workbook({ url, sheet }) {
  fs.mkdirSync(CACHE, { recursive: true });
  const zip = path.join(CACHE, path.basename(url));
  if (!fs.existsSync(zip)) {
    const res = await fetchRetry(url, { ...BROWSER, timeoutMs: 300_000 }, { label: path.basename(url) });
    fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  }
  return readXlsx(execFileSync("unzip", ["-p", zip, sheet], { maxBuffer: 64 * 1024 * 1024 }));
}

const clip = (s, n) => {
  const t = String(s ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n).replace(/\s+\S*$/, "")}…` : t;
};
const pad = (n) => String(n).padStart(2, "0");
const date = (y, m, d) => (y ? `${y}-${pad(m || 1)}-${pad(d || 1)}` : null);
const numOrNull = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

async function buildLaws() {
  const book = await workbook(FILES.laws);
  const [header, ...rows] = book.Database;
  const col = Object.fromEntries(header.map((h, i) => [h, i]));
  const at = (r, h) => r[col[h]];
  const version = book.AboutThisFile.flat().find((c) => /^Version/.test(c ?? "")) ?? "";

  const byState = {};
  for (const r of rows) {
    const st = at(r, "State Postal Abbreviation");
    if (!st) continue;
    const s = (byState[st] ??= { name: at(r, "State"), records: [] });
    s.records.push({
      id: at(r, "Law ID"),
      cls: Number(at(r, "Law Class (num)")),
      subtype: String(at(r, "Law Class Subtype") ?? "").trim(),
      guns: at(r, "Handguns or Long Guns") ?? "",
      effect: at(r, "Effect"),
      change: at(r, "Type of Change"),
      start: date(at(r, "Effective Date Year"), at(r, "Effective Date Month"), at(r, "Effective Date Day")),
      end: date(at(r, "Supersession Date Year"), at(r, "Supersession Date Month"), at(r, "Supersession Date Day")),
      dateNote: at(r, "Effective Date Note") || null,
      citation: clip(at(r, "Statutory Citation"), 300),
      content: clip(at(r, "Content"), CONTENT_MAX),
      notes: clip(at(r, "Additional Context and Notes"), NOTES_MAX),
      age: numOrNull(at(r, "Age for Minimum Age Laws")),
      wait: numOrNull(at(r, "Length of Waiting Period (days, handguns)")),
    });
  }

  fs.mkdirSync(path.join(OUT, "states"), { recursive: true });
  const policies = {};
  for (const [st, s] of Object.entries(byState)) {
    s.records.sort((a, b) => a.cls - b.cls || (a.start ?? "").localeCompare(b.start ?? ""));
    fs.writeFileSync(path.join(OUT, "states", `${st}.json`), JSON.stringify({ state: st, name: s.name, records: s.records }));
    for (const p of POLICIES) {
      const live = s.records.filter((r) => covers(p, r) && inForce(r) && !isFederal(r));
      // Year the state's current regime began: the latest in-force start.
      const since = live.reduce((y, r) => (r.start && r.start > y ? r.start : y), "");
      (policies[p.id] ??= {})[st] = [p.categorize(live), since ? Number(since.slice(0, 4)) : null, p.detail?.(live) ?? null];
    }
  }
  const out = {
    source: {
      label: `RAND State Firearm Law Database, ${version.replace(/,.*/, "")}`,
      href: "https://www.rand.org/pubs/tools/TLA243-2-v4.html",
      through: "September 2025",
    },
    policies,
  };
  fs.writeFileSync(path.join(OUT, "laws.json"), JSON.stringify(out));

  for (const p of POLICIES) {
    const counts = p.categories.map((c, i) => `${c}: ${Object.values(policies[p.id]).filter((v) => v[0] === i).length}`);
    console.log(`${p.id.padEnd(20)} ${counts.join(" · ")}`);
  }
  console.log(`laws: ${rows.length} records, ${Object.keys(byState).length} jurisdictions`);
}

async function buildStudies() {
  const book = await workbook(FILES.studies);
  const [, header, ...rows] = book.Figures;
  // The Figures tab repeats "Policy" and "Outcome": the first pair are codes,
  // the second the study's own description.
  const studies = rows
    .filter((r) => r[0] && typeof r[8] === "number")
    .map((r) => ({
      id: String(r[0]),
      code: String(r[1]).trim(),
      outcome: String(r[2]).trim(),
      study: String(r[4]).trim(),
      policy: clip(r[5], 240),
      measure: clip(r[6], 80),
      subgroup: clip(r[7], 120),
      irr: r[8],
      lo: r[9],
      hi: r[10],
      p: numOrNull(r[11]),
      quality: String(r[16]).trim(),
      figure: String(r[3]),
    }));
  if (header[8] !== "IRR Estimate" || header[16] !== "Overall") throw new Error(`Appendix B columns moved: ${header.join(" | ")}`);
  fs.writeFileSync(path.join(OUT, "studies.json"), JSON.stringify(studies));
  console.log(`studies: ${studies.length} estimates from ${new Set(studies.map((s) => s.study)).size} studies`);
}

await buildLaws();
await buildStudies();
