// Adds the "donated to" edges the /money graph draws, and backfills any
// missing donor/recipient entities behind the FEC `contributions` rows.
//
// The contributions table (Postgres) stores donor_entity_id /
// recipient_entity_id but the *names* only ever lived in Neo4j. This
// re-derives them from the live OpenFEC API — each row carries FEC's
// `sub_id` as `external_id`, so the same Schedule A records can be
// re-fetched and `contributor_name` read back, with recipients matched to
// pilot politicians via the congress-legislators crosswalk. Then, keyed on
// the original UUIDs: entities that already exist (e.g. after
// migrate-neo4j.mjs) are left untouched; only genuinely missing ones are
// created. A "donated to" edge is MERGEd per donor->recipient pair
// regardless — the import that created the contributions never wrote
// Neo4j edges, so the money graph has none without this.
//
// Idempotent. Run with --dry-run first to see the match rate.
//
// Usage: node scripts/reconstruct-fec-graph.mjs [--dry-run]
//   Optional: FEC_API_KEY in .env.local (else shared DEMO_KEY, rate-limited)

process.loadEnvFile(".env.local");

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import neo4j from "neo4j-driver";
import { load as loadYaml } from "js-yaml";

const DRY_RUN = process.argv.includes("--dry-run");
const REFRESH = process.argv.includes("--refresh");
const FEC_API_KEY = process.env.FEC_API_KEY || "DEMO_KEY";
const LEGISLATORS_URL =
  "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.yaml";
const FEC_REQUEST_DELAY_MS = 300;
// Kept deliberately frugal: the shared DEMO_KEY allows only 40 calls/hour,
// and this needs ~2 calls per pilot (committee lookup + one Schedule A
// page). A single wide page at the original import's cycle recovers the
// top-by-amount rows it captured. Responses are cached to disk (see
// CACHE_FILE) so a re-run after a rate-limit stall costs no calls.
const PER_PAGE = 100;
const IMPORT_CYCLE = 2026; // the FEC import ran 2026-08; two_year_transaction_period
const CACHE_FILE = path.join("backups", ".fec-schedule-a-cache.json");
// The shared DEMO_KEY is 40 req/hour and contended — be patient enough to
// outlast a busy rolling window (this needs only ~16 calls total, and
// every success is cached). A personal FEC_API_KEY makes it instant.
const MAX_RETRIES = 20;

// Same list the original importer used (scripts/import-fec-donors.mjs).
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fecFetch(apiPath, params) {
  const url = new URL(`https://api.open.fec.gov/v1${apiPath}`);
  url.searchParams.set("api_key", FEC_API_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      await sleep(FEC_REQUEST_DELAY_MS);
      return res.json();
    }
    const body = await res.text();
    // 429 = hourly quota; 504 = FEC's own query timeout. Both are worth
    // waiting out rather than aborting a multi-call reconstruction.
    if ((res.status === 429 || res.status === 504) && attempt <= MAX_RETRIES) {
      const waitMs = res.status === 429 ? 60_000 : 5_000 * attempt;
      console.log(
        `    ${res.status} on ${apiPath} — waiting ${waitMs / 1000}s (attempt ${attempt}/${MAX_RETRIES})`,
      );
      await sleep(waitMs);
      continue;
    }
    throw new Error(`FEC ${apiPath} -> ${res.status} ${body}`);
  }
}

