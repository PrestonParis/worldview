// Assigns a `relType` slug (src/lib/relationships.ts vocabulary) to every
// entity_edges row that doesn't have one, inferred from its free-text
// `label`. Idempotent — only touches edges where relType is missing.
//
// Usage: node scripts/backfill-relationships.mjs [--dry-run]

process.loadEnvFile(process.env.ENV_FILE || ".env.local");

import { connectPg } from "./lib/bulk.mjs";
import { inferRelType } from "../src/lib/relationships.ts";

const DRY_RUN = process.argv.includes("--dry-run");

// The label alone can't tell a party affiliation from any other; the
// target node's name can. "affiliated with" -> "Republican Party" is a
// party membership, not a generic tie.
const PARTY_NAME = /\b(Republican|Democratic|Libertarian|Green|Constitution|Working Families|Independent)\b.*Party|^Independent \(United States politics\)$/i;

function refineByEndpoints(relType, targetName) {
  if ((relType === "affiliated-with" || relType === "member-of") && PARTY_NAME.test(targetName)) {
    return "party-member";
  }
  return relType;
}

async function main() {
  const pg = await connectPg();
  try {
    const { rows } = await pg.query(
      `select r.id, r.label, b.name as target_name from entity_edges r
       join entities b on b.id = r.target_entity_id
       where r.rel_type = ''`,
    );
    console.log(`${rows.length} edges without a relType`);

    const assignments = rows.map((row) => ({
      id: row.id,
      label: row.label,
      relType: refineByEndpoints(inferRelType(row.label), row.target_name),
    }));

    const hist = {};
    for (const a of assignments) hist[a.relType] = (hist[a.relType] ?? 0) + 1;
    console.log("would assign:");
    for (const [slug, n] of Object.entries(hist).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${slug.padEnd(20)} ${n}`);
    }

    if (DRY_RUN) {
      console.log("\nDRY RUN — no writes.");
      return;
    }

    await pg.query(
      `update entity_edges r set rel_type = a.rel_type, updated_at = now()
       from unnest($1::uuid[], $2::text[]) as a(id, rel_type)
       where r.id = a.id`,
      [assignments.map((a) => a.id), assignments.map((a) => a.relType)],
    );
    console.log(`\nSet relType on ${assignments.length} edges.`);
  } finally {
    await pg.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
