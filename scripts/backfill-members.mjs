// Backfills a `politician` entity for every member of Congress who
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
// Every matched member also gets the full id crosswalk (icpsr, wikidata,
// fec_candidate, govtrack, opensecrets, ...) in entity_identifiers, and
// blank website / social / portrait fields are filled from the
// legislators-social-media file and unitedstates/images.
//
// ENV_FILE=.env.cloud targets cloud without swapping .env.local.

process.loadEnvFile(process.env.ENV_FILE || ".env.local");

import { randomUUID } from "node:crypto";
import { load as loadYaml } from "js-yaml";
import { chunk, connectPg } from "./lib/bulk.mjs";
import { addIdentifiers, describeConflict, identifierRows, upsertEntities } from "./lib/entities.mjs";
import { describePerson } from "./lib/describe.mjs";
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

  const pg = await connectPg();

  const counts = {
    created: 0,
    linkedById: 0,
    linkedByName: 0,
    metadataRefreshed: 0,
    ambiguous: 0,
  };
  const ambiguous = [];

  try {
    // One read of every politician entity up front, for the name-match
    // fallback.
    const { rows: existingRows } = await pg.query(
      `select e.id, e.name, e.metadata, i.value as bioguide_id
       from entities e
       left join entity_identifiers i on i.entity_id = e.id and i.scheme = 'bioguide'
       where e.type = 'politician'`,
    );
    const existing = existingRows.map((r) => ({
      id: r.id,
      name: r.name,
      bioguideId: r.bioguide_id ?? "",
      metadata: r.metadata ?? "",
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
          await pg.query("update entities set metadata = $2, updated_at = now() where id = $1", [linked.id, metadata]);
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
          // The Bioguide id itself is written with the rest of the crosswalk below.
          await pg.query(
            "update entities set metadata = $2, updated_at = now() where id = $1 and metadata = ''",
            [match.id, metadata],
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
        await upsertEntities(pg, [{
          id: newId,
          type: "politician",
          name,
          description: describePerson({ metadata: JSON.parse(metadata) }),
          metadata,
        }]);
      }
      counts.created++;
    }

    // Crosswalk ids are always (re)written; profile URLs only fill blanks.
    const rows = [...crosswalk].map(([id, leg]) => ({
      id,
      bioguideId: leg.id?.bioguide,
      ids: crosswalkIds(leg),
      urls: profileUrls(leg, social.get(leg.id?.bioguide)),
    }));
    if (!DRY_RUN) {
      const conflicts = await addIdentifiers(
        pg,
        rows.flatMap((row) => identifierRows(row.id, { bioguideId: row.bioguideId, ...row.ids })),
        { replace: true },
      );
      for (const c of conflicts) console.log(`  ${describeConflict(c)}`);
      for (const batch of chunk(rows, 500)) {
        await pg.query(
          `update entities e set
             website_url = case when e.website_url = '' then coalesce(u.website_url, '') else e.website_url end,
             x_url = case when e.x_url = '' then coalesce(u.x_url, '') else e.x_url end,
             facebook_url = case when e.facebook_url = '' then coalesce(u.facebook_url, '') else e.facebook_url end,
             instagram_url = case when e.instagram_url = '' then coalesce(u.instagram_url, '') else e.instagram_url end,
             youtube_url = case when e.youtube_url = '' then coalesce(u.youtube_url, '') else e.youtube_url end,
             image_url = case when e.image_url = '' then coalesce(u.image_url, '') else e.image_url end,
             updated_at = now()
           from jsonb_to_recordset($1::jsonb) as u(id uuid, website_url text, x_url text, facebook_url text,
                                                    instagram_url text, youtube_url text, image_url text)
           where e.id = u.id
             and ((e.website_url = '' and u.website_url is not null) or (e.x_url = '' and u.x_url is not null)
               or (e.facebook_url = '' and u.facebook_url is not null) or (e.instagram_url = '' and u.instagram_url is not null)
               or (e.youtube_url = '' and u.youtube_url is not null) or (e.image_url = '' and u.image_url is not null))`,
          [JSON.stringify(batch.map((row) => ({
            id: row.id,
            website_url: row.urls.websiteUrl || null,
            x_url: row.urls.xUrl || null,
            facebook_url: row.urls.facebookUrl || null,
            instagram_url: row.urls.instagramUrl || null,
            youtube_url: row.urls.youtubeUrl || null,
            image_url: row.urls.imageUrl || null,
          })))],
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
    await pg.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
