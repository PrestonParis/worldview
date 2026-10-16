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
// by another entity is left with that entity and returned as a conflict.
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
    const { rows: clashes } = await pg.query(
      `with input as (
         select * from unnest($1::uuid[], $2::text[], $3::text[]) as t(entity_id, scheme, value)
       ), inserted as (
         insert into entity_identifiers (entity_id, scheme, value)
         select distinct on (scheme, value) entity_id, scheme, value from input
         on conflict (scheme, value) do nothing
         returning scheme, value
       )
       select i.entity_id, i.scheme, i.value, x.entity_id as held_by
       from input i join entity_identifiers x using (scheme, value)
       where x.entity_id <> i.entity_id and (i.scheme, i.value) not in (select scheme, value from inserted)`,
      [batch.map((r) => r.entityId), batch.map((r) => r.scheme), batch.map((r) => String(r.value))],
    );
    conflicts.push(...clashes);
  }
  return conflicts;
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
