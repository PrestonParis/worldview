// Finds and merges duplicate entities (scripts/lib/entities.mjs mergeEntity).
//
// Two kinds of duplicate are reported:
//   id     an entity whose metadata names an FEC candidate or committee id
//          that the crosswalk already gives to another entity. The same
//          FEC filer twice, so --apply merges these.
//   name   a politician without a Bioguide or Open States id whose name
//          matches a member of Congress who has one (and whose recorded
//          state, if any, agrees). Reported only; merge a reviewed pair
//          with --merge.
//
// Usage:
//   node scripts/merge-entities.mjs                         # report
//   node scripts/merge-entities.mjs --apply                 # merge the "id" duplicates
//   node scripts/merge-entities.mjs --merge=<fromId>:<intoId>
//   node scripts/merge-entities.mjs --unmerge=<fromId>     # restore a merged entity
//   ENV_FILE=.env.cloud node scripts/merge-entities.mjs ...
//
// Run scripts/sync-graph.mjs afterwards to update Neo4j.

import { arg, connectPg, flag, loadEnv } from "./lib/bulk.mjs";
import { mergeEntity, unmergeEntity } from "./lib/entities.mjs";
import { normalizeNameTokens } from "./lib/members.mjs";

loadEnv();
const pg = await connectPg();
try {
  const manual = arg("merge", "");
  const undo = arg("unmerge", "");
  if (undo) {
    await unmergeEntity(pg, undo);
    console.log(`restored ${undo}`);
  } else if (manual) {
    const [from, into] = manual.split(":");
    await mergeEntity(pg, from, into, "manual");
    console.log(`merged ${from} into ${into}`);
  } else {
    let { rows: byId } = await pg.query(
      `with meta as (
         select id, name, type,
                case when metadata ~ '^\\s*\\{' then metadata::jsonb end as m
         from entities
       )
       select d.id as from_id, d.name as from_name, k.id as into_id, k.name as into_name, i.scheme, i.value,
              exists (
                select 1 from entity_identifiers a join entity_identifiers b on b.scheme = a.scheme and b.entity_id = k.id
                where a.entity_id = d.id and a.value <> b.value
                  and a.scheme not in ('fec_candidate', 'fec_committee', 'lda_client', 'lda_registrant')
              ) as different_people
       from meta d
       join entity_identifiers i
         on (i.scheme = 'fec_candidate' and i.value = d.m->>'fecCandidateId')
         or (i.scheme = 'fec_committee' and i.value = d.m->>'fecCommitteeId')
       join entities k on k.id = i.entity_id
       where i.entity_id <> d.id`,
    );
    const wrongIds = byId.filter((r) => r.different_people);
    byId = byId.filter((r) => !r.different_people);
    console.log(`${byId.length} duplicates by FEC id`);
    for (const r of byId) console.log(`  ${r.from_name} (${r.from_id}) -> ${r.into_name} (${r.into_id})  ${r.scheme} ${r.value}`);
    if (wrongIds.length) {
      console.log(`\n${wrongIds.length} entities whose metadata names another person's FEC id (different people; fix the metadata)`);
      for (const r of wrongIds) console.log(`  ${r.from_name} (${r.from_id}) has ${r.scheme} ${r.value}, which belongs to ${r.into_name} (${r.into_id})`);
    }

    const { rows: politicians } = await pg.query(
      `select e.id, e.name, e.metadata, i.value as bioguide
       from entities e
       left join entity_identifiers i on i.entity_id = e.id and i.scheme = 'bioguide'
       where e.type = 'politician'
         -- State officials from Open States are their own people even when
         -- they share a member's name.
         and not exists (select 1 from entity_identifiers o where o.entity_id = e.id and o.scheme = 'openstates')`,
    );
    const key = (name) => normalizeNameTokens(name).join(" ");
    const state = (metadata) => {
      try {
        return String(JSON.parse(metadata || "{}").state ?? "").toUpperCase();
      } catch {
        return "";
      }
    };
    const members = new Map();
    for (const p of politicians.filter((p) => p.bioguide)) members.set(key(p.name), [...(members.get(key(p.name)) ?? []), p]);
    const byName = [];
    for (const p of politicians.filter((p) => !p.bioguide)) {
      const matches = (members.get(key(p.name)) ?? []).filter((m) => !state(p.metadata) || !state(m.metadata) || state(p.metadata) === state(m.metadata));
      if (matches.length === 1) byName.push({ from: p, into: matches[0] });
    }
    console.log(`\n${byName.length} possible duplicates by name (review, then --merge=<from>:<into>)`);
    for (const { from, into } of byName.slice(0, 50)) console.log(`  ${from.name} (${from.id}) -> ${into.name} (${into.id}, ${into.bioguide})`);
    if (byName.length > 50) console.log(`  … and ${byName.length - 50} more`);

    if (flag("apply")) {
      const done = new Set();
      for (const r of byId) {
        if (done.has(r.from_id) || done.has(r.into_id)) continue;
        try {
          await mergeEntity(pg, r.from_id, r.into_id, `same ${r.scheme} ${r.value}`);
          done.add(r.from_id);
        } catch (err) {
          // Two members with their own Bioguide ids: the FEC id in metadata
          // is wrong, not the entities.
          console.log(`  skipped ${r.from_name} -> ${r.into_name}: ${err.message}`);
        }
      }
      console.log(`\nmerged ${done.size} entities`);
    }
  }
} finally {
  await pg.end();
}
