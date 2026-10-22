// Loads data/supreme-court.json into the graph: the Court as an organization
// node, each sitting justice as a `judge` node, and two edges per justice —
//   president --nominated--> justice   (valid_from = confirmed, notes = vote)
//   justice   --serves in--> Court     (role = seat, valid_from = seated)
// Justices carry their SCDB code in the crosswalk (scheme "scdb", plus their
// Wikidata id), which is
// how they're matched on later runs — never by name, since "John Roberts"
// is also an unrelated House candidate. Then case_votes.justice_entity_id is
// filled for every vote under those codes.
//
// Idempotent: edges MERGE on a sourceKey; this file's edges that it no
// longer produces (a justice who left) are deleted.
//
// Usage: node scripts/import-supreme-court.mjs [--dry-run]

process.loadEnvFile(process.env.ENV_FILE || ".env.local");

import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { connectPg } from "./lib/bulk.mjs";
import { addIdentifiers, describeConflict, entityIdMap, upsertEdges, upsertEntities } from "./lib/entities.mjs";

const DRY_RUN = process.argv.includes("--dry-run");
const DATA = JSON.parse(fs.readFileSync("data/supreme-court.json", "utf8"));
const OFFICE = {
  chief: "Chief Justice of the United States",
  associate: "Associate Justice of the Supreme Court",
};

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
    const created = { judges: 0, presidents: 0, orgs: 0 };
    const keys = [];

    async function findByName(name, type) {
      // Prefer the record with a Bioguide id: presidents who served in
      // Congress have one, and same-named FEC filings don't.
      const { rows } = await pg.query(
        `select e.id from entities e
         left join entity_identifiers i on i.entity_id = e.id and i.scheme = 'bioguide'
         where lower(e.name) = lower($1) and e.type = $2
         order by (i.value is not null) desc, e.created_at limit 1`,
        [name, type],
      );
      return rows[0]?.id ?? null;
    }

    async function create(row) {
      const id = randomUUID();
      if (!DRY_RUN) await upsertEntities(pg, [{ id, ...row }]);
      return id;
    }

    const courtId =
      (await findByName(DATA.court, "organization")) ??
      (created.orgs++, await create({ type: "organization", name: DATA.court, description: "Highest court of the United States." }));

    const presidentIds = new Map();
    for (const [name, p] of Object.entries(DATA.presidents)) {
      let id = await findByName(name, "politician");
      if (!id) {
        created.presidents++;
        id = await create({ type: "politician", name, description: "President of the United States", image_url: p.image ?? "", metadata: JSON.stringify({ party: p.party }) });
      } else if (p.image && !DRY_RUN) {
        await pg.query("update entities set image_url = $2, updated_at = now() where id = $1 and image_url = ''", [id, p.image]);
      }
      presidentIds.set(name, id);
    }

    const byScdb = await entityIdMap(pg, "scdb");
    const justiceIds = new Map();
    for (const j of DATA.justices) {
      const office = OFFICE[j.seat];
      let id = byScdb.get(j.scdb);
      const fields = {
        office,
        seat: j.seat,
        appointedBy: DATA.presidents[j.appointedBy]?.label ?? j.appointedBy,
        appointingParty: DATA.presidents[j.appointedBy]?.party ?? null,
        nominated: j.nominated,
        confirmed: j.confirmed,
        seated: j.seated,
        senateVote: j.senateVote,
        born: j.born,
        priorPosition: j.prior,
      };
      if (!id) {
        created.judges++;
        id = await create({ type: "judge", name: j.name, description: office, image_url: j.image ?? "", metadata: JSON.stringify({ source: "supreme-court", ...fields }) });
      } else if (!DRY_RUN) {
        const { rows } = await pg.query("select metadata from entities where id = $1", [id]);
        const meta = { ...parseMeta(rows[0]?.metadata), ...fields };
        // A portrait set by hand or another source is kept.
        await pg.query(
          "update entities set metadata = $2, image_url = case when image_url = '' then $3 else image_url end, updated_at = now() where id = $1",
          [id, JSON.stringify(meta), j.image ?? ""],
        );
      }
      justiceIds.set(j.scdb, id);

      const presidentId = presidentIds.get(j.appointedBy);
      if (!presidentId) throw new Error(`${j.name}: appointedBy "${j.appointedBy}" is not in presidents`);
      const edges = [
        {
          source_key: `scotus:${presidentId}:nominated:${id}`,
          source_entity_id: presidentId,
          target_entity_id: id,
          label: "nominated",
          rel_type: "nominated",
          role: office,
          valid_from: j.confirmed,
          notes: JSON.stringify({ nominated: j.nominated, confirmed: j.confirmed, senateVote: j.senateVote }),
        },
        {
          source_key: `scotus:${id}:serves-in:${courtId}`,
          source_entity_id: id,
          target_entity_id: courtId,
          label: "serves in",
          rel_type: "serves-in",
          role: office,
          valid_from: j.seated,
          notes: JSON.stringify({ seat: j.seat }),
        },
      ];
      keys.push(...edges.map((e) => e.source_key));
      if (!DRY_RUN) await upsertEdges(pg, edges, { keepValidFrom: false });
    }

    let pruned = 0;
    let linked = 0;
    if (!DRY_RUN) {
      const conflicts = await addIdentifiers(
        pg,
        DATA.justices.flatMap((j) => [
          { entityId: justiceIds.get(j.scdb), scheme: "scdb", value: j.scdb },
          { entityId: justiceIds.get(j.scdb), scheme: "wikidata", value: j.wikidata },
        ]),
      );
      for (const c of conflicts) console.warn(`  identifier conflict: ${describeConflict(c)}`);

      pruned = (
        await pg.query("delete from entity_edges where source_key like 'scotus:%' and not (source_key = any($1::text[]))", [keys])
      ).rowCount;

      // Every justice the crosswalk knows, not just the sitting nine, so
      // retired justices added by hand get their votes linked too.
      linked = (
        await pg.query(
          `update case_votes v set justice_entity_id = i.entity_id
           from entity_identifiers i
           where i.scheme = 'scdb' and i.value = v.justice
             and v.justice_entity_id is distinct from i.entity_id`,
        )
      ).rowCount;
    }

    console.log(
      `${DATA.court}: ${DATA.justices.length} justices\n` +
        `  created: ${created.judges} judges, ${created.presidents} presidents, ${created.orgs} orgs\n` +
        `  edges: ${keys.length} written, ${pruned} stale removed\n` +
        `  case_votes linked: ${linked}` +
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
