// Idempotent seed. Running it on an empty database yields a small,
// coherent, non-broken app: a few Neo4j entities + a relationship + a donor
// edge so the /money graph renders, and one certified election with two
// candidacies in Postgres so /elections renders.
//
// Every Neo4j write is a MERGE keyed on a fixed UUID and every Postgres
// write is ON CONFLICT DO NOTHING on a fixed UUID, so re-running never
// duplicates and never overwrites hand-edited data.
//
// The Donald Trump entity id here is the exact speaker_entity_id used by
// the recovered claims in backups/ — keep it stable.
//
// Usage: node scripts/seed.mjs

process.loadEnvFile(".env.local");

import neo4j from "neo4j-driver";
import pg from "pg";

const TRUMP_ID = "959fad0d-0edb-4c1e-9c56-c9a1696e443b";
const ZELENSKYY_ID = "b1d9c0a2-4e3f-4a1b-8c7d-0e1f2a3b4c5d";
const WHITEHOUSE_ID = "c2e8f1a3-5d4b-4c2a-9b8e-1f0a2b3c4d5e";
const PAC_ID = "d3f7a2b4-6c5e-4d3b-8a9f-2e1b3c4d5e6f";
const HARRIS_ID = "e4a1c2d3-1111-4aaa-8bbb-000000000010";

// Postgres fixture ids (elections + candidacies).
const ELECTION_2024_ID = "e4a1c2d3-2222-4aaa-8bbb-000000000020";
const CAND_TRUMP_ID = "e4a1c2d3-3333-4aaa-8bbb-000000000030";
const CAND_HARRIS_ID = "e4a1c2d3-3333-4aaa-8bbb-000000000031";

const ENTITIES = [
  {
    id: TRUMP_ID,
    type: "politician",
    name: "Donald Trump",
    description: "45th and 47th President of the United States",
    metadata: { office: "President of the United States", party: "Republican", country: "United States" },
  },
  {
    id: ZELENSKYY_ID,
    type: "politician",
    name: "Volodymyr Zelenskyy",
    description: "President of Ukraine",
    metadata: { office: "President of Ukraine", country: "Ukraine" },
  },
  {
    id: WHITEHOUSE_ID,
    type: "organization",
    name: "The White House",
    description: "Office of the President of the United States",
    metadata: { country: "United States" },
  },
  {
    id: PAC_ID,
    type: "company",
    name: "Example Leadership PAC",
    description: "Placeholder political committee — replace with real FEC data via scripts/import-fec-donors.mjs.",
    metadata: { placeholder: true },
  },
  {
    id: HARRIS_ID,
    type: "politician",
    name: "Kamala Harris",
    description: "49th Vice President of the United States",
    metadata: { office: "Vice President of the United States", party: "Democratic", country: "United States" },
  },
];

const EDGES = [
  {
    id: "1a2b3c4d-0001-4000-8000-000000000001",
    sourceEntityId: TRUMP_ID,
    targetEntityId: ZELENSKYY_ID,
    label: "met with",
    validFrom: "2019-09-25",
    notes: "Bilateral meeting on the margins of the UN General Assembly.",
  },
  {
    id: "1a2b3c4d-0002-4000-8000-000000000002",
    sourceEntityId: PAC_ID,
    targetEntityId: TRUMP_ID,
    label: "donated to",
    validFrom: "2024-01-01",
    notes: "Placeholder contribution edge so the money graph renders.",
  },
];

async function seedNeo4j() {
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
  );
  const session = driver.session();
  try {
    for (const e of ENTITIES) {
      await session.run(
        `MERGE (n:Entity {id: $id})
         ON CREATE SET n.type = $type, n.createdAt = datetime()
         SET n.name = $name,
             n.description = $description,
             n.biography = coalesce(n.biography, ''),
             n.imageUrl = coalesce(n.imageUrl, ''),
             n.websiteUrl = coalesce(n.websiteUrl, ''),
             n.xUrl = coalesce(n.xUrl, ''),
             n.facebookUrl = coalesce(n.facebookUrl, ''),
             n.instagramUrl = coalesce(n.instagramUrl, ''),
             n.youtubeUrl = coalesce(n.youtubeUrl, ''),
             n.linkedinUrl = coalesce(n.linkedinUrl, ''),
             n.highlights = coalesce(n.highlights, ''),
             n.metadata = $metadata,
             n.updatedAt = datetime()`,
        { ...e, metadata: JSON.stringify(e.metadata ?? {}) },
      );
    }
    for (const edge of EDGES) {
      await session.run(
        `MATCH (a:Entity {id: $sourceEntityId}), (b:Entity {id: $targetEntityId})
         MERGE (a)-[r:RELATED_TO {id: $id}]->(b)
         ON CREATE SET r.createdAt = datetime()
         SET r.label = $label,
             r.validFrom = $validFrom,
             r.validTo = coalesce(r.validTo, ''),
             r.notes = $notes,
             r.sourceRecordId = coalesce(r.sourceRecordId, ''),
             r.updatedAt = datetime()`,
        { validFrom: "", notes: "", ...edge },
      );
    }
    const { records } = await session.run(
      "MATCH (e:Entity) RETURN count(e) AS c",
    );
    console.log(`  Neo4j: ${ENTITIES.length} entities + ${EDGES.length} edges merged (${records[0].get("c").toNumber()} total)`);
  } finally {
    await session.close();
    await driver.close();
  }
}

// One certified past race so /elections and its detail page render without
// an empty state on a from-empty database (the Phase 2 importer,
// `npm run import:elections`, is a separate step and needs the source files
// in data/elections/). This is the national-total companion to the
// state-level "<State> — President 2024" rows the importer adds; the
// distinct external_id keeps them from colliding. Totals are the certified
// 2024 U.S. presidential results.
async function seedPostgres() {
  if (!process.env.DATABASE_URL) {
    console.log("  Postgres: skipped (DATABASE_URL not set)");
    return;
  }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `INSERT INTO elections
         (id, name, office, jurisdiction, level, election_type, status, election_date, total_votes, external_id)
       VALUES ($1, $2, $3, $4, 'federal', 'general', 'certified', $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [
        ELECTION_2024_ID,
        "United States — President 2024",
        "President",
        "United States",
        "2024-11-05T00:00:00Z",
        156_302_318,
        "seed:us-president-2024",
      ],
    );
    for (const [id, entityId, party, votes, won, externalId] of [
      [CAND_TRUMP_ID, TRUMP_ID, "Republican", 77_302_580, true, "seed:us-president-2024:R"],
      [CAND_HARRIS_ID, HARRIS_ID, "Democratic", 75_017_613, false, "seed:us-president-2024:D"],
    ]) {
      await client.query(
        `INSERT INTO candidacies
           (id, election_id, candidate_entity_id, party, votes, won, external_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [id, ELECTION_2024_ID, entityId, party, votes, won, externalId],
      );
    }
    console.log("  Postgres: 1 election + 2 candidacies merged");
  } finally {
    await client.end();
  }
}

async function main() {
  console.log("Seeding...");
  await seedNeo4j();
  try {
    await seedPostgres();
  } catch (err) {
    console.warn(`  Postgres: skipped (${err.message}). Run \`npm run db:push\` first.`);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
