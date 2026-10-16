// Imports current congressional committees + subcommittees and their
// membership from the public-domain unitedstates/congress-legislators repo.
//
//   committee      -> `organization` entity, keyed by its THOMAS id in the
//                     crosswalk (scheme congress_committee, e.g. "HSAG",
//                     subcommittee "HSAG15")
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

import { load as loadYaml } from "js-yaml";
import { connectPg } from "./lib/bulk.mjs";
import { addIdentifiers, entityIdMap, newEntity, upsertEdges, upsertEntities } from "./lib/entities.mjs";

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

  const pg = await connectPg();
  try {
    // Committees are found by their crosswalk id; new ones are created.
    let committees = await entityIdMap(pg, "congress_committee");
    const { rows: current } = committees.size
      ? await pg.query("select id, website_url from entities where id = any($1::uuid[])", [[...committees.values()]])
      : { rows: [] };
    const websiteById = new Map(current.map((r) => [r.id, r.website_url]));
    const created = orgs.filter((o) => !committees.has(o.committeeId)).map((o) => ({ ...o, id: newEntity({}).id }));
    await upsertEntities(pg, [
      ...created.map((o) => ({
        id: o.id,
        type: "organization",
        name: o.name,
        description: o.description,
        website_url: o.websiteUrl ?? "",
        metadata: '{"source":"unitedstates/congress-legislators"}',
      })),
      ...orgs
        .filter((o) => committees.has(o.committeeId))
        .map((o) => {
          const id = committees.get(o.committeeId);
          return { id, type: "organization", name: o.name, description: o.description, website_url: websiteById.get(id) || (o.websiteUrl ?? "") };
        }),
    ]);
    await addIdentifiers(pg, created.map((o) => ({ entityId: o.id, scheme: "congress_committee", value: o.committeeId })));
    committees = await entityIdMap(pg, "congress_committee");

    await upsertEdges(
      pg,
      orgs
        .filter((o) => o.parent && committees.has(o.parent))
        .map((o) => ({
          source_key: `committee-parent:${o.committeeId}`,
          source_entity_id: committees.get(o.committeeId),
          target_entity_id: committees.get(o.parent),
          rel_type: "member-of",
          label: "subcommittee of",
          role: "Subcommittee",
        })),
      { keepValidFrom: false },
    );

    const members = await entityIdMap(pg, "bioguide");
    const linkedSeats = seats.filter((s) => members.has(s.bioguide) && committees.has(s.committeeId));
    await upsertEdges(
      pg,
      linkedSeats.map((s) => ({
        source_key: `committee-seat:${s.committeeId}:${s.bioguide}`,
        source_entity_id: members.get(s.bioguide),
        target_entity_id: committees.get(s.committeeId),
        rel_type: s.relType,
        label: s.label,
        role: s.role,
        valid_from: TODAY,
        valid_to: "",
        notes: s.rank === null ? "" : JSON.stringify({ rank: s.rank }),
      })),
    );
    const linked = linkedSeats.length;
    // Seats that dropped out of the current file: close them, don't delete.
    const keys = seats.map((s) => `committee-seat:${s.committeeId}:${s.bioguide}`);
    const closed = await pg.query(
      `update entity_edges set valid_to = $2, updated_at = now()
       where source_key like 'committee-seat:%' and not (source_key = any($1::text[])) and valid_to = ''`,
      [keys, TODAY],
    );
    console.log(`  ${created.length} committees created`);
    console.log(`  ${linked}/${seats.length} seats linked to member entities`);
    console.log(`  ${closed.rowCount} former seats closed`);
    if (linked < seats.length) {
      console.log("  (unlinked seats = members without a bioguideId entity — run backfill:members)");
    }
  } finally {
    await pg.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
