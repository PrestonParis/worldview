// Imports real organizational (PAC/committee) donor data from the free
// OpenFEC API (api.open.fec.gov) into the `contributions` table, matching
// recipients against existing `politician` entities via the public-domain
// unitedstates/congress-legislators crosswalk (FEC's own name formatting
// doesn't match ours reliably enough to key off text alone).
//
// Edit PILOT_NAMES below to import a different set of politicians. Safe to
// re-run — contributions carry FEC's own `sub_id` as an idempotency key
// (external_id, unique), so re-running only inserts what's new.
//
// Usage: npm run import:fec-donors
// Optional: set FEC_API_KEY in .env.local for a dedicated rate limit
// (falls back to the shared DEMO_KEY, 1,000 req/hour, no signup needed).

process.loadEnvFile(".env.local");

import { randomUUID } from "node:crypto";
import { Client } from "pg";
import neo4j from "neo4j-driver";
import { load as loadYaml } from "js-yaml";

const FEC_API_KEY = process.env.FEC_API_KEY || "DEMO_KEY";
const LEGISLATORS_URL =
  "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.yaml";
const CONTRIBUTIONS_PER_POLITICIAN = 25;
const FEC_REQUEST_DELAY_MS = 250;

// Edit this list to import donor data for different politicians. Matched
// by last name against the legislators crosswalk, then by first+last name
// tokens against existing `politician` entities in Neo4j.
const PILOT_NAMES = [
  "Chuck Schumer",
  "Nancy Pelosi",
  "Alexandria Ocasio-Cortez",
  "Mitch McConnell",
  "Elizabeth Warren",
  "Bernie Sanders",
  "Ted Cruz",
  "Marjorie Taylor Greene",
  "Maria Cantwell",
  "Lindsey Graham",
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTokens(name) {
  return name
    .toLowerCase()
    .replace(/[.,]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

async function fecFetch(path, params) {
  const url = new URL(`https://api.open.fec.gov/v1${path}`);
  url.searchParams.set("api_key", FEC_API_KEY);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`FEC ${path} -> ${res.status} ${await res.text()}`);
  }
  await sleep(FEC_REQUEST_DELAY_MS);
  return res.json();
}

async function main() {
  console.log(`Using FEC API key: ${FEC_API_KEY === "DEMO_KEY" ? "DEMO_KEY (shared, rate-limited)" : "personal key"}`);

  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
  );
  const session = driver.session();

  const unmatched = [];
  let totalInserted = 0;
  let totalSkipped = 0;
  let entitiesCreated = 0;

  try {
    console.log("Fetching congress-legislators crosswalk...");
    const legislatorsYaml = await (await fetch(LEGISLATORS_URL)).text();
    const legislators = loadYaml(legislatorsYaml);
    console.log(`  ${legislators.length} legislators loaded`);

    console.log("Fetching existing politician entities from Neo4j...");
    const entityResult = await session.run("MATCH (e:Entity {type: 'politician'}) RETURN e");
    const politicianEntities = entityResult.records.map((r) => {
      const p = r.get("e").properties;
      return { id: p.id, name: p.name };
    });
    console.log(`  ${politicianEntities.length} politician entities found`);

    const sourceRes = await pg.query(
      `insert into sources (title, url, publisher, source_type, notes)
       values ($1, $2, $3, 'filing', $4) returning id`,
      [
        `FEC Schedule A import (${new Date().toISOString().slice(0, 10)})`,
        "https://www.fec.gov/data/",
        "Federal Election Commission",
        "Organizational (PAC/committee) contributions imported from OpenFEC schedule_a. Individual contributions were not imported.",
      ],
    );
    const sourceId = sourceRes.rows[0].id;

    for (const pilotName of PILOT_NAMES) {
      const lastName = pilotName.trim().split(/\s+/).pop().toLowerCase();
      const legislatorMatches = legislators.filter(
        (l) => (l.name?.last || "").toLowerCase() === lastName,
      );
      if (legislatorMatches.length === 0) {
        unmatched.push(`${pilotName} — no legislator record with last name "${lastName}"`);
        continue;
      }
      const legislator = legislatorMatches[0];
      if (legislatorMatches.length > 1) {
        console.log(
          `  note: ${legislatorMatches.length} legislators share last name "${lastName}", using ${legislator.name.first} ${legislator.name.last}`,
        );
      }

      const fecIds = legislator.id?.fec || [];
      if (fecIds.length === 0) {
        unmatched.push(`${pilotName} — resolved to ${legislator.name.first} ${legislator.name.last}, but no FEC candidate id in crosswalk`);
        continue;
      }

      const first = legislator.name.first.toLowerCase();
      const last = legislator.name.last.toLowerCase();
      const entity = politicianEntities.find((e) => {
        const tokens = normalizeTokens(e.name);
        return tokens.includes(last) && tokens.includes(first);
      });
      if (!entity) {
        unmatched.push(
          `${pilotName} — resolved to ${legislator.name.first} ${legislator.name.last}, but no matching politician entity in Neo4j`,
        );
        continue;
      }

      console.log(`\n${pilotName} -> entity "${entity.name}" (${entity.id}), FEC candidate ${fecIds[0]}`);

      let committeeId;
      try {
        const committees = await fecFetch(`/candidate/${fecIds[0]}/committees/`, {
          designation: "P",
          per_page: "1",
        });
        committeeId = committees.results?.[0]?.committee_id;
      } catch (err) {
        unmatched.push(`${pilotName} — FEC committee lookup failed: ${err.message}`);
        continue;
      }
      if (!committeeId) {
        unmatched.push(`${pilotName} — no principal campaign committee found for FEC candidate ${fecIds[0]}`);
        continue;
      }

      const currentYear = new Date().getFullYear();
      const cycle = currentYear % 2 === 0 ? currentYear : currentYear + 1;
      let contributions = [];
      try {
        const primary = await fecFetch("/schedules/schedule_a/", {
          committee_id: committeeId,
          sort: "-contribution_receipt_amount",
          per_page: String(CONTRIBUTIONS_PER_POLITICIAN),
          is_individual: "false",
          two_year_transaction_period: String(cycle),
        });
        contributions = primary.results || [];
        if (contributions.length === 0) {
          // Current cycle may not have data yet (e.g. early in a term) —
          // fall back to the most recent organizational contributions
          // regardless of cycle rather than reporting a false zero.
          const fallback = await fecFetch("/schedules/schedule_a/", {
            committee_id: committeeId,
            sort: "-contribution_receipt_amount",
            per_page: String(CONTRIBUTIONS_PER_POLITICIAN),
            is_individual: "false",
          });
          contributions = fallback.results || [];
        }
      } catch (err) {
        unmatched.push(`${pilotName} — schedule_a fetch failed: ${err.message}`);
        continue;
      }

      console.log(`  ${contributions.length} organizational contributions found`);

      for (const c of contributions) {
        const donorName = (c.contributor_name || "").trim();
        const amount = Math.round(c.contribution_receipt_amount || 0);
        if (!donorName || amount <= 0 || !c.contribution_receipt_date) continue;

        const existingDonor = await session.run(
          "MATCH (e:Entity {type: 'company'}) WHERE toLower(e.name) = toLower($name) RETURN e LIMIT 1",
          { name: donorName },
        );

        let donorEntityId;
        if (existingDonor.records.length > 0) {
          donorEntityId = existingDonor.records[0].get("e").properties.id;
        } else {
          donorEntityId = randomUUID();
          const metadata = JSON.stringify({
            fecCommitteeId: c.contributor_id || null,
            importedFrom: "openfec-schedule_a",
          });
          await session.run(
            `CREATE (e:Entity {
               id: $id, type: 'company', name: $name,
               description: $description, biography: '', imageUrl: '',
               websiteUrl: '', xUrl: '', facebookUrl: '', instagramUrl: '',
               youtubeUrl: '', linkedinUrl: '', highlights: '',
               metadata: $metadata, createdAt: datetime(), updatedAt: datetime()
             })`,
            {
              id: donorEntityId,
              name: donorName,
              description: "Political committee — imported from FEC Schedule A data.",
              metadata,
            },
          );
          entitiesCreated++;
        }

        const insertRes = await pg.query(
          `insert into contributions
             (donor_entity_id, recipient_entity_id, amount, currency, date, source_record_id, notes, external_id)
           values ($1, $2, $3, 'USD', $4, $5, $6, $7)
           on conflict (external_id) do nothing
           returning id`,
          [
            donorEntityId,
            entity.id,
            amount,
            c.contribution_receipt_date,
            sourceId,
            `FEC entity type: ${c.entity_type_desc || c.entity_type || "committee"}`,
            String(c.sub_id),
          ],
        );
        if (insertRes.rows.length > 0) totalInserted++;
        else totalSkipped++;
      }
    }

    console.log("\n--- Summary ---");
    console.log(`Contributions inserted: ${totalInserted}`);
    console.log(`Contributions skipped (already imported): ${totalSkipped}`);
    console.log(`Donor entities created: ${entitiesCreated}`);
    if (unmatched.length > 0) {
      console.log(`Unmatched (${unmatched.length}):`);
      for (const m of unmatched) console.log(`  - ${m}`);
    }
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
