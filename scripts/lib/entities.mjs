// Shared entity-graph writes for the importers. Postgres holds the graph
// (supabase/sql/2026-10-16-entities.sql): entities, entity_identifiers (the
// ID crosswalk), entity_offices, and entity_edges. Neo4j is a copy rebuilt
// by scripts/sync-graph.mjs, so importers never write to it.

import { randomUUID } from "node:crypto";
import { chunk, upsertRows } from "./bulk.mjs";

// Neo4j node property -> crosswalk scheme. The graph copy writes the ids back
// under these property names, and the old importers read them there.
export const IDENTIFIER_PROPS = {
  bioguideId: "bioguide",
  openstatesId: "openstates",
  icpsrId: "icpsr",
  wikidataId: "wikidata",
  govtrackId: "govtrack",
  opensecretsId: "opensecrets",
  votesmartId: "votesmart",
  ballotpediaId: "ballotpedia",
  thomasId: "thomas",
  lisId: "lis",
  fecCandidateIds: "fec_candidate",
  fecCommitteeId: "fec_committee",
  committeeId: "congress_committee",
  ldaClientId: "lda_client",
  ldaRegistrantId: "lda_registrant",
};
export const PROP_FOR_SCHEME = Object.fromEntries(Object.entries(IDENTIFIER_PROPS).map(([p, s]) => [s, p]));

// Neo4j gov* properties <-> entity_offices columns (Open States).
export const OFFICE_PROPS = {
  govLevel: "level",
  govState: "state",
  govChamber: "chamber",
  govDistrict: "district",
  govOffice: "office",
  govParty: "party",
  govEmail: "email",
  govPhone: "phone",
};

export const ENTITY_TEXT_COLUMNS = [
  "description", "biography", "image_url", "website_url", "x_url", "facebook_url",
  "instagram_url", "youtube_url", "linkedin_url", "highlights", "metadata",
];

// external id -> entity id for one scheme ("bioguide", "icpsr", ...). FEC
// candidate ids are one row each, so a member with several maps from each.
export async function entityIdMap(pg, scheme, { type } = {}) {
  const { rows } = await pg.query(
    `select i.value, i.entity_id from entity_identifiers i
     ${type ? "join entities e on e.id = i.entity_id and e.type = $2" : ""}
     where i.scheme = $1`,
    type ? [scheme, type] : [scheme],
  );
  return new Map(rows.map((r) => [r.value, r.entity_id]));
}

// Inserts entities, or updates the given columns of existing ones. Each row
// needs `id` (pass randomUUID() for a new entity), `type`, `name`, and any of
// ENTITY_TEXT_COLUMNS; missing text columns are left alone on update and
// default to "" on insert.
export async function upsertEntities(pg, rows) {
  const columns = ["id", "type", "name", ...ENTITY_TEXT_COLUMNS.filter((c) => rows.some((r) => r[c] !== undefined))];
  const filled = rows.map((r) => Object.fromEntries(columns.map((c) => [c, r[c] ?? (ENTITY_TEXT_COLUMNS.includes(c) ? "" : r[c])])));
  return upsertRows(pg, "entities", columns, filled, ["id"]);
}

export function newEntity(fields) {
  return { id: randomUUID(), ...fields };
}

// Adds crosswalk ids: rows of { entityId, scheme, value }. An id already held
// by another entity stays with it, and an entity keeps its existing id in a
// one-per-person scheme; both come back as conflicts ({ held_by } or
// { existing }).
// With `replace`, each entity's other ids in the schemes given are removed
// first, so a source's current ids replace what it wrote before.
export async function addIdentifiers(pg, rows, { replace = false } = {}) {
  const conflicts = [];
  rows = rows.filter((r) => r.value !== undefined && r.value !== null && r.value !== "");
  if (replace && rows.length) {
    // One statement over every row, so an entity whose ids span batches
    // keeps all of them.
    await pg.query(
      `with input as (
         select * from unnest($1::uuid[], $2::text[], $3::text[]) as t(entity_id, scheme, value)
       )
       delete from entity_identifiers x
       using (select distinct entity_id, scheme from input) s
       where x.entity_id = s.entity_id and x.scheme = s.scheme
         and (x.scheme, x.value) not in (select scheme, value from input)`,
      [rows.map((r) => r.entityId), rows.map((r) => r.scheme), rows.map((r) => String(r.value))],
    );
  }
  for (const batch of chunk(rows, 1000)) {
    const params = [batch.map((r) => r.entityId), batch.map((r) => r.scheme), batch.map((r) => String(r.value))];
    // Either key can refuse a row: the id belongs to another entity, or the
    // entity already has a different id in a one-per-person scheme.
    await pg.query(
      `insert into entity_identifiers (entity_id, scheme, value)
       select distinct on (scheme, value) entity_id, scheme, value
       from unnest($1::uuid[], $2::text[], $3::text[]) as t(entity_id, scheme, value)
       on conflict do nothing`,
      params,
    );
    const { rows: refused } = await pg.query(
      `select i.entity_id, i.scheme, i.value, x.entity_id as held_by, own.value as existing
       from unnest($1::uuid[], $2::text[], $3::text[]) as i(entity_id, scheme, value)
       left join entity_identifiers x on x.scheme = i.scheme and x.value = i.value
       left join entity_identifiers own on own.entity_id = i.entity_id and own.scheme = i.scheme and own.value <> i.value
       where x.entity_id is distinct from i.entity_id`,
      params,
    );
    conflicts.push(...refused);
  }
  return conflicts;
}

