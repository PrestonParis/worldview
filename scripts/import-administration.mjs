// Loads data/administration.json into the graph: the executive-branch
// departments as organization nodes, each appointee as a politician node
// (matched to an existing entity by name, created if missing), and two
// edges per appointee —
//   President --appointed--> appointee   (role = title, metadata.term)
//   appointee --serves in--> department  (role = title)
// plus President --holds office--> "President of the United States".
//
// Idempotent: entities MERGE on a name key, edges MERGE on a sourceKey.
//
// Usage: node scripts/import-administration.mjs [--dry-run]

process.loadEnvFile(process.env.ENV_FILE || ".env.local");

import fs from "node:fs";
import { randomUUID } from "node:crypto";
import neo4j from "neo4j-driver";

const DRY_RUN = process.argv.includes("--dry-run");
const DATA = JSON.parse(fs.readFileSync("data/administration.json", "utf8"));

async function main() {
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
  );
  const session = driver.session();
  try {
    const entities = (
      await session.run("MATCH (e:Entity) RETURN e.id AS id, e.name AS name, e.type AS type")
    ).records.map((r) => ({ id: r.get("id"), name: r.get("name"), type: r.get("type") }));
    const idByLowerName = new Map(entities.map((e) => [e.name.toLowerCase(), e.id]));

    const created = { people: 0, orgs: 0 };
    const edgePlan = [];

    async function ensureEntity(name, type, description) {
      const existing = idByLowerName.get(name.toLowerCase());
      if (existing) return existing;
      const id = randomUUID();
      if (!DRY_RUN) {
        await session.run(
          `CREATE (e:Entity {
             id: $id, type: $type, name: $name, description: $description,
             biography: '', imageUrl: '', websiteUrl: '', xUrl: '', facebookUrl: '',
             instagramUrl: '', youtubeUrl: '', linkedinUrl: '', highlights: '',
             metadata: '{}', createdAt: datetime(), updatedAt: datetime()
           })`,
          { id, type, name, description },
        );
      }
      idByLowerName.set(name.toLowerCase(), id);
      created[type === "organization" ? "orgs" : "people"]++;
      return id;
    }

    async function ensureEdge(sourceId, targetId, relType, label, role, meta) {
      const key = `admin:${DATA.term}:${sourceId}:${relType}:${targetId}`;
      edgePlan.push({ relType, label });
      if (DRY_RUN) return;
      await session.run(
        `MATCH (a:Entity {id: $sourceId}), (b:Entity {id: $targetId})
         MERGE (a)-[r:RELATED_TO {sourceKey: $key}]->(b)
         ON CREATE SET r.id = $edgeId, r.createdAt = datetime()
         SET r.label = $label, r.relType = $relType, r.role = $role,
             r.validFrom = $validFrom, r.validTo = '',
             r.notes = $notes, r.sourceRecordId = '', r.updatedAt = datetime()`,
        {
          sourceId,
          targetId,
          key,
          edgeId: randomUUID(),
          label,
          relType,
          role,
          validFrom: DATA.startDate ?? "",
          notes: meta ? JSON.stringify(meta) : "",
        },
      );
    }

    const presidentId = await ensureEntity(DATA.president.name, "politician", DATA.president.office);
    const officeId = await ensureEntity(DATA.president.office, "organization", "Head of the U.S. executive branch.");
    await ensureEdge(presidentId, officeId, "holds-office", "holds office", DATA.president.office, { term: DATA.term });

    for (const pos of DATA.positions) {
      const deptId = await ensureEntity(pos.department, "organization", "U.S. executive-branch department or agency.");
      const personId = await ensureEntity(pos.person, "politician", pos.title);
      await ensureEdge(presidentId, personId, "appointed", "appointed", pos.title, {
        term: DATA.term,
        priorSector: pos.priorSector,
      });
      await ensureEdge(personId, deptId, "serves-in", "serves in", pos.title, { term: DATA.term });
    }

    const relHist = {};
    for (const e of edgePlan) relHist[e.relType] = (relHist[e.relType] ?? 0) + 1;
    console.log(
      `${DATA.termLabel}: ${DATA.positions.length} positions\n` +
        `  entities created: ${created.people} people, ${created.orgs} orgs\n` +
        `  edges: ${JSON.stringify(relHist)}` +
        (DRY_RUN ? "\n  DRY RUN — no writes." : ""),
    );
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
