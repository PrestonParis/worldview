// Backfills a `politician` Neo4j entity for every member of Congress who
// served in the target Congress range (default 118th–119th), keyed on the
// stable Bioguide id so downstream importers (bills, roll-call votes) can
// resolve sponsors and voters by id instead of fuzzy name matching.
//
// Source: the public-domain unitedstates/congress-legislators crosswalk —
// the same dataset scripts/import-fec-donors.mjs already reads. No API key.
//
// Idempotent and safe on a populated graph:
//   - a member already linked by bioguideId is left alone (only metadata
//     this script previously authored is refreshed)
//   - an existing hand-added politician whose name matches is *linked* (its
//     bioguideId is set) rather than duplicated — unless more than one
//     entity matches by name, in which case it's reported, not guessed
//   - everyone else is created
//
// Usage:
//   npm run backfill:members
//   npm run backfill:members -- --dry-run
//   npm run backfill:members -- --congresses=118,119
//
//   --dry-run          fetch + match + report counts, write nothing
//   --congresses=A,B   override the target Congress range (ranges ok: 95-119)
//
// Every matched member also gets the full id crosswalk (icpsrId, wikidataId,
// fecCandidateIds, govtrackId, opensecretsId, ...) as entity properties, and
// blank website / social / portrait fields are filled from the
// legislators-social-media file and unitedstates/images.
//
// ENV_FILE=.env.cloud targets cloud without swapping .env.local.

process.loadEnvFile(process.env.ENV_FILE || ".env.local");

import { randomUUID } from "node:crypto";
import neo4j from "neo4j-driver";
import { load as loadYaml } from "js-yaml";
import {
  servedInCongresses,
  displayName,
  nameLooksLikeMember,
  buildMemberMetadata,
  parseCongressList,
  crosswalkIds,
  profileUrls,
} from "./lib/members.mjs";

const DRY_RUN = process.argv.includes("--dry-run");
const congressArg = process.argv.find((a) => a.startsWith("--congresses="));
const CONGRESSES = congressArg
  ? parseCongressList(congressArg.slice("--congresses=".length))
  : [118, 119];

if (CONGRESSES.length === 0) {
  console.error("--congresses must list at least one positive integer");
  process.exit(1);
}

const LEGISLATORS_URLS = [
  "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.yaml",
  "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-historical.yaml",
];

const SOCIAL_URL =
  "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-social-media.yaml";

const METADATA_SOURCE = "unitedstates/congress-legislators";

async function fetchLegislators() {
  const all = [];
  for (const url of LEGISLATORS_URLS) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`${url} -> ${res.status} ${await res.text()}`);
    }
    all.push(...loadYaml(await res.text()));
  }
  return all;
}

async function fetchSocial() {
  const res = await fetch(SOCIAL_URL);
  if (!res.ok) throw new Error(`${SOCIAL_URL} -> ${res.status}`);
  return new Map((loadYaml(await res.text()) ?? []).map((s) => [s.id?.bioguide, s]));
}

function metadataState(raw) {
  try {
    return String(JSON.parse(raw || "{}").state ?? "").toUpperCase();
  } catch {
    return "";
  }
}

function priorMetadataSource(raw) {
  try {
    return JSON.parse(raw || "{}").source ?? "";
  } catch {
    return "";
  }
}

