// Pings Neo4j Aura with a trivial read so the instance registers activity.
// Aura Free auto-pauses after 3 days idle (and is deleted after a further
// stretch paused) — the weekly sync-legislation/sync-money workflows don't
// run often enough to prevent that on their own. This is scheduled daily
// by .github/workflows/keepalive-neo4j.yml, comfortably inside the window.
//
// Read-only, no writes. Usage: node scripts/neo4j-keepalive.mjs

process.loadEnvFile(".env.local");

import neo4j from "neo4j-driver";

async function main() {
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
  );
  const session = driver.session();
  try {
    const result = await session.run("MATCH (e:Entity) RETURN count(e) AS c");
    console.log(`Neo4j keepalive OK — ${result.records[0].get("c").toNumber()} entities, ${new Date().toISOString()}`);
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((err) => {
  console.error("Neo4j keepalive failed:", err.message);
  process.exit(1);
});
