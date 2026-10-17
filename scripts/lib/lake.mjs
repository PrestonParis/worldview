// The data lake (supabase/sql/2026-10-16-data-lake.sql): files in Supabase
// Storage, outside the database's size cap.
//   raw   private. Every source file an importer chooses to keep, by
//         content hash, so a past import can be replayed or audited.
//   lake  public. Parquet extracts of datasets and record tables for bulk
//         download and DuckDB/pandas/R users, and the home for detail too
//         large for Postgres (Postgres keeps the aggregates pages read).
// source_snapshots and lake_files catalog them.

import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fetchRetry } from "./bulk.mjs";

// Supabase's free plan refuses single uploads over 50 MB.
const MAX_UPLOAD_BYTES = Number(process.env.STORAGE_MAX_UPLOAD_MB || 50) * 1024 * 1024;

function storage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed for Storage");
  return { base: `${url}/storage/v1`, headers: { Authorization: `Bearer ${key}`, apikey: key } };
}

export const sha256 = (body) => createHash("sha256").update(body).digest("hex");

export async function upload(bucket, objectPath, body, contentType = "application/octet-stream") {
  if (body.length > MAX_UPLOAD_BYTES) {
    throw new Error(`${objectPath} is ${(body.length / 1048576).toFixed(1)} MB; uploads are capped at ${MAX_UPLOAD_BYTES / 1048576} MB`);
  }
  const { base, headers } = storage();
  const res = await fetch(`${base}/object/${bucket}/${objectPath}`, {
    method: "POST",
    headers: { ...headers, "content-type": contentType, "x-upsert": "true", "cache-control": "3600" },
    body,
  });
  if (!res.ok) throw new Error(`upload ${bucket}/${objectPath} -> ${res.status} ${(await res.text()).slice(0, 300)}`);
}

// Public download URL of a file in the `lake` bucket.
export function lakeUrl(objectPath) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/lake/${objectPath}`;
}

// Keeps a copy of a downloaded source file in `raw` (once per distinct
// content) and records it in source_snapshots. Skipped, with a warning, when
// Storage credentials aren't configured, so an import never fails for it.
let warnedNoStorage = false;
export async function archiveRaw(pg, source, url, body, contentType = null) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    if (!warnedNoStorage) console.warn("archiveRaw: Storage credentials not set; source files are not archived");
    warnedNoStorage = true;
    return null;
  }
  const hash = sha256(body);
  const { rows } = await pg.query(
    "select storage_path from source_snapshots where source = $1 and url = $2 and sha256 = $3",
    [source, url, hash],
  );
  if (rows.length) return { sha256: hash, path: rows[0].storage_path, reused: true };
  const name = path.basename(new URL(url).pathname) || "index";
  const objectPath = `${source}/${new Date().toISOString().slice(0, 10)}/${hash.slice(0, 12)}-${name}`;
  await upload("raw", objectPath, body, contentType ?? "application/octet-stream");
  await pg.query(
    `insert into source_snapshots (source, url, sha256, bytes, content_type, storage_path)
     values ($1, $2, $3, $4, $5, $6) on conflict do nothing`,
    [source, url, hash, body.length, contentType, objectPath],
  );
  return { sha256: hash, path: objectPath, reused: false };
}

// fetchRetry that also archives the response body; returns it as a Buffer.
export async function fetchArchived(pg, source, url, init = {}, opts = {}) {
  const res = await fetchRetry(url, init, opts);
  const body = Buffer.from(await res.arrayBuffer());
  await archiveRaw(pg, source, String(url), body, res.headers.get("content-type"));
  return body;
}

// One DuckDB connection per process, with each Postgres database attached
// once (read-only). Call closeLake() when done.
let duck = null;
const attached = new Map();

async function duckdb() {
  if (!duck) {
    const { DuckDBInstance } = await import("@duckdb/node-api");
    const instance = await DuckDBInstance.create(":memory:");
    const connection = await instance.connect();
    await connection.run("INSTALL postgres; LOAD postgres;");
    duck = { instance, connection };
  }
  return duck.connection;
}

// Attaches a Postgres database to DuckDB and returns the name to query it
// by: `${await attach(url)}.public.bills`.
export async function attach(url) {
  if (attached.has(url)) return attached.get(url);
  const name = `pg${attached.size}`;
  await (await duckdb()).run(`ATTACH '${url.replaceAll("'", "''")}' AS ${name} (TYPE postgres, READ_ONLY)`);
  attached.set(url, name);
  return name;
}

export async function closeLake() {
  if (!duck) return;
  for (const name of attached.values()) await duck.connection.run(`DETACH ${name}`);
  attached.clear();
  duck.connection.closeSync();
  duck.instance.closeSync();
  duck = null;
}

// Writes the result of a DuckDB `query` (read attached databases through
// attach()) to Parquet (zstd) and publishes it at lake/<objectPath> unless an
// identical file is already there. Records it in lake_files.
export async function exportParquet(pg, { source, objectPath, query }) {
  const db = await duckdb();
  const dir = mkdtempSync(path.join(tmpdir(), "lake-"));
  const file = path.join(dir, "out.parquet");
  try {
    await db.run(`COPY (${query}) TO '${file}' (FORMAT parquet, COMPRESSION zstd, ROW_GROUP_SIZE 100000)`);
    const meta = await db.runAndReadAll(`SELECT count(*)::BIGINT AS n FROM '${file}'`);
    const rows = Number(meta.getRowObjects()[0].n);
    if (rows === 0) {
      await pg.query("delete from lake_files where path = $1", [objectPath]);
      return { path: objectPath, rows, bytes: 0, changed: false, empty: true };
    }
    const described = await db.runAndReadAll(`DESCRIBE SELECT * FROM '${file}'`);
    const columns = described.getRowObjects().map((c) => ({ name: c.column_name, type: c.column_type }));
    const body = readFileSync(file);
    const hash = sha256(body);

    const { rows: current } = await pg.query("select sha256 from lake_files where path = $1", [objectPath]);
    const changed = current[0]?.sha256 !== hash;
    if (changed) await upload("lake", objectPath, body, "application/vnd.apache.parquet");
    await pg.query(
      `insert into lake_files (path, source, rows, bytes, columns, sha256, built_at)
       values ($1, $2, $3, $4, $5, $6, now())
       on conflict (path) do update set source = excluded.source, rows = excluded.rows, bytes = excluded.bytes,
         columns = excluded.columns, sha256 = excluded.sha256,
         built_at = case when lake_files.sha256 = excluded.sha256 then lake_files.built_at else now() end`,
      [objectPath, source, rows, body.length, JSON.stringify(columns), hash],
    );
    return { path: objectPath, rows, bytes: body.length, changed };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
