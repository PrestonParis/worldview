// Loads data/administration.json into the graph: the executive-branch
// departments as organization nodes, each appointee as a politician node
// (matched to an existing entity by name, created if missing), and two
// edges per appointee —
//   President --appointed--> appointee   (role = title, notes = group/order)
//   appointee --serves in--> department  (role = title)
// plus President --holds office--> "President of the United States".
// Edges run from the appointee's `since` date; people under `former` get the
// same edges closed with their `until` date.
//
// Current appointees are stamped metadata.branch = "executive" (the /people
// executive row) and metadata.office = their title; both come off when they
// move to `former`.
//
// Idempotent: entities MERGE on a name key, edges MERGE on a sourceKey, and
// this term's edges that the file no longer produces are deleted.
//
// Usage: node scripts/import-administration.mjs [--dry-run]

process.loadEnvFile(process.env.ENV_FILE || ".env.local");

import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { connectPg } from "./lib/bulk.mjs";
import { upsertEdges, upsertEntities } from "./lib/entities.mjs";

const DRY_RUN = process.argv.includes("--dry-run");
const DATA = JSON.parse(fs.readFileSync("data/administration.json", "utf8"));

function parseMeta(raw) {
  try {
    const value = JSON.parse(raw || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

async function main() {
  const pg = await connectPg();
  try {
    // Politicians win a name tie, so "Marco Rubio" resolves to the senator's
    // record rather than a same-named committee or donor.
    const { rows: entities } = await pg.query(
      "select id, name, type, metadata from entities order by (type = 'politician') desc, created_at",
    );
    const idByLowerName = new Map();
    const metaById = new Map();
    for (const e of entities) {
      if (!idByLowerName.has(e.name.toLowerCase())) idByLowerName.set(e.name.toLowerCase(), e.id);
      metaById.set(e.id, e.metadata);
    }

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
      metaById.set(id, "{}");
      created[type === "organization" ? "orgs" : "people"]++;
      return id;
    }

    async function ensureEdge(sourceId, targetId, relType, label, role, meta, { from = DATA.startDate, until = "" } = {}) {
      const key = `admin:${DATA.term}:${sourceId}:${relType}:${targetId}`;
      edgePlan.push({ relType, label, key });
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
            valid_from: from ?? "",
            valid_to: until,
            notes: meta ? JSON.stringify(meta) : "",
          },
        ],
        { keepValidFrom: false },
      );
    }

    // Stamps (or clears) the executive-branch markers on a person's metadata.
    const metaUpdates = [];
    function stamp(personId, title, current) {
      const meta = parseMeta(metaById.get(personId));
      const next = { ...meta };
      if (current) {
        next.branch = "executive";
        if (!next.office || meta.branch === "executive") next.office = title;
      } else {
        if (next.branch === "executive") delete next.branch;
        if (next.office === title) delete next.office;
      }
      if (JSON.stringify(next) !== JSON.stringify(meta)) metaUpdates.push({ id: personId, metadata: JSON.stringify(next) });
    }

    const presidentId = await ensureEntity(DATA.president.name, "politician", DATA.president.office);
    const officeId = await ensureEntity(DATA.president.office, "organization", "Head of the U.S. executive branch.");
    await ensureEdge(presidentId, officeId, "holds-office", "holds office", DATA.president.office, { term: DATA.term });
    stamp(presidentId, DATA.president.office, true);

    const posts = [
      ...DATA.positions.map((pos, order) => ({ ...pos, order, current: true })),
      ...(DATA.former ?? []).map((pos) => ({ ...pos, order: null, current: false })),
    ];
    for (const pos of posts) {
      const deptId = await ensureEntity(pos.department, "organization", "U.S. executive-branch department or agency.");
      const personId = await ensureEntity(pos.person, "politician", pos.title);
      const dates = { from: pos.since ?? DATA.startDate, until: pos.until ?? "" };
      await ensureEdge(
        presidentId,
        personId,
        "appointed",
        "appointed",
        pos.title,
        { term: DATA.term, priorSector: pos.priorSector, group: pos.group ?? null, order: pos.order },
        dates,
      );
      await ensureEdge(personId, deptId, "serves-in", "serves in", pos.title, { term: DATA.term }, dates);
      stamp(personId, pos.title, pos.current);
    }

    // Portraits from the file fill only an empty image_url.
    const images = [
      [presidentId, DATA.president.image],
      ...posts.map((pos) => [idByLowerName.get(pos.person.toLowerCase()), pos.image]),
    ].filter(([id, url]) => id && url);
    if (!DRY_RUN && images.length) {
      await pg.query(
        `update entities e set image_url = u.url, updated_at = now()
         from unnest($1::uuid[], $2::text[]) as u(id, url) where e.id = u.id and e.image_url = ''`,
        [images.map(([id]) => id), images.map(([, url]) => url)],
      );
    }

    if (!DRY_RUN && metaUpdates.length) {
      await pg.query(
        `update entities e set metadata = u.metadata, updated_at = now()
         from unnest($1::uuid[], $2::text[]) as u(id, metadata) where e.id = u.id`,
        [metaUpdates.map((u) => u.id), metaUpdates.map((u) => u.metadata)],
      );
    }

    // Edges from an earlier run that this one no longer writes (a person
    // re-matched to another entity, a post dropped from the file).
    let pruned = 0;
    if (!DRY_RUN) {
      const res = await pg.query(
        "delete from entity_edges where source_key like $1 and not (source_key = any($2::text[]))",
        [`admin:${DATA.term}:%`, edgePlan.map((e) => e.key)],
      );
      pruned = res.rowCount;
    }

    const relHist = {};
    for (const e of edgePlan) relHist[e.relType] = (relHist[e.relType] ?? 0) + 1;
    console.log(
      `${DATA.termLabel}: ${DATA.positions.length} positions, ${(DATA.former ?? []).length} former\n` +
        `  entities created: ${created.people} people, ${created.orgs} orgs\n` +
        `  metadata updated: ${metaUpdates.length}\n` +
        `  edges: ${JSON.stringify(relHist)}, ${pruned} stale removed` +
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
