// Replaces importer notes ("Election candidate — imported from MIT Election
// Lab.") in entities.description with a one-line description built from the
// entity's own records (scripts/lib/describe.mjs): its office, Congress terms,
// latest candidacy, or FEC committee id. Only those notes are touched; any
// written description is left alone. Entities with nothing to describe them
// get an empty description, which the profile hero omits.
//
// Usage:
//   npm run data:describe-entities -- --dry-run     # counts and a sample
//   npm run data:describe-entities
//   ENV_FILE=.env.cloud npm run data:describe-entities

import { connectPg, flag, loadEnv } from "./lib/bulk.mjs";
import { PROVENANCE_DESCRIPTIONS, describeCommittee, describePerson } from "./lib/describe.mjs";

const DRY_RUN = flag("dry-run");

loadEnv();
const pg = await connectPg();
try {
  const { rows } = await pg.query(
    `select e.id, e.name, e.type, e.metadata,
       coalesce((select json_agg(json_build_object(
           'office', el.office, 'jurisdiction', el.jurisdiction, 'won', c.won, 'party', c.party,
           'year', coalesce(el.cycle, extract(year from el.election_date)::int)))
         from candidacies c join elections el on el.id = c.election_id
         where c.candidate_entity_id = e.id), '[]') as candidacies
     from entities e
     where e.description = any($1::text[]) or e.description ~ '^\\d{4} candidate — imported by scaffold-cycle\\.$'`,
    [PROVENANCE_DESCRIPTIONS],
  );

  const updates = rows.map((r) => {
    let metadata = {};
    try {
      metadata = JSON.parse(r.metadata || "{}") ?? {};
    } catch {}
    const description =
      r.type === "company" || r.type === "organization"
        ? describeCommittee(metadata.fecCommitteeId)
        : describePerson({ metadata, candidacies: r.candidacies });
    return { id: r.id, name: r.name, description };
  });

  const empty = updates.filter((u) => !u.description).length;
  console.log(`${updates.length} importer-note descriptions; ${updates.length - empty} rewritten, ${empty} left empty`);
  for (const u of updates.filter((u, i) => i % Math.max(1, Math.floor(updates.length / 25)) === 0).slice(0, 25))
    console.log(`  ${u.name}: ${u.description || "(empty)"}`);

  if (!DRY_RUN) {
    for (let i = 0; i < updates.length; i += 500) {
      const batch = updates.slice(i, i + 500);
      await pg.query(
        `update entities e set description = u.description, updated_at = now()
         from jsonb_to_recordset($1::jsonb) as u(id uuid, description text) where e.id = u.id`,
        [JSON.stringify(batch.map(({ id, description }) => ({ id, description })))],
      );
    }
    console.log("written");
  }
} finally {
  await pg.end();
}
