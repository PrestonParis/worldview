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
import { connectPg } from "./lib/bulk.mjs";
import { upsertEdges, upsertEntities } from "./lib/entities.mjs";

const DRY_RUN = process.argv.includes("--dry-run");
const DATA = JSON.parse(fs.readFileSync("data/administration.json", "utf8"));

async function main() {
  const pg = await connectPg();
  try {
    const { rows: entities } = await pg.query("select id, name, type from entities");
    const idByLowerName = new Map(entities.map((e) => [e.name.toLowerCase(), e.id]));

    const created = { people: 0, orgs: 0 };
    const edgePlan = [];

    async function ensureEntity(name, type, description) {
      const existing = idByLowerName.get(name.toLowerCase());
      if (existing) return existing;
      const id = randomUUID();
      if (!DRY_RUN) {
        await upsertEntities(pg, [{ id, type, name, description, metadata: "{}" }]);
      }
      idByLowerName.set(name.toLowerCase(), id);
      created[type === "organization" ? "orgs" : "people"]++;
      return id;
    }

    async function ensureEdge(sourceId, targetId, relType, label, role, meta) {
      const key = `admin:${DATA.term}:${sourceId}:${relType}:${targetId}`;
      edgePlan.push({ relType, label });
      if (DRY_RUN) return;
      await upsertEdges(
        pg,
        [
          {
            source_key: key,
            source_entity_id: sourceId,
            target_entity_id: targetId,
            label,
            rel_type: relType,
            role,
            valid_from: DATA.startDate ?? "",
            valid_to: "",
            notes: meta ? JSON.stringify(meta) : "",
          },
        ],
        { keepValidFrom: false },
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
    await pg.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
