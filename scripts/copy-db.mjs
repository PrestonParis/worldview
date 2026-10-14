// Copies every row of the public schema from one database to another whose
// tables already exist (same schema). Tables are copied parents first so
// foreign keys hold; existing rows in the target are left alone (on
// conflict do nothing), so a stopped copy can simply be re-run.
//
// Usage:
//   node scripts/copy-db.mjs --from=.env.local --to=.env.cockroach
//   node scripts/copy-db.mjs --from=.env.cloud --to=.env.cockroach --only=profiles,quiz_sessions
//   node scripts/copy-db.mjs ... --skip=area_stats --batch=500

import { parseEnv } from "node:util";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { arg } from "./lib/bulk.mjs";

const urlFrom = (file) => {
  const url = parseEnv(readFileSync(file, "utf8")).DATABASE_URL;
  if (!url) throw new Error(`${file}: no DATABASE_URL`);
  return url;
};

const FROM = arg("from");
const TO = arg("to");
if (!FROM || !TO) throw new Error("usage: copy-db.mjs --from=<env file> --to=<env file>");
const ONLY = arg("only")?.split(",");
const SKIP = new Set(arg("skip", "").split(",").filter(Boolean));
const BATCH = Number(arg("batch", "500"));

const src = new Client({ connectionString: urlFrom(FROM) });
const dst = new Client({ connectionString: urlFrom(TO) });
await src.connect();
await dst.connect();

// Tables in dependency order: a table comes after every table it references.
const { rows: tables } = await src.query(
  "select tablename from pg_tables where schemaname = 'public' order by tablename",
);
const { rows: refs } = await src.query(`
  select c.conrelid::regclass::text as child, c.confrelid::regclass::text as parent
  from pg_constraint c join pg_namespace n on n.oid = c.connamespace
  where c.contype = 'f' and n.nspname = 'public' and c.conrelid <> c.confrelid`);
const unquote = (name) => name.replace(/^public\./, "").replace(/"/g, "");
const parents = new Map(tables.map((t) => [t.tablename, new Set()]));
for (const r of refs) parents.get(unquote(r.child))?.add(unquote(r.parent));
const ordered = [];
const visit = (name, seen = new Set()) => {
  if (ordered.includes(name) || seen.has(name)) return;
  seen.add(name);
  for (const p of parents.get(name) ?? []) visit(p, seen);
  ordered.push(name);
};
for (const t of tables) visit(t.tablename);

const quote = (name) => `"${name.replace(/"/g, '""')}"`;

// Columns that reference their own table (elections.prior_election_id):
// copied as null first, then filled in once every row exists.
const { rows: selfRefs } = await src.query(`
  select c.conrelid::regclass::text as tbl, a.attname as col
  from pg_constraint c
  join pg_namespace n on n.oid = c.connamespace
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
  where c.contype = 'f' and n.nspname = 'public' and c.conrelid = c.confrelid`);
const deferred = new Map();
for (const r of selfRefs) {
  const t = unquote(r.tbl);
  deferred.set(t, [...(deferred.get(t) ?? []), r.col]);
}
const primaryKey = async (table) =>
  (
    await src.query(
      `select a.attname from pg_index i
       join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
       where i.indrelid = $1::regclass and i.indisprimary`,
      [quote(table)],
    )
  ).rows.map((r) => r.attname);

for (const table of ordered) {
  if (ONLY && !ONLY.includes(table)) continue;
  if (SKIP.has(table)) continue;

  const { rows: cols } = await src.query(
    `select column_name, data_type from information_schema.columns
     where table_schema = 'public' and table_name = $1 and is_generated = 'NEVER'
     order by ordinal_position`,
    [table],
  );
  const names = cols.map((c) => c.column_name);
  // pg hands json columns back as objects; send them as JSON text.
  const isJson = cols.map((c) => c.data_type === "json" || c.data_type === "jsonb");
  const later = deferred.get(table) ?? [];
  const pk = later.length ? await primaryKey(table) : [];
  if (later.length && !pk.length) throw new Error(`${table}: self-referencing table needs a primary key`);
  const fills = [];
  const { rows: count } = await src.query(`select count(*)::int as n from ${quote(table)}`);
  const total = count[0].n;
  let copied = 0;
  const started = Date.now();

  // Keyset pagination on ctid keeps each read cheap on big tables.
  let after = "(0,0)";
  for (;;) {
    const { rows } = await src.query(
      `select ctid::text as __ctid, ${names.map(quote).join(", ")} from ${quote(table)}
       where ctid > $1::tid order by ctid limit ${BATCH}`,
      [after],
    );
    if (!rows.length) break;
    after = rows.at(-1).__ctid;
    const values = [];
    const tuples = rows.map((row) => {
      const slots = names.map((name, i) => {
        const v = later.includes(name) ? null : row[name];
        values.push(isJson[i] && v !== null ? JSON.stringify(v) : v);
        return `$${values.length}`;
      });
      return `(${slots.join(", ")})`;
    });
    for (const row of rows) {
      if (later.some((c) => row[c] !== null)) fills.push(row);
    }
    await dst.query(
      `insert into ${quote(table)} (${names.map(quote).join(", ")}) values ${tuples.join(", ")} on conflict do nothing`,
      values,
    );
    copied += rows.length;
    if (copied % (BATCH * 200) < BATCH) {
      console.log(`  ${table}: ${copied.toLocaleString()} / ${total.toLocaleString()}`);
    }
  }
  for (const row of fills) {
    const sets = later.map((c, i) => `${quote(c)} = $${i + 1}`);
    const where = pk.map((c, i) => `${quote(c)} = $${later.length + i + 1}`);
    await dst.query(`update ${quote(table)} set ${sets.join(", ")} where ${where.join(" and ")}`, [
      ...later.map((c) => row[c]),
      ...pk.map((c) => row[c]),
    ]);
  }
  console.log(`${table}: ${copied.toLocaleString()} rows (${((Date.now() - started) / 1000).toFixed(0)}s)`);
}

await src.end();
await dst.end();