function loadCache() {
  if (REFRESH || !fs.existsSync(CACHE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function termInfo(legislator) {
  const terms = legislator.terms || [];
  const last = terms[terms.length - 1] || {};
  return {
    party: last.party || "",
    state: last.state || "",
    office: last.type === "sen" ? "U.S. Senator" : last.type === "rep" ? "U.S. Representative" : "",
  };
}

async function main() {
  console.log(
    `FEC key: ${FEC_API_KEY === "DEMO_KEY" ? "DEMO_KEY (shared, rate-limited)" : "personal"}` +
      (DRY_RUN ? "  [DRY RUN — no writes]" : ""),
  );

  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
  );
  const session = driver.session();

  try {
    // 1. The orphaned contribution rows.
    const { rows: contributions } = await pg.query(
      `select external_id, donor_entity_id, recipient_entity_id, amount, date
         from contributions
        where external_id is not null`,
    );
    console.log(`\n${contributions.length} contributions with an FEC sub_id`);
    const wantedSubIds = new Set(contributions.map((c) => String(c.external_id)));
    const recipientIds = [...new Set(contributions.map((c) => c.recipient_entity_id))];
    const donorIds = [...new Set(contributions.map((c) => c.donor_entity_id))];
    console.log(`  ${recipientIds.length} distinct recipients, ${donorIds.length} distinct donors`);

    // 2. Crosswalk + committee resolution for each pilot politician.
    console.log("\nFetching congress-legislators crosswalk...");
    const legislators = loadYaml(await (await fetch(LEGISLATORS_URL)).text());
    console.log(`  ${legislators.length} legislators`);

    // 3. Build subId -> { contributorName, pilotName } from live Schedule A.
    //    Cached per committee on disk so a rate-limit stall is resumable.
    const cache = loadCache();
    const subIdInfo = new Map();
    const pilotToCommittee = new Map();

    for (const pilotName of PILOT_NAMES) {
      const lastName = pilotName.trim().split(/\s+/).pop().toLowerCase();
      const firstName = pilotName.trim().split(/\s+/)[0].toLowerCase();
      const legislator = legislators.filter(
        (l) => (l.name?.last || "").toLowerCase() === lastName,
      )[0];
      if (!legislator) {
        console.log(`  ! ${pilotName}: not in congress-legislators crosswalk — skipping`);
        continue;
      }
      const fecId = (legislator.id?.fec || [])[0];
      if (!fecId) {
        console.log(`  ! ${pilotName}: no FEC candidate id in crosswalk`);
        continue;
      }

      let entry = cache[pilotName];
      if (!entry) {
        let committeeId;
        try {
          const c = await fecFetch(`/candidate/${fecId}/committees/`, {
            designation: "P",
            per_page: "1",
          });
          committeeId = c.results?.[0]?.committee_id;
        } catch (err) {
          console.log(`  ! ${pilotName}: committee lookup failed — ${err.message}`);
          continue;
        }
        if (!committeeId) {
          console.log(`  ! ${pilotName}: no principal campaign committee`);
          continue;
        }

        const fetchScheduleA = async (params) => {
          const batch = await fecFetch("/schedules/schedule_a/", {
            committee_id: committeeId,
            sort: "-contribution_receipt_amount",
            per_page: String(PER_PAGE),
            is_individual: "false",
            ...params,
          });
          return (batch.results || []).map((r) => ({
            sub_id: String(r.sub_id),
            contributor_name: (r.contributor_name || "").trim(),
            contributor_id: r.contributor_id || null,
          }));
        };

        let results = [];
        try {
          results = await fetchScheduleA({ two_year_transaction_period: String(IMPORT_CYCLE) });
          if (results.length === 0) {
            // The import cycle may have no organizational filings yet —
            // fall back to the most recent regardless of cycle, same as
            // the original importer.
            results = await fetchScheduleA({});
          }
        } catch (err) {
          console.log(`  ! ${pilotName}: schedule_a fetch failed — ${err.message}`);
          continue;
        }
        entry = { committeeId, results };
        cache[pilotName] = entry;
        saveCache(cache);
      }

      pilotToCommittee.set(pilotName, {
        committeeId: entry.committeeId,
        ...termInfo(legislator),
        first: (legislator.name.first || firstName).toLowerCase(),
        last: (legislator.name.last || lastName).toLowerCase(),
      });

      let found = 0;
      for (const r of entry.results) {
        if (!subIdInfo.has(r.sub_id)) {
          subIdInfo.set(r.sub_id, {
            contributorName: r.contributor_name,
            contributorId: r.contributor_id,
            pilotName,
          });
        }
        if (wantedSubIds.has(r.sub_id)) found++;
      }
      console.log(
        `  ${pilotName} -> ${entry.committeeId} (${entry.results.length} FEC rows): ` +
          `${found} orphaned sub_ids matched`,
      );
    }

    // 4. Join back to the contribution rows to learn the original UUIDs.
    const politicianById = new Map(); // recipient_entity_id -> { name, party, state, office }
    const donorById = new Map(); // donor_entity_id -> { name, fecCommitteeId }
    const pairs = new Map(); // `${donor}->${recip}` -> { donorId, recipId, count, total, minDate }
    let matched = 0;

    for (const c of contributions) {
      const info = subIdInfo.get(String(c.external_id));
      if (!info) continue;
      matched++;

      const pilot = pilotToCommittee.get(info.pilotName);
      if (pilot && !politicianById.has(c.recipient_entity_id)) {
        politicianById.set(c.recipient_entity_id, {
          name: info.pilotName,
          party: pilot.party,
          state: pilot.state,
          office: pilot.office,
        });
      }
      if (info.contributorName && !donorById.has(c.donor_entity_id)) {
        donorById.set(c.donor_entity_id, {
          name: info.contributorName,
          fecCommitteeId: info.contributorId,
        });
      }

      const key = `${c.donor_entity_id}->${c.recipient_entity_id}`;
      const agg = pairs.get(key) || {
        donorId: c.donor_entity_id,
        recipId: c.recipient_entity_id,
        count: 0,
        total: 0,
        minDate: c.date,
      };
      agg.count++;
      agg.total += c.amount;
      if (c.date < agg.minDate) agg.minDate = c.date;
      pairs.set(key, agg);
    }

    const unresolvedRecipients = recipientIds.filter((id) => !politicianById.has(id));
    const unresolvedDonors = donorIds.filter((id) => !donorById.has(id));

    console.log(`\n--- Match report ---`);
    console.log(`  contributions matched to a live FEC record: ${matched}/${contributions.length}`);
    console.log(`  politician recipients resolved: ${politicianById.size}/${recipientIds.length}`);
    console.log(`  committee donors resolved:      ${donorById.size}/${donorIds.length}`);
    console.log(`  donor->recipient pairs (edges): ${pairs.size}`);
    if (unresolvedRecipients.length)
      console.log(`  unresolved recipient ids: ${unresolvedRecipients.join(", ")}`);
    if (unresolvedDonors.length)
      console.log(`  unresolved donor ids (${unresolvedDonors.length}) will get placeholder names`);

    if (DRY_RUN) {
      console.log("\nDRY RUN — stopping before any write.");
      return;
    }

    // 5. Fill in any entities that don't already exist, keyed on their
    //    original UUIDs. Existing entities (e.g. from a full graph
    //    migration) are left untouched — this only backfills gaps.
    let entitiesWritten = 0;
    for (const [id, p] of politicianById) {
      await session.run(
        `MERGE (e:Entity {id: $id})
         ON CREATE SET e.type = 'politician',
             e.name = $name,
             e.description = $description,
             e.biography = '', e.imageUrl = '', e.websiteUrl = '',
             e.xUrl = '', e.facebookUrl = '', e.instagramUrl = '',
             e.youtubeUrl = '', e.linkedinUrl = '', e.highlights = '',
             e.metadata = $metadata,
             e.createdAt = datetime(), e.updatedAt = datetime()`,
        {
          id,
          name: p.name,
          description: [p.office, p.party && `${p.party}`, p.state && `${p.state}`]
            .filter(Boolean)
            .join(" · "),
          metadata: JSON.stringify({
            party: p.party || undefined,
            state: p.state || undefined,
            office: p.office || undefined,
            reconstructedFrom: "openfec + congress-legislators",
          }),
        },
      );
      entitiesWritten++;
    }

    for (const id of donorIds) {
      const d = donorById.get(id);
      const name = d?.name || `Unidentified FEC committee (${id.slice(0, 8)})`;
      await session.run(
        `MERGE (e:Entity {id: $id})
         ON CREATE SET e.type = 'company',
             e.name = $name,
             e.description = $description,
             e.biography = '', e.imageUrl = '', e.websiteUrl = '',
             e.xUrl = '', e.facebookUrl = '', e.instagramUrl = '',
             e.youtubeUrl = '', e.linkedinUrl = '', e.highlights = '',
             e.metadata = $metadata,
             e.createdAt = datetime(), e.updatedAt = datetime()`,
        {
          id,
          name,
          description: "Political committee — reconstructed from FEC Schedule A data.",
          metadata: JSON.stringify({
            fecCommitteeId: d?.fecCommitteeId || undefined,
            reconstructedFrom: "openfec-schedule_a",
            placeholder: d ? undefined : true,
          }),
        },
      );
      entitiesWritten++;
    }

    // 6. One "donated to" edge per donor->recipient pair.
    let edgesWritten = 0;
    for (const [key, agg] of pairs) {
      await session.run(
        `MATCH (d:Entity {id: $donorId}), (p:Entity {id: $recipId})
         MERGE (d)-[r:RELATED_TO {pairKey: $key}]->(p)
         ON CREATE SET r.id = $edgeId, r.createdAt = datetime()
         SET r.label = 'donated to',
             r.validFrom = $validFrom,
             r.validTo = coalesce(r.validTo, ''),
             r.notes = $notes,
             r.sourceRecordId = coalesce(r.sourceRecordId, ''),
             r.updatedAt = datetime()`,
        {
          donorId: agg.donorId,
          recipId: agg.recipId,
          key,
          edgeId: randomUUID(),
          validFrom: new Date(agg.minDate).toISOString().slice(0, 10),
          notes: `${agg.count} FEC contribution${agg.count === 1 ? "" : "s"}, $${agg.total.toLocaleString("en-US")} total`,
        },
      );
      edgesWritten++;
    }

    console.log(
      `\nEnsured ${entitiesWritten} entities (existing ones left as-is) ` +
        `and ${edgesWritten} "donated to" edges in Neo4j.`,
    );
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