export function describeConflict(c) {
  return c.held_by
    ? `${c.scheme} ${c.value} for ${c.entity_id} already belongs to ${c.held_by}`
    : `${c.entity_id} already has ${c.scheme} ${c.existing}, not ${c.value}`;
}

// Crosswalk rows for an object of Neo4j-style id properties
// ({ bioguideId: "P000197", fecCandidateIds: ["H8CA05035"] }).
export function identifierRows(entityId, props) {
  return Object.entries(IDENTIFIER_PROPS).flatMap(([prop, scheme]) => {
    const v = props[prop];
    if (v === undefined || v === null || v === "") return [];
    return (Array.isArray(v) ? v : [v]).map((value) => ({ entityId, scheme, value: String(value) }));
  });
}

// Upserts the office an entity holds according to `source`. Rows are
// { entity_id, level, state, chamber, district, office, party, email, phone }.
export async function upsertOffices(pg, source, rows) {
  const columns = ["entity_id", "source", "level", "state", "chamber", "district", "office", "party", "email", "phone"];
  return upsertRows(pg, "entity_offices", columns, rows.map((r) => ({ ...r, source })), ["entity_id", "source"]);
}

// Upserts edges keyed by `source_key`. Rows are { source_key,
// source_entity_id, target_entity_id, label, rel_type, role, valid_from,
// valid_to, notes }; omitted text columns are written as "". valid_from is
// kept from the first import so a seat's start date doesn't move.
export async function upsertEdges(pg, rows, { keepValidFrom = true } = {}) {
  let sent = 0;
  for (const batch of chunk(dedupe(rows, (r) => r.source_key), 500)) {
    const cols = ["source_key", "source_entity_id", "target_entity_id", "label", "rel_type", "role", "valid_from", "valid_to", "notes"];
    const params = [];
    const values = batch.map((r) => `(${cols.map((c) => {
      params.push(c === "source_key" || c.endsWith("_entity_id") ? r[c] : r[c] ?? "");
      return `$${params.length}`;
    }).join(", ")})`);
    const set = cols
      .filter((c) => c !== "source_key" && !(keepValidFrom && c === "valid_from"))
      .map((c) => `"${c}" = excluded."${c}"`);
    await pg.query(
      `insert into entity_edges as t (${cols.map((c) => `"${c}"`).join(", ")})
       values ${values.join(", ")}
       on conflict (source_key) where source_key is not null
       do update set ${set.join(", ")}, updated_at = now()
       where (${set.map((s) => `t.${s.split(" = ")[0]}`).join(", ")}) is distinct from (${set.map((s) => s.split(" = ")[1]).join(", ")})`,
      params,
    );
    sent += batch.length;
  }
  return sent;
}

function dedupe(rows, key) {
  return [...new Map(rows.map((r) => [key(r), r])).values()];
}

// Every column outside the graph tables that points at an entity
// (supabase/sql/2026-10-16-entity-foreign-keys.sql), with its constraint.
export const ENTITY_REFERENCES = [
  ["claims", "speaker_entity_id"],
  ["contributions", "donor_entity_id"],
  ["contributions", "recipient_entity_id"],
  ["candidate_finance", "entity_id"],
  ["bills", "sponsor_entity_id"],
  ["votes", "voter_entity_id"],
  ["bill_cosponsors", "entity_id"],
  ["lobbying_registrations", "client_entity_id"],
  ["lobbying_registrations", "registrant_entity_id"],
  ["candidacies", "candidate_entity_id"],
  ["member_ideology", "entity_id"],
  ["independent_expenditures", "spender_entity_id"],
  ["independent_expenditures", "candidate_entity_id"],
  ["case_votes", "justice_entity_id"],
].map(([table, column]) => ({ table, column, constraint: `${table}_${column}_fk` }));

