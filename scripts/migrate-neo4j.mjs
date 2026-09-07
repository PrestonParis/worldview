// Copies every Entity node and RELATED_TO relationship from a source Neo4j
// to a target Neo4j, preserving ids and properties. Written for the case
// this project hit: the real graph (1,100+ entities) lived in the local
// Docker Neo4j the whole time, while .env.local had been repointed at a
// fresh, empty Neo4j Aura instance — so the app read an empty database and
// the graph "vanished" without anything being deleted.
//
// Also drops a JSON snapshot of the source under backups/ — for a while
// that Docker volume was the only copy of the graph.
//
// Target = the normal NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD (.env.local).
// Source = SOURCE_NEO4J_URI / SOURCE_NEO4J_USER / SOURCE_NEO4J_PASSWORD.
//
// Usage:
//   SOURCE_NEO4J_URI=bolt://127.0.0.1:7687 SOURCE_NEO4J_USER=neo4j \
//   SOURCE_NEO4J_PASSWORD=worldview-dev \
//   node scripts/migrate-neo4j.mjs [--dry-run] [--wipe-target]
//
// --dry-run     report source/target counts and stop
// --wipe-target DETACH DELETE everything in the target first (required
//               unless the target is already empty)

process.loadEnvFile(".env.local");

import fs from "node:fs";
import path from "node:path";
import neo4j from "neo4j-driver";

const DRY_RUN = process.argv.includes("--dry-run");
const WIPE_TARGET = process.argv.includes("--wipe-target");
const BATCH = 500;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return v;
}

function serialize(value) {
  if (value == null) return value;
  if (neo4j.isInt(value)) return value.toNumber();
  if (
    neo4j.isDateTime(value) ||
    neo4j.isDate(value) ||
    neo4j.isLocalDateTime(value) ||
    neo4j.isLocalTime(value) ||
    neo4j.isTime(value) ||
    neo4j.isDuration(value)
  ) {
    return value.toString();
  }
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
  }
  return value;
}

// createdAt/updatedAt come back as ISO strings after serialize(); re-cast
// them to Cypher datetime on write so they land as temporal values, not
// strings. Everything else in this schema is a plain string.
const TEMPORAL_PROPS = ["createdAt", "updatedAt"];

function splitProps(props) {
  const temporal = {};
  const plain = { ...props };
  for (const key of TEMPORAL_PROPS) {
    if (plain[key] != null) {
      temporal[key] = plain[key];
      delete plain[key];
    }
  }
  return { plain, temporal };
}

async function readGraph(session) {
  const eRes = await session.run("MATCH (e:Entity) RETURN properties(e) AS p");
  const entities = eRes.records.map((r) => serialize(r.get("p")));
  const rRes = await session.run(
    `MATCH (a:Entity)-[r:RELATED_TO]->(b:Entity)
     RETURN properties(r) AS p, a.id AS source, b.id AS target`,
  );
  const edges = rRes.records.map((r) => ({
    props: serialize(r.get("p")),
    source: r.get("source"),
    target: r.get("target"),
  }));
  return { entities, edges };
}

async function count(session, cypher) {
  const res = await session.run(cypher);
  return res.records[0].get("c").toNumber();
}

