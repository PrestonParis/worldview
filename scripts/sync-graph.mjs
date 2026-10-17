// Rebuilds the Neo4j copy of the People & Power graph from Postgres, which
// is the record (supabase/sql/2026-10-16-entities.sql). Neo4j serves path
// and network queries; nothing writes to it except this script.
//
// Nodes keep the property shape the graph had before the move: entity
// fields in camelCase, crosswalk ids as bioguideId / icpsrId / ...
// (scripts/lib/entities.mjs), and Open States offices as gov* properties.
// Entities and edges no longer in Postgres are deleted.
//
// Scheduled daily by .github/workflows/sync-graph.yml, which also keeps Aura
// Free from pausing (it pauses after 3 idle days).
//
// Usage:
//   node scripts/sync-graph.mjs                      # .env.local
//   ENV_FILE=.env.cloud node scripts/sync-graph.mjs  # cloud

import { chunk, connectNeo4j, connectPg, loadEnv } from "./lib/bulk.mjs";
import { OFFICE_PROPS, PROP_FOR_SCHEME } from "./lib/entities.mjs";

const BATCH = 1000;

loadEnv();
const pg = await connectPg();
const driver = connectNeo4j();
const session = driver.session();
try {
  const { rows: entities } = await pg.query(
    `select id, type, name, description, biography, image_url, website_url, x_url, facebook_url,
            instagram_url, youtube_url, linkedin_url, highlights, metadata, created_at, updated_at
     from entities`,
  );
  const { rows: identifiers } = await pg.query("select entity_id, scheme, value from entity_identifiers order by value");
  const { rows: offices } = await pg.query("select * from entity_offices where source = 'openstates'");
  const { rows: edges } = await pg.query("select * from entity_edges");

  const extras = new Map();
  const extra = (id) => extras.get(id) ?? extras.set(id, {}).get(id);
  for (const i of identifiers) {
    const prop = PROP_FOR_SCHEME[i.scheme];
    if (!prop) continue;
    if (prop === "fecCandidateIds") (extra(i.entity_id)[prop] ??= []).push(i.value);
    else extra(i.entity_id)[prop] = i.value;
  }
  for (const o of offices) {
    for (const [prop, col] of Object.entries(OFFICE_PROPS)) if (o[col] !== null) extra(o.entity_id)[prop] = o[col];
  }

  const nodes = entities.map((e) => ({
    id: e.id,
    createdAt: e.created_at.toISOString(),
    updatedAt: e.updated_at.toISOString(),
    props: {
      id: e.id,
      type: e.type,
      name: e.name,
      description: e.description,
      biography: e.biography,
      imageUrl: e.image_url,
      websiteUrl: e.website_url,
      xUrl: e.x_url,
      facebookUrl: e.facebook_url,
      instagramUrl: e.instagram_url,
      youtubeUrl: e.youtube_url,
      linkedinUrl: e.linkedin_url,
      highlights: e.highlights,
      metadata: e.metadata,
      ...extras.get(e.id),
    },
  }));
  const rels = edges.map((r) => ({
    source: r.source_entity_id,
    target: r.target_entity_id,
    id: r.id,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
    props: {
      id: r.id,
      label: r.label,
      relType: r.rel_type,
      role: r.role,
      validFrom: r.valid_from,
      validTo: r.valid_to,
      notes: r.notes,
      sourceRecordId: r.source_record_id ?? "",
      ...(r.source_key ? { sourceKey: r.source_key } : {}),
    },
  }));

  // MERGE by id needs an index on it (older graphs already have one).
  const idIndex = await session.run(
    "SHOW INDEXES YIELD labelsOrTypes, properties WHERE labelsOrTypes = ['Entity'] AND properties = ['id'] RETURN count(*) AS n",
  );
  if (idIndex.records[0].get("n").toNumber() === 0) {
    await session.run("CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE");
  }
  // Crosswalk ids are unique in Postgres already; Neo4j-side uniqueness
  // would only make a moved id fail mid-sync.
  for (const name of ["entity_bioguide_unique", "entity_openstates_unique"]) {
    await session.run(`DROP CONSTRAINT ${name} IF EXISTS`);
  }

  const deletedNodes = await session.run(
    "MATCH (e:Entity) WHERE NOT e.id IN $ids DETACH DELETE e RETURN count(*) AS n",
    { ids: nodes.map((n) => n.id) },
  );
  for (const batch of chunk(nodes, BATCH)) {
    await session.run(
      `UNWIND $rows AS row
       MERGE (e:Entity {id: row.id})
       SET e = row.props, e.createdAt = datetime(row.createdAt), e.updatedAt = datetime(row.updatedAt)`,
      { rows: batch },
    );
  }

  const deletedRels = await session.run(
    "MATCH ()-[r:RELATED_TO]->() WHERE NOT r.id IN $ids DELETE r RETURN count(*) AS n",
    { ids: rels.map((r) => r.id) },
  );
  for (const batch of chunk(rels, BATCH)) {
    await session.run(
      `UNWIND $rows AS row
       MATCH (a:Entity {id: row.source}), (b:Entity {id: row.target})
       MERGE (a)-[r:RELATED_TO {id: row.id}]->(b)
       SET r = row.props, r.createdAt = datetime(row.createdAt), r.updatedAt = datetime(row.updatedAt)`,
      { rows: batch },
    );
  }

  const n = (res) => res.records[0].get("n").toNumber();
  console.log(
    `sync-graph: ${nodes.length} entities, ${rels.length} edges written; ` +
      `${n(deletedNodes)} entities and ${n(deletedRels)} edges removed`,
  );
} finally {
  await session.close();
  await driver.close();
  await pg.end();
}