// Crosswalk schemes a person or group holds at most one of. Two entities
// with different values in one of these are different people, whatever
// else they share.
const SINGLE_VALUED_SCHEMES = Object.values(IDENTIFIER_PROPS).filter(
  (scheme) => !["fec_candidate", "fec_committee", "lda_client", "lda_registrant"].includes(scheme),
);

// Rows of the merged entity that would duplicate one the kept entity
// already has under a unique key; they're dropped (and kept in the merge
// snapshot) before repointing.
const MERGE_DUPLICATES = [
  ["votes", `from votes k where t.voter_entity_id = $1 and k.voter_entity_id = $2
     and t.roll_call_id is not null and t.roll_call_id = k.roll_call_id`],
  ["votes", `from votes k where t.voter_entity_id = $1 and k.voter_entity_id = $2
     and t.roll_call_id is null and k.roll_call_id is null and t.bill_id = k.bill_id`],
  ["bill_cosponsors", "from bill_cosponsors k where t.entity_id = $1 and k.entity_id = $2 and t.bill_id = k.bill_id"],
  ["candidacies", "from candidacies k where t.candidate_entity_id = $1 and k.candidate_entity_id = $2 and t.election_id = k.election_id"],
  ["entity_offices", "from entity_offices k where t.entity_id = $1 and k.entity_id = $2 and t.source = k.source"],
];

async function ids(pg, sql, params) {
  return (await pg.query(sql, params)).rows.map((r) => r.id);
}

// Folds entity `mergedId` into `intoId` in one transaction: every reference
// and relationship moves over, its crosswalk ids and offices follow, blank
// profile fields on the kept entity are filled from it, and it's deleted.
// Refused when the two hold different ids in a one-per-person scheme
// (Bioguide, ICPSR, Open States, ...). entity_merges records the merge with
// a snapshot of everything it changed, so unmergeEntity can reverse it.
export async function mergeEntity(pg, mergedId, intoId, reason) {
  if (mergedId === intoId) throw new Error("Can't merge an entity into itself");
  await pg.query("begin");
  try {
    const { rows } = await pg.query("select * from entities where id = any($1::uuid[])", [[mergedId, intoId]]);
    const merged = rows.find((r) => r.id === mergedId);
    const into = rows.find((r) => r.id === intoId);
    if (!merged || !into) throw new Error(`Both entities must exist (${mergedId} -> ${intoId})`);
    const { rows: clashes } = await pg.query(
      `select a.scheme, a.value as merged_value, b.value as into_value
       from entity_identifiers a join entity_identifiers b on b.scheme = a.scheme and b.entity_id = $2
       where a.entity_id = $1 and a.scheme = any($3::text[]) and a.value <> b.value`,
      [mergedId, intoId, SINGLE_VALUED_SCHEMES],
    );
    if (clashes.length) {
      const c = clashes[0];
      throw new Error(`Different people: ${c.scheme} ${c.merged_value} vs ${c.into_value}`);
    }

    const snapshot = { into: Object.fromEntries(ENTITY_TEXT_COLUMNS.map((c) => [c, into[c]])), refs: {}, deleted: {} };
    for (const [table, where] of MERGE_DUPLICATES) {
      const { rows: dropped } = await pg.query(`delete from ${table} t using ${where.replace(/^from /, "")} returning t.*`, [mergedId, intoId]);
      if (dropped.length) (snapshot.deleted[table] ??= []).push(...dropped);
    }
    for (const { table, column } of ENTITY_REFERENCES) {
      const moved = await ids(pg, `update ${table} set ${column} = $2 where ${column} = $1 returning id`, [mergedId, intoId]);
      if (moved.length) snapshot.refs[`${table}.${column}`] = moved;
    }
    snapshot.polls = (await pg.query("update poll_results set entity_id = $2 where entity_id = $1 returning poll_id, choice", [mergedId, intoId])).rows;
    snapshot.identifiers = (await pg.query("update entity_identifiers set entity_id = $2 where entity_id = $1 returning scheme, value", [mergedId, intoId])).rows;
    snapshot.offices = (await pg.query("update entity_offices set entity_id = $2 where entity_id = $1 returning source", [mergedId, intoId])).rows.map((r) => r.source);
    // Edges between the two would become self-loops.
    const { rows: loops } = await pg.query(
      `delete from entity_edges where (source_entity_id = $1 and target_entity_id = $2)
         or (source_entity_id = $2 and target_entity_id = $1) returning *`,
      [mergedId, intoId],
    );
    snapshot.edgeSources = await ids(pg, "update entity_edges set source_entity_id = $2, updated_at = now() where source_entity_id = $1 returning id", [mergedId, intoId]);
    snapshot.edgeTargets = await ids(pg, "update entity_edges set target_entity_id = $2, updated_at = now() where target_entity_id = $1 returning id", [mergedId, intoId]);
    // The same relationship imported for both: keep the oldest.
    const { rows: twins } = await pg.query(
      `delete from entity_edges e using entity_edges o
       where e.id = any($1::uuid[])
         and o.source_entity_id = e.source_entity_id and o.target_entity_id = e.target_entity_id
         and o.rel_type = e.rel_type and o.role = e.role and o.created_at < e.created_at
       returning e.*`,
      [[...snapshot.edgeSources, ...snapshot.edgeTargets]],
    );
    snapshot.deleted.entity_edges = [...loops, ...twins];

    const fill = ENTITY_TEXT_COLUMNS.filter((c) => c !== "metadata" && !into[c] && merged[c]);
    if (fill.length) {
      await pg.query(
        `update entities set ${fill.map((c, i) => `${c} = $${i + 2}`).join(", ")}, updated_at = now() where id = $1`,
        [intoId, ...fill.map((c) => merged[c])],
      );
    }
    snapshot.mergesInto = await pg.query("update entity_merges set into_id = $2 where into_id = $1 returning merged_id", [mergedId, intoId])
      .then((r) => r.rows.map((m) => m.merged_id));
    snapshot.merged = merged;
    await pg.query(
      `insert into entity_merges (merged_id, into_id, merged_name, reason, snapshot) values ($1, $2, $3, $4, $5)
       on conflict (merged_id) do update set into_id = excluded.into_id, reason = excluded.reason, snapshot = excluded.snapshot`,
      [mergedId, intoId, merged.name, reason, JSON.stringify(snapshot)],
    );
    await pg.query("delete from entities where id = $1", [mergedId]);
    await pg.query("commit");
  } catch (err) {
    await pg.query("rollback");
    throw err;
  }
}

