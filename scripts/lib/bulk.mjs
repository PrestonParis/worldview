// Shared plumbing for the bulk public-data importers (Voteview, Open States,
// ACS, Federal Register, USAspending, FEC Schedule E, SCDB, ...): env
// loading, retrying fetch, a small RFC-4180 CSV parser, batched upserts, and
// sync_runs bookkeeping. Pure helpers (parseCsv, chunk) are unit-tested in
// bulk.test.mjs.

import { Client } from "pg";
import neo4j from "neo4j-driver";

// ENV_FILE=.env.cloud targets cloud without swapping .env.local.
export function loadEnv() {
  process.loadEnvFile(process.env.ENV_FILE || ".env.local");
}

export const arg = (name, def) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
export const flag = (name) => process.argv.includes(`--${name}`);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchRetry(url, init = {}, { attempts = 6, label = url } = {}) {
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        ...init,
        headers: { "User-Agent": "worldview-data-import/1.0", ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(init.timeoutMs ?? 120_000),
      });
    } catch (err) {
      if (attempt >= attempts) throw err;
      await sleep(2000 * attempt);
      continue;
    }
    if (res.ok) return res;
    if ([429, 500, 502, 503, 504].includes(res.status) && attempt < attempts) {
      const wait = res.status === 429 ? 30_000 * attempt : 3000 * attempt;
      console.log(`    ${res.status} on ${label} — retrying in ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    throw new Error(`${label} -> ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
}

export async function fetchJson(url, init, opts) {
  return (await fetchRetry(url, init, opts)).json();
}

// RFC-4180 CSV -> array of objects keyed by the header row.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.length > 1 || r[0] !== "");
  if (!header) return [];
  const keys = header.map((h) => h.replace(/^﻿/, "").trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ""])));
}

export function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
export const int = (v) => {
  const n = num(v);
  return n === null ? null : Math.trunc(n);
};
export const str = (v) => (v === null || v === undefined || v === "" ? null : String(v));

export async function connectPg() {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  return pg;
}

export function connectNeo4j() {
  return neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
  );
}

// INSERT ... ON CONFLICT (conflict) DO UPDATE in batches. `rows` are objects
// keyed by column name; every column in `columns` is written. Returns the
// number of rows sent.
export async function upsertRows(pg, table, columns, rows, conflict, { batchSize = 500, touchUpdatedAt = true } = {}) {
  const update = columns.filter((c) => !conflict.includes(c));
  const set = [
    ...update.map((c) => `"${c}" = excluded."${c}"`),
    ...(touchUpdatedAt ? ['"updated_at" = now()'] : []),
  ].join(", ");
  // Postgres rejects an upsert that touches the same key twice in one
  // statement, and sources do repeat records (overlapping API pages, a
  // document listed under two types) — keep the last occurrence.
  const unique = [...new Map(rows.map((r) => [conflict.map((c) => String(r[c])).join("\u0000"), r])).values()];
  let sent = 0;
  for (const batch of chunk(unique, batchSize)) {
    const params = [];
    const values = batch.map((row) => {
      const ph = columns.map((c) => {
        const v = row[c];
        params.push(v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v ?? null);
        return `$${params.length}`;
      });
      return `(${ph.join(", ")})`;
    });
    await pg.query(
      `insert into ${table} (${columns.map((c) => `"${c}"`).join(", ")})
       values ${values.join(", ")}
       on conflict (${conflict.map((c) => `"${c}"`).join(", ")})
       do ${set ? `update set ${set}` : "nothing"}`,
      params,
    );
    sent += batch.length;
  }
  return sent;
}

export async function startRun(pg, source) {
  const r = await pg.query(
    "insert into sync_runs (source, status) values ($1, 'partial') returning id",
    [source],
  );
  return r.rows[0].id;
}

export async function finishRun(pg, id, { status = "ok", inserted = 0, updated = 0, skipped = 0, error = null, cursor = null } = {}) {
  await pg.query(
    `update sync_runs set finished_at = now(), status = $2, rows_inserted = $3,
       rows_updated = $4, rows_skipped = $5, error = $6, cursor = coalesce($7, cursor)
     where id = $1`,
    [id, status, inserted, updated, skipped, error, cursor],
  );
}

// Map of a crosswalk property -> entity id, for resolving imported rows.
export async function entityIdMap(driver, prop, where = "") {
  const session = driver.session();
  try {
    const res = await session.run(
      `MATCH (e:Entity) WHERE e.${prop} IS NOT NULL ${where} RETURN e.${prop} AS key, e.id AS id`,
    );
    const map = new Map();
    for (const r of res.records) {
      const key = r.get("key");
      for (const k of Array.isArray(key) ? key : [key]) map.set(String(k), r.get("id"));
    }
    return map;
  } finally {
    await session.close();
  }
}

// Runs an importer's main with uniform error handling + sync_runs bookkeeping.
export async function runImport(source, main) {
  loadEnv();
  const pg = await connectPg();
  const runId = await startRun(pg, source);
  try {
    const result = (await main(pg)) ?? {};
    await finishRun(pg, runId, result);
    console.log(`\n${source}: ok`, JSON.stringify(result));
  } catch (err) {
    await finishRun(pg, runId, { status: "error", error: String(err?.stack ?? err).slice(0, 4000) });
    console.error(err);
    process.exitCode = 1;
  } finally {
    await pg.end();
  }
}

// USPS state abbreviation -> 2-digit state FIPS, so every importer keys
// state rows by FIPS (the same geoid ACS and the county map use).
export const STATE_FIPS = {
  AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09", DE: "10",
  DC: "11", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17", IN: "18", IA: "19",
  KS: "20", KY: "21", LA: "22", ME: "23", MD: "24", MA: "25", MI: "26", MN: "27",
  MS: "28", MO: "29", MT: "30", NE: "31", NV: "32", NH: "33", NJ: "34", NM: "35",
  NY: "36", NC: "37", ND: "38", OH: "39", OK: "40", OR: "41", PA: "42", RI: "44",
  SC: "45", SD: "46", TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53",
  WV: "54", WI: "55", WY: "56", AS: "60", GU: "66", MP: "69", PR: "72", VI: "78",
};
export const STATE_NAME_TO_ABBR = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", "District of Columbia": "DC",
  Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN",
  Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO",
  Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
  Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI",
  "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT",
  Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI",
  Wyoming: "WY", "Puerto Rico": "PR", Guam: "GU", "U.S. Virgin Islands": "VI",
  "American Samoa": "AS", "Northern Mariana Islands": "MP",
};
