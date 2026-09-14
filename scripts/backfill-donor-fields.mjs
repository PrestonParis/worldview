// Backfills the Phase 2 classification fields onto `contributions` rows that
// predate them — specifically `donor_industry` (from the donor entity's
// name, via the same heuristic the importer uses) and `contribution_type`
// (parsed from the "FEC entity type: …" note the importer already writes).
//
// Offline: reads donor names from Neo4j and the note text already on each
// row. It does NOT populate donor_state / donor_city / donor_zip /
// employer / occupation — those live only on the FEC filing and need a
// fresh `npm run import:fec-donors` pull (Phase 7), not a local recompute.
//
// Idempotent. By default only fills columns that are currently NULL, so a
// hand-correction is never clobbered. Pass --all to recompute every row
// (use after the classifier in src/lib/money/industries.ts improves).
//
// Usage:
//   node scripts/backfill-donor-fields.mjs [--dry-run] [--all]

process.loadEnvFile(".env.local");

import { Client } from "pg";
import neo4j from "neo4j-driver";
import { classifyCommitteeName } from "../src/lib/money/industries.ts";

const DRY_RUN = process.argv.includes("--dry-run");
const ALL = process.argv.includes("--all");

// FEC `entity_type_desc` / `entity_type` text (as stored in the row note)
// → our coarse contribution_type enum.
function contributionTypeFromNote(note) {
  const n = (note || "").toLowerCase();
  if (!n.includes("fec entity type")) return null;
  if (n.includes("individual")) return "individual";
  if (n.includes("party")) return "party";
  if (n.includes("pac")) return "pac";
  if (n.includes("candidate") || n.includes("committee")) return "committee";
  if (n.includes("organization")) return "other";
  return null;
}

async function main() {
  console.log(
    `Backfill donor fields${DRY_RUN ? " [DRY RUN]" : ""}${ALL ? " [--all: recompute every row]" : ""}`,
  );

  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
  );
  const session = driver.session();

  try {
    const { rows } = await pg.query(
      `select id, donor_entity_id, notes, donor_industry, contribution_type
         from contributions`,
    );
    console.log(`${rows.length} contribution rows`);

    // Resolve donor names once.
    const donorIds = [...new Set(rows.map((r) => r.donor_entity_id))];
    const nameById = new Map();
    for (const id of donorIds) {
      const res = await session.run("MATCH (e:Entity {id: $id}) RETURN e.name AS name", { id });
      if (res.records[0]) nameById.set(id, res.records[0].get("name"));
    }
    console.log(`  resolved ${nameById.size}/${donorIds.length} donor names from Neo4j`);

    let industrySet = 0;
    let typeSet = 0;
    let unresolvedName = 0;
    let unclassified = 0;

    for (const row of rows) {
      const updates = [];
      const values = [];

      if (ALL || row.donor_industry == null) {
        const name = nameById.get(row.donor_entity_id);
        if (!name) {
          unresolvedName++;
        } else {
          const slug = classifyCommitteeName(name);
          if (slug) {
            updates.push(`donor_industry = $${values.length + 1}`);
            values.push(slug);
            industrySet++;
          } else {
            unclassified++;
          }
        }
      }

      if (ALL || row.contribution_type == null) {
        const type = contributionTypeFromNote(row.notes);
        if (type) {
          updates.push(`contribution_type = $${values.length + 1}`);
          values.push(type);
          typeSet++;
        }
      }

      if (updates.length === 0) continue;
      values.push(row.id);
      if (!DRY_RUN) {
        await pg.query(
          `update contributions set ${updates.join(", ")}, updated_at = now() where id = $${values.length}`,
          values,
        );
      }
    }

    console.log("\n--- Summary ---");
    console.log(`donor_industry set:     ${industrySet}`);
    console.log(`contribution_type set:  ${typeSet}`);
    console.log(`donor name unresolved:  ${unresolvedName}`);
    console.log(`name had no keyword hit: ${unclassified}`);
    if (DRY_RUN) console.log("(dry run — no rows written)");
  } finally {
    await session.close();
    await driver.close();
    await pg.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