// Reverses mergeEntity from its snapshot: the merged entity comes back with
// its id, and every row, id, office, and relationship the merge moved or
// dropped returns to it.
export async function unmergeEntity(pg, mergedId) {
  const { rows } = await pg.query("select into_id, snapshot from entity_merges where merged_id = $1", [mergedId]);
  if (!rows.length) throw new Error(`No merge recorded for ${mergedId}`);
  const intoId = rows[0].into_id;
  const snap = rows[0].snapshot;
  if (!snap?.merged) throw new Error(`The merge of ${mergedId} has no snapshot to undo`);
  await pg.query("begin");
  try {
    const m = snap.merged;
    const cols = Object.keys(m);
    await pg.query(
      `insert into entities (${cols.join(", ")}) select ${cols.join(", ")} from jsonb_populate_record(null::entities, $1)`,
      [JSON.stringify(m)],
    );
    await pg.query(
      `update entities set ${ENTITY_TEXT_COLUMNS.map((c, i) => `${c} = $${i + 2}`).join(", ")}, updated_at = now() where id = $1`,
      [intoId, ...ENTITY_TEXT_COLUMNS.map((c) => snap.into[c])],
    );
    for (const [key, moved] of Object.entries(snap.refs)) {
      const [table, column] = key.split(".");
      await pg.query(`update ${table} set ${column} = $1 where id = any($2::uuid[])`, [mergedId, moved]);
    }
    for (const r of snap.polls ?? []) await pg.query("update poll_results set entity_id = $1 where poll_id = $2 and choice = $3", [mergedId, r.poll_id, r.choice]);
    for (const r of snap.identifiers ?? []) await pg.query("update entity_identifiers set entity_id = $1 where scheme = $2 and value = $3", [mergedId, r.scheme, r.value]);
    if (snap.offices?.length) await pg.query("update entity_offices set entity_id = $1 where entity_id = $2 and source = any($3::text[])", [mergedId, intoId, snap.offices]);
    await pg.query("update entity_edges set source_entity_id = $1 where id = any($2::uuid[])", [mergedId, snap.edgeSources ?? []]);
    await pg.query("update entity_edges set target_entity_id = $1 where id = any($2::uuid[])", [mergedId, snap.edgeTargets ?? []]);
    for (const [table, deleted] of Object.entries(snap.deleted ?? {})) {
      for (const row of deleted) {
        await pg.query(`insert into ${table} select * from jsonb_populate_record(null::${table}, $1) on conflict do nothing`, [JSON.stringify(row)]);
      }
    }
    if (snap.mergesInto?.length) await pg.query("update entity_merges set into_id = $1 where merged_id = any($2::uuid[])", [mergedId, snap.mergesInto]);
    await pg.query("delete from entity_merges where merged_id = $1", [mergedId]);
    await pg.query("commit");
  } catch (err) {
    await pg.query("rollback");
    throw err;
  }
}