async function main() {
  console.log(
    `Backfilling members for Congress ${CONGRESSES.join(", ")}${DRY_RUN ? "  [DRY RUN]" : ""}`,
  );

  const legislators = await fetchLegislators();
  console.log(`  ${legislators.length} legislator records fetched`);

  const members = legislators.filter((l) => servedInCongresses(l.terms, CONGRESSES));
  console.log(`  ${members.length} served in the target range`);
  const social = await fetchSocial();
  // entityId -> legislator, applied in UNWIND batches at the end.
  const crosswalk = new Map();

  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
  );
  const session = driver.session();

  const counts = {
    created: 0,
    linkedById: 0,
    linkedByName: 0,
    metadataRefreshed: 0,
    ambiguous: 0,
  };
  const ambiguous = [];

  try {
    if (!DRY_RUN) {
      await session.run(
        "CREATE CONSTRAINT entity_bioguide_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.bioguideId IS UNIQUE",
      );
    }

    // One read of every politician entity up front — the graph is ~1k
    // nodes, so this beats a round trip per member for the name-match
    // fallback.
    const existingRes = await session.run(
      `MATCH (e:Entity {type: 'politician'})
       RETURN e.id AS id, e.name AS name,
              e.bioguideId AS bioguideId, e.metadata AS metadata`,
    );
    const existing = existingRes.records.map((r) => ({
      id: r.get("id"),
      name: r.get("name"),
      bioguideId: r.get("bioguideId") ?? "",
      metadata: r.get("metadata") ?? "",
    }));
    const byBioguide = new Map(
      existing.filter((e) => e.bioguideId).map((e) => [e.bioguideId, e]),
    );

    for (const legislator of members) {
      const bioguideId = legislator.id?.bioguide;
      if (!bioguideId) continue;
      const name = displayName(legislator);
      const metadata = JSON.stringify(buildMemberMetadata(legislator, CONGRESSES));

      const linked = byBioguide.get(bioguideId);
      if (linked) {
        counts.linkedById++;
        crosswalk.set(linked.id, legislator);
        const refreshable =
          !linked.metadata || priorMetadataSource(linked.metadata) === METADATA_SOURCE;
        if (!DRY_RUN && refreshable && linked.metadata !== metadata) {
          await session.run(
            "MATCH (e:Entity {id: $id}) SET e.metadata = $metadata, e.updatedAt = datetime()",
            { id: linked.id, metadata },
          );
          counts.metadataRefreshed++;
        }
        continue;
      }

      // Link an existing hand-added politician rather than duplicate it.
      // A state recorded on the entity (e.g. MEDSL-created candidates) must
      // agree with the member's state — guards same-name, different-person
      // links now that the range reaches back decades.
      const memberState = String(legislator.terms?.at(-1)?.state ?? "").toUpperCase();
      const nameMatches = existing.filter((e) => {
        if (e.bioguideId || !nameLooksLikeMember(e.name, name)) return false;
        const st = metadataState(e.metadata);
        return !st || st === memberState;
      });
      if (nameMatches.length > 1) {
        counts.ambiguous++;
        ambiguous.push(
          `${name} (${bioguideId}) — ${nameMatches.length} politician entities match by name`,
        );
        continue;
      }
      if (nameMatches.length === 1) {
        const match = nameMatches[0];
        if (!DRY_RUN) {
          await session.run(
            `MATCH (e:Entity {id: $id})
             SET e.bioguideId = $bioguideId,
                 e.metadata = CASE WHEN coalesce(e.metadata, '') = '' THEN $metadata ELSE e.metadata END,
                 e.updatedAt = datetime()`,
            { id: match.id, bioguideId, metadata },
          );
        }
        // Keep the local view consistent so a second legislator sharing
        // this name can't also claim the same entity in this run.
        match.bioguideId = bioguideId;
        byBioguide.set(bioguideId, match);
        crosswalk.set(match.id, legislator);
        counts.linkedByName++;
        continue;
      }

      const newId = randomUUID();
      crosswalk.set(newId, legislator);
      if (!DRY_RUN) {
        await session.run(
          `CREATE (e:Entity {
             id: $id, type: 'politician', name: $name,
             description: $description, biography: '', imageUrl: '',
             websiteUrl: '', xUrl: '', facebookUrl: '', instagramUrl: '',
             youtubeUrl: '', linkedinUrl: '', highlights: '',
             metadata: $metadata, bioguideId: $bioguideId,
             createdAt: datetime(), updatedAt: datetime()
           })`,
          {
            id: newId,
            name,
            description:
              "Member of the United States Congress — imported from the congress-legislators crosswalk.",
            metadata,
            bioguideId,
          },
        );
      }
      counts.created++;
    }

    // Crosswalk ids are always (re)written; profile URLs only fill blanks.
    const rows = [...crosswalk].map(([id, leg]) => ({
      id,
      ids: crosswalkIds(leg),
      urls: profileUrls(leg, social.get(leg.id?.bioguide)),
    }));
    if (!DRY_RUN) {
      for (const idx of ["icpsrId", "wikidataId", "govtrackId"]) {
        await session.run(`CREATE INDEX entity_${idx} IF NOT EXISTS FOR (e:Entity) ON (e.${idx})`);
      }
      for (let i = 0; i < rows.length; i += 500) {
        await session.run(
          `UNWIND $rows AS row
           MATCH (e:Entity {id: row.id})
           SET e += row.ids,
               e.websiteUrl = CASE WHEN coalesce(e.websiteUrl, '') = '' THEN row.urls.websiteUrl ELSE e.websiteUrl END,
               e.xUrl = CASE WHEN coalesce(e.xUrl, '') = '' THEN row.urls.xUrl ELSE e.xUrl END,
               e.facebookUrl = CASE WHEN coalesce(e.facebookUrl, '') = '' THEN row.urls.facebookUrl ELSE e.facebookUrl END,
               e.instagramUrl = CASE WHEN coalesce(e.instagramUrl, '') = '' THEN row.urls.instagramUrl ELSE e.instagramUrl END,
               e.youtubeUrl = CASE WHEN coalesce(e.youtubeUrl, '') = '' THEN row.urls.youtubeUrl ELSE e.youtubeUrl END,
               e.imageUrl = CASE WHEN coalesce(e.imageUrl, '') = '' THEN row.urls.imageUrl ELSE e.imageUrl END`,
          { rows: rows.slice(i, i + 500) },
        );
      }
    }
    counts.crosswalked = rows.length;

    console.log("\n--- Summary ---");
    console.log(`Crosswalk written:  ${counts.crosswalked}`);
    console.log(`Created:            ${counts.created}`);
    console.log(
      `Linked by bioguide: ${counts.linkedById}` +
        (counts.metadataRefreshed ? ` (${counts.metadataRefreshed} metadata refreshed)` : ""),
    );
    console.log(`Linked by name:     ${counts.linkedByName}`);
    console.log(`Ambiguous, skipped: ${counts.ambiguous}`);
    for (const a of ambiguous) console.log(`  - ${a}`);
    if (DRY_RUN) console.log("\nDRY RUN — no changes written.");
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
