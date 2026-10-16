// One-time copy of the People & Power graph from Neo4j into Postgres
// (supabase/sql/2026-10-16-entities.sql). After it runs, Postgres is the
// record and Neo4j is rebuilt from it by scripts/sync-graph.mjs.
//
// Entity and edge ids are kept, so every *_entity_id column elsewhere still
// points at the same entity. Safe to re-run: rows are upserted by id.
//
// Usage:
//   node scripts/graph-to-postgres.mjs                      # .env.local
//   ENV_FILE=.env.cloud node scripts/graph-to-postgres.mjs  # cloud
//   ... --dry-run                                           # read and report only

import { connectNeo4j, connectPg, flag, loadEnv, upsertRows } from "./lib/bulk.mjs";
import { addIdentifiers, ENTITY_TEXT_COLUMNS, identifierRows, OFFICE_PROPS, upsertOffices } from "./lib/entities.mjs";

const DRY = flag("dry-run");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TEXT_PROPS = {
  description: "description", biography: "biography", image_url: "imageUrl", website_url: "websiteUrl",
  x_url: "xUrl", facebook_url: "facebookUrl", instagram_url: "instagramUrl", youtube_url: "youtubeUrl",
  linkedin_url: "linkedinUrl", highlights: "highlights", metadata: "metadata",
};

// Neo4j datetimes print with nanoseconds and sometimes a zone name.
function timestamp(v) {
  if (v === null || v === undefined || v === "") return new Date().toISOString();
  return String(v).replace(/\[.*\]$/, "").replace(/(\.\d{6})\d+/, "$1");
}

const text = (v) => (v === null || v === undefined ? "" : String(v));

loadEnv();
const driver = connectNeo4j();
const pg = await connectPg();
const session = driver.session();
try {
  const nodes = (await session.run("MATCH (e:Entity) RETURN properties(e) AS p")).records.map((r) => r.get("p"));
  const rels = (
    await session.run("MATCH (a:Entity)-[r:RELATED_TO]->(b:Entity) RETURN properties(r) AS p, a.id AS source, b.id AS target")
  ).records.map((r) => ({ ...r.get("p"), source: r.get("source"), target: r.get("target") }));
  console.log(`neo4j: ${nodes.length} entities, ${rels.length} edges`);

  const entityRows = nodes.map((p) => ({
    id: p.id,
    type: p.type,
    name: text(p.name),
    ...Object.fromEntries(ENTITY_TEXT_COLUMNS.map((c) => [c, text(p[TEXT_PROPS[c]])])),
    created_at: timestamp(p.createdAt),
    updated_at: timestamp(p.updatedAt),
  }));
  const ids = new Set(entityRows.map((e) => e.id));

  // FEC importers kept candidate and committee ids in metadata JSON; those
  // join the crosswalk too.
  const fromMetadata = (p) => {
    try {
      const m = JSON.parse(p.metadata || "{}");
      return identifierRows(p.id, {
        fecCandidateIds: p.type === "politician" && typeof m.fecCandidateId === "string" ? [m.fecCandidateId] : undefined,
        fecCommitteeId: p.type !== "politician" && typeof m.fecCommitteeId === "string" ? m.fecCommitteeId : undefined,
      });
    } catch {
      return [];
    }
  };
  const identifiers = nodes.flatMap((p) => [...identifierRows(p.id, p), ...fromMetadata(p)]);
  const offices = nodes
    .filter((p) => p.govLevel)
    .map((p) => ({
      entity_id: p.id,
      ...Object.fromEntries(Object.entries(OFFICE_PROPS).map(([prop, col]) => [col, p[prop] ?? null])),
    }));

  const { rows: sourceRows } = await pg.query("select id from sources");
  const sourceIds = new Set(sourceRows.map((r) => r.id));
  const seenKeys = new Set();
  let duplicateKeys = 0;
  const edgeRows = rels.map((r) => {
    let key = r.sourceKey ?? (r.pairKey ? `fec-pair:${r.pairKey}` : null);
    if (key && seenKeys.has(key)) {
      duplicateKeys++;
      key = null;
    }
    if (key) seenKeys.add(key);
    return {
      id: r.id,
      source_entity_id: r.source,
      target_entity_id: r.target,
      label: text(r.label) || text(r.relType) || "related to",
      rel_type: text(r.relType),
      role: text(r.role),
      valid_from: text(r.validFrom),
      valid_to: text(r.validTo),
      notes: text(r.notes),
      source_record_id: UUID.test(text(r.sourceRecordId)) && sourceIds.has(r.sourceRecordId) ? r.sourceRecordId : null,
      source_key: key,
      created_at: timestamp(r.createdAt),
      updated_at: timestamp(r.updatedAt),
    };
  });
  const selfLoops = edgeRows.filter((e) => e.source_entity_id === e.target_entity_id).length;
  const validEdges = edgeRows.filter((e) => e.source_entity_id !== e.target_entity_id && ids.has(e.source_entity_id) && ids.has(e.target_entity_id));

  console.log(`identifiers: ${identifiers.length}, offices: ${offices.length}`);
  console.log(`edges: ${validEdges.length} valid, ${selfLoops} self-loops skipped, ${duplicateKeys} duplicate source keys cleared`);
  if (DRY) {
    console.log("dry run: nothing written");
  } else {
    const entityCols = ["id", "type", "name", ...ENTITY_TEXT_COLUMNS, "created_at", "updated_at"];
    // created_at/updated_at come from the graph, so don't let the upsert stamp now().
    await upsertRows(pg, "entities", entityCols, entityRows, ["id"], { touchUpdatedAt: false });
    const conflicts = await addIdentifiers(pg, identifiers);
    await upsertOffices(pg, "openstates", offices);
    const edgeCols = ["id", "source_entity_id", "target_entity_id", "label", "rel_type", "role", "valid_from", "valid_to", "notes", "source_record_id", "source_key", "created_at", "updated_at"];
    await upsertRows(pg, "entity_edges", edgeCols, validEdges, ["id"], { touchUpdatedAt: false });

    for (const c of conflicts) console.log(`  identifier ${c.scheme}=${c.value} on ${c.entity_id} already belongs to ${c.held_by}`);
    const counts = await pg.query(
      `select (select count(*) from entities)::int as entities, (select count(*) from entity_edges)::int as edges,
              (select count(*) from entity_identifiers)::int as identifiers, (select count(*) from entity_offices)::int as offices`,
    );
    console.log("postgres:", counts.rows[0], `(${conflicts.length} identifier conflicts)`);
  }
} finally {
  await session.close();
  await driver.close();
  await pg.end();
}
