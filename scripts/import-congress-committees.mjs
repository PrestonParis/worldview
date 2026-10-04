// Imports current congressional committees + subcommittees and their
// membership from the public-domain unitedstates/congress-legislators repo.
//
//   committee      -> `organization` entity, keyed by `committeeId` (THOMAS
//                     id, e.g. "HSAG", subcommittee "HSAG15")
//   subcommittee   --member-of--> parent committee
//   member         --sits-on-committee / chairs--> committee (role = title)
//
// Members resolve by bioguideId, so run `npm run backfill:members` first.
// Membership is a *current* snapshot: edges carry `validFrom` = import date
// and a re-run that no longer sees a seat stamps `validTo` instead of
// deleting it, so the graph keeps the history.
//
// Usage:
//   node scripts/import-congress-committees.mjs [--dry-run]
//   ENV_FILE=.env.cloud node scripts/import-congress-committees.mjs

process.loadEnvFile(process.env.ENV_FILE || ".env.local");

import neo4j from "neo4j-driver";
import { load as loadYaml } from "js-yaml";

const DRY_RUN = process.argv.includes("--dry-run");
const BASE = "https://raw.githubusercontent.com/unitedstates/congress-legislators/main";
const TODAY = new Date().toISOString().slice(0, 10);

async function yaml(file) {
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) throw new Error(`${file} -> ${res.status}`);
  return loadYaml(await res.text());
}

const CHAMBER = { house: "House", senate: "Senate", joint: "Joint" };

async function main() {
  console.log(`Congress committees import${DRY_RUN ? "  [DRY RUN]" : ""}`);
  const committees = await yaml("committees-current.yaml");
  const membership = await yaml("committee-membership-current.yaml");

  const orgs = [];
  for (const c of committees) {
    const chamber = CHAMBER[c.type] ?? "";
    orgs.push({
      committeeId: c.thomas_id,
      name: c.name,
      description: `${chamber} committee of the U.S. Congress.`,
      websiteUrl: c.url ?? "",
      parent: null,
    });
    for (const sub of c.subcommittees ?? []) {
      orgs.push({
        committeeId: `${c.thomas_id}${sub.thomas_id}`,
        name: `${c.name} — Subcommittee on ${sub.name}`,
        description: `${chamber} subcommittee of the ${c.name}.`,
        websiteUrl: "",
        parent: c.thomas_id,
      });
    }
  }

  const seats = [];
  for (const [committeeId, members] of Object.entries(membership)) {
    for (const m of members ?? []) {
      if (!m.bioguide) continue;
      const title = m.title ?? "";
      seats.push({
        committeeId,
        bioguide: m.bioguide,
        relType: /^chair/i.test(title) ? "chairs" : "sits-on-committee",
        label: /^chair/i.test(title) ? "chairs" : "sits on",
        role: title || (m.party === "majority" ? "Member (majority)" : "Member (minority)"),
        rank: m.rank ?? null,
      });
    }
  }
  console.log(`  ${orgs.length} committees/subcommittees, ${seats.length} seats`);
  if (DRY_RUN) return;

  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
  );
  const session = driver.session();
  try {
    await session.run(
      "CREATE INDEX entity_committeeId IF NOT EXISTS FOR (e:Entity) ON (e.committeeId)",
    );
    await session.run(
      `UNWIND $orgs AS o
       MERGE (e:Entity {committeeId: o.committeeId})
       ON CREATE SET e.id = randomUUID(), e.type = 'organization', e.biography = '',
         e.imageUrl = '', e.xUrl = '', e.facebookUrl = '', e.instagramUrl = '',
         e.youtubeUrl = '', e.linkedinUrl = '', e.highlights = '',
         e.metadata = '{"source":"unitedstates/congress-legislators"}',
         e.createdAt = datetime()
       SET e.name = o.name, e.description = o.description,
           e.websiteUrl = CASE WHEN coalesce(e.websiteUrl, '') = '' THEN o.websiteUrl ELSE e.websiteUrl END,
           e.updatedAt = datetime()`,
      { orgs },
    );
    await session.run(
      `UNWIND $orgs AS o
       WITH o WHERE o.parent IS NOT NULL
       MATCH (s:Entity {committeeId: o.committeeId}), (p:Entity {committeeId: o.parent})
       MERGE (s)-[r:RELATED_TO {sourceKey: 'committee-parent:' + o.committeeId}]->(p)
       ON CREATE SET r.id = randomUUID(), r.createdAt = datetime()
       SET r.relType = 'member-of', r.label = 'subcommittee of', r.role = 'Subcommittee',
           r.validFrom = '', r.validTo = '', r.notes = '', r.sourceRecordId = '',
           r.updatedAt = datetime()`,
      { orgs },
    );
    const res = await session.run(
      `UNWIND $seats AS s
       MATCH (m:Entity {bioguideId: s.bioguide}), (c:Entity {committeeId: s.committeeId})
       MERGE (m)-[r:RELATED_TO {sourceKey: 'committee-seat:' + s.committeeId + ':' + s.bioguide}]->(c)
       ON CREATE SET r.id = randomUUID(), r.createdAt = datetime(), r.validFrom = $today
       SET r.relType = s.relType, r.label = s.label, r.role = s.role, r.validTo = '',
           r.notes = CASE WHEN s.rank IS NULL THEN '' ELSE '{"rank":' + toString(s.rank) + '}' END,
           r.sourceRecordId = '', r.updatedAt = datetime()
       RETURN count(r) AS n`,
      { seats, today: TODAY },
    );
    const linked = res.records[0].get("n").toNumber();
    // Seats that dropped out of the current file: close them, don't delete.
    const keys = seats.map((s) => `committee-seat:${s.committeeId}:${s.bioguide}`);
    const closed = await session.run(
      `MATCH ()-[r:RELATED_TO]->() WHERE r.sourceKey STARTS WITH 'committee-seat:'
         AND NOT r.sourceKey IN $keys AND coalesce(r.validTo, '') = ''
       SET r.validTo = $today RETURN count(r) AS n`,
      { keys, today: TODAY },
    );
    console.log(`  ${linked}/${seats.length} seats linked to member entities`);
    console.log(`  ${closed.records[0].get("n").toNumber()} former seats closed`);
    if (linked < seats.length) {
      console.log("  (unlinked seats = members without a bioguideId entity — run backfill:members)");
    }
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
