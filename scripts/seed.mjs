// Idempotent seed. Running it on an empty database yields a small,
// coherent, non-broken app: a few entities, and one certified election with
// two candidacies so /elections renders. Run scripts/sync-graph.mjs after
// to copy the entities into Neo4j.
//
// Entities are upserted on a fixed UUID (name, description, and metadata
// refreshed); every other write is ON CONFLICT DO NOTHING on a fixed UUID,
// so re-running never duplicates and never overwrites hand-edited data.
//
// The Donald Trump entity id here is the exact speaker_entity_id used by
// the recovered claims in backups/ — keep it stable.
//
// Usage: node scripts/seed.mjs

process.loadEnvFile(".env.local");

import pg from "pg";

const TRUMP_ID = "959fad0d-0edb-4c1e-9c56-c9a1696e443b";
const WHITEHOUSE_ID = "c2e8f1a3-5d4b-4c2a-9b8e-1f0a2b3c4d5e";
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
    id: WHITEHOUSE_ID,
    type: "organization",
    name: "The White House",
    description: "Office of the President of the United States",
    metadata: { country: "United States" },
  },
  {
    id: HARRIS_ID,
    type: "politician",
    name: "Kamala Harris",
    description: "49th Vice President of the United States",
    metadata: { office: "Vice President of the United States", party: "Democratic", country: "United States" },
  },
];

const EDGES = [];

async function seedEntities(client) {
  for (const e of ENTITIES) {
    await client.query(
      `insert into entities (id, type, name, description, metadata) values ($1, $2, $3, $4, $5)
       on conflict (id) do update set name = excluded.name, description = excluded.description,
         metadata = excluded.metadata, updated_at = now()`,
      [e.id, e.type, e.name, e.description, JSON.stringify(e.metadata ?? {})],
    );
  }
  for (const edge of EDGES) {
    await client.query(
      `insert into entity_edges (id, source_entity_id, target_entity_id, label, valid_from, notes)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (id) do update set label = excluded.label, valid_from = excluded.valid_from,
         notes = excluded.notes, updated_at = now()`,
      [edge.id, edge.sourceEntityId, edge.targetEntityId, edge.label, edge.validFrom ?? "", edge.notes ?? ""],
    );
  }
  const { rows } = await client.query("select count(*)::int as c from entities");
  console.log(`  entities: ${ENTITIES.length} entities + ${EDGES.length} edges upserted (${rows[0].c} total)`);
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
    await seedEntities(client);
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
  try {
    await seedPostgres();
  } catch (err) {
    console.warn(`  Postgres: skipped (${err.message}). Run \`npm run db:migrate\` first.`);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