async function main() {
  const sourceDriver = neo4j.driver(
    requireEnv("SOURCE_NEO4J_URI"),
    neo4j.auth.basic(requireEnv("SOURCE_NEO4J_USER"), requireEnv("SOURCE_NEO4J_PASSWORD")),
  );
  const targetDriver = neo4j.driver(
    requireEnv("NEO4J_URI"),
    neo4j.auth.basic(requireEnv("NEO4J_USER"), requireEnv("NEO4J_PASSWORD")),
  );
  const source = sourceDriver.session();
  const target = targetDriver.session();

  try {
    console.log(`Source: ${process.env.SOURCE_NEO4J_URI}`);
    console.log(`Target: ${process.env.NEO4J_URI}${DRY_RUN ? "  [DRY RUN]" : ""}`);

    const { entities, edges } = await readGraph(source);
    const targetEntities = await count(target, "MATCH (e:Entity) RETURN count(e) AS c");
    const targetEdges = await count(target, "MATCH ()-[r:RELATED_TO]->() RETURN count(r) AS c");

    console.log(`\nSource: ${entities.length} entities, ${edges.length} edges`);
    console.log(`Target: ${targetEntities} entities, ${targetEdges} edges`);

    // Snapshot the source regardless of dry-run — this may be the only copy.
    const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    const outDir = path.join("backups", `${stamp}-neo4j-source`);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "entities.json"), JSON.stringify(entities, null, 2));
    fs.writeFileSync(path.join(outDir, "edges.json"), JSON.stringify(edges, null, 2));
    fs.writeFileSync(
      path.join(outDir, "manifest.json"),
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          sourceUri: process.env.SOURCE_NEO4J_URI,
          counts: { entities: entities.length, edges: edges.length },
        },
        null,
        2,
      ),
    );
    console.log(`Snapshot written to ${outDir}`);

    if (DRY_RUN) {
      console.log("\nDRY RUN — no changes.");
      return;
    }

    if (targetEntities > 0 || targetEdges > 0) {
      if (!WIPE_TARGET) {
        console.error(
          "\nTarget is not empty. Re-run with --wipe-target to replace its contents.",
        );
        process.exit(1);
      }
      console.log("\nWiping target...");
      let deleted;
      do {
        const res = await target.run(
          "MATCH (n) WITH n LIMIT 5000 DETACH DELETE n RETURN count(n) AS c",
        );
        deleted = res.records[0].get("c").toNumber();
      } while (deleted > 0);
      console.log("  target cleared");
    }

    await target.run(
      "CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE",
    );

    console.log("\nWriting entities...");
    for (let i = 0; i < entities.length; i += BATCH) {
      const rows = entities.slice(i, i + BATCH).map((props) => {
        const { plain, temporal } = splitProps(props);
        return { plain, ...temporal };
      });
      await target.run(
        `UNWIND $rows AS row
         CREATE (e:Entity)
         SET e = row.plain
         SET e.createdAt = datetime(row.createdAt),
             e.updatedAt = datetime(row.updatedAt)`,
        { rows },
      );
      console.log(`  ${Math.min(i + BATCH, entities.length)}/${entities.length}`);
    }

    console.log("Writing edges...");
    let edgesSkipped = 0;
    for (let i = 0; i < edges.length; i += BATCH) {
      const rows = edges.slice(i, i + BATCH).map((e) => {
        const { plain, temporal } = splitProps(e.props);
        return { source: e.source, target: e.target, plain, ...temporal };
      });
      const res = await target.run(
        `UNWIND $rows AS row
         MATCH (a:Entity {id: row.source}), (b:Entity {id: row.target})
         CREATE (a)-[r:RELATED_TO]->(b)
         SET r = row.plain
         SET r.createdAt = datetime(row.createdAt),
             r.updatedAt = datetime(row.updatedAt)
         RETURN count(r) AS c`,
        { rows },
      );
      const written = res.records[0].get("c").toNumber();
      edgesSkipped += rows.length - written;
      console.log(`  ${Math.min(i + BATCH, edges.length)}/${edges.length}`);
    }

    const finalEntities = await count(target, "MATCH (e:Entity) RETURN count(e) AS c");
    const finalEdges = await count(target, "MATCH ()-[r:RELATED_TO]->() RETURN count(r) AS c");
    console.log(
      `\nDone. Target now has ${finalEntities} entities, ${finalEdges} edges` +
        (edgesSkipped ? ` (${edgesSkipped} edges skipped — endpoint missing)` : ""),
    );
  } finally {
    await source.close();
    await target.close();
    await sourceDriver.close();
    await targetDriver.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
