// Assigns a `relType` slug (src/lib/relationships.ts vocabulary) to every
// RELATED_TO edge that doesn't have one, inferred from its free-text
// `label`. Idempotent — only touches edges where relType is missing.
//
// Usage: node scripts/backfill-relationships.mjs [--dry-run]

process.loadEnvFile(".env.local");

import neo4j from "neo4j-driver";
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
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
  );
  const session = driver.session();
  try {
    const res = await session.run(
      `MATCH ()-[r:RELATED_TO]->(b:Entity)
       WHERE r.relType IS NULL OR r.relType = ''
       RETURN r.id AS id, r.label AS label, b.name AS targetName`,
    );
    console.log(`${res.records.length} edges without a relType`);

    const assignments = res.records.map((rec) => {
      const label = rec.get("label") ?? "";
      return {
        id: rec.get("id"),
        label,
        relType: refineByEndpoints(inferRelType(label), rec.get("targetName") ?? ""),
      };
    });

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

    for (let i = 0; i < assignments.length; i += 500) {
      await session.run(
        `UNWIND $rows AS row
         MATCH ()-[r:RELATED_TO {id: row.id}]->()
         SET r.relType = row.relType,
             r.role = coalesce(r.role, ''),
             r.updatedAt = datetime()`,
        { rows: assignments.slice(i, i + 500) },
      );
    }
    console.log(`\nSet relType on ${assignments.length} edges.`);
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
