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
// --people runs the wider same-person pass (scripts/lib/duplicates.mjs):
//   people   politicians whose names agree after normalization and who
//            share a state from any source (metadata, Open States office,
//            FEC candidate record, election candidacy) — an FEC filer, a
//            Wikipedia race entry and a roster record for one person
//   wikidata an FEC candidate id Wikidata gives to a member of Congress we
//            hold under another name ("Marshall Sanford" = Mark Sanford),
//            when the last names agree
//   reviewed commentators who also have candidate or member records, shows
//            filed under their host's name, and hand-entered organizations
//            duplicating their FEC record (REVIEWED below)
//   schedule-a FEC Schedule A contributors held twice, or once as a
//            "company" and once as the 2026 candidate of the same name
//
// Usage:
//   node scripts/merge-entities.mjs                         # report
//   node scripts/merge-entities.mjs --apply                 # merge the "id" duplicates
//   node scripts/merge-entities.mjs --merge=<fromId>:<intoId>
//   node scripts/merge-entities.mjs --unmerge=<fromId>     # restore a merged entity
//   node scripts/merge-entities.mjs --people [--apply]     # same-person pass
//   ENV_FILE=.env.cloud node scripts/merge-entities.mjs ...
//
// Run scripts/sync-graph.mjs afterwards to update Neo4j.

import fs from "node:fs";
import { arg, connectPg, flag, loadEnv, parseCsv } from "./lib/bulk.mjs";
import { mergeEntity, unmergeEntity } from "./lib/entities.mjs";
import { normalizeNameTokens } from "./lib/members.mjs";
import { clusterConflict, clusterPeople, parseName, stateCode } from "./lib/duplicates.mjs";

// Same person under two types, reviewed by hand. `into` names the type
// kept: commentators stay commentators (their curated profile and lean),
// except where the person now holds or seeks office.
const REVIEWED = [
  ...["Andrew Yang", "Cenk Uygur", "Claire McCaskill", "Cornel West", "George Conway", "Joe Scarborough", "Kshama Sawant",
    "Larry Elder", "Laura Loomer", "Marianne Williamson", "Matt Gaetz", "Ralph Nader", "Trey Gowdy"].map((name) => ({ name, into: "pundit", from: ["politician"] })),
  { name: "Tulsi Gabbard", into: "politician", from: ["pundit"] },
  { name: "Vivek Ramaswamy", into: "politician", from: ["politician", "pundit"] },
  // A show filed as an organization under its host's name.
  ...["Benjamin Dixon", "Jimmy Dore", "Shawn Ryan"].map((name) => ({ name, into: "pundit", from: ["organization"] })),
  // Hand-entered organizations and their FEC filer record.
  ...["Republican National Committee", "Defending Democracy Together"].map((name) => ({ name, into: "organization", from: ["organization"], curated: true })),
];

// Which of a cluster's records survives: the one with the strongest record.
// Open States lists only current officeholders, so its record (a governor
// who once sat in Congress) outranks the Bioguide one.
function rank(r) {
  if (r.openstates) return 0;
  if (r.bioguide) return 1;
  if (!r.imported) return 2;
  return { "wikipedia-races": 3, medsl: 4, "fec-bulk": 5 }[r.imported] ?? 6;
}

async function peoplePass(pg, apply) {
  const { rows } = await pg.query(`
    select e.id, e.name, e.description, e.metadata,
      (select value from entity_identifiers i where i.entity_id = e.id and i.scheme = 'bioguide') as bioguide,
      (select value from entity_identifiers i where i.entity_id = e.id and i.scheme = 'openstates') as openstates,
      (select value from entity_identifiers i where i.entity_id = e.id and i.scheme = 'wikidata') as wikidata,
      array(select o.state from entity_offices o where o.entity_id = e.id and o.state is not null) as office_states,
      exists (select 1 from entity_offices o where o.entity_id = e.id and o.chamber = 'executive') as executive,
      array(select c.state from entity_identifiers i join fec_candidates c on c.candidate_id = i.value
            where i.entity_id = e.id and i.scheme = 'fec_candidate') as fec_states,
      array(select el.jurisdiction from candidacies cd join elections el on el.id = cd.election_id
            where cd.candidate_entity_id = e.id) as election_states,
      array(select value from entity_identifiers i where i.entity_id = e.id and i.scheme = 'fec_candidate') as fec_ids
    from entities e where e.type = 'politician'`);
  const records = rows.map((r) => {
    let meta = {};
    try { meta = JSON.parse(r.metadata || "{}"); } catch {}
    const states = new Set(
      [meta.state, meta.office, r.description, ...r.office_states, ...r.fec_states, ...r.election_states].map(stateCode).filter(Boolean),
    );
    return { id: r.id, name: r.name, bioguide: r.bioguide, openstates: r.openstates, wikidata: r.wikidata, fecIds: r.fec_ids, executive: r.executive,
      imported: meta.importedFrom ?? meta.source ?? null, states };
  });
  // Open States' Wikipedia link for each current official, resolved through
  // the traits import's title cache (scripts/import-entity-traits.mjs), so a
  // governor who served in Congress can be matched to their member record.
  const titleQid = (() => {
    try { return JSON.parse(fs.readFileSync("backups/.traits-cache.json", "utf8")).title ?? {}; } catch { return {}; }
  })();
  const officialStates = new Set(records.filter((r) => r.openstates).flatMap((r) => [...r.states]).map((s) => s.toLowerCase()));
  const articleByOpenStates = new Map();
  for (const st of officialStates) {
    const res = await fetch(`https://data.openstates.org/people/current/${st}.csv`).catch(() => null);
    if (!res?.ok) continue;
    for (const row of parseCsv(await res.text())) {
      const article = `${row.links ?? ""};${row.sources ?? ""}`.match(/https?:\/\/en\.wikipedia\.org\/wiki\/([^;#?\s]+)/)?.[1];
      if (article) articleByOpenStates.set(row.id, decodeURIComponent(article).replace(/_/g, " "));
    }
  }
  for (const r of records) if (r.openstates) r.articleQid = titleQid[articleByOpenStates.get(r.openstates)] ?? null;

  // A record with no state joins only a member of Congress, and never as
  // a state legislator.
  const clusters = clusterPeople(records, { noStateOk: (r, other) => !r.openstates && Boolean(other.bioguide) });
  const plans = [];
  const refused = [];
  for (const members of clusters) {
    const conflict = clusterConflict(members);
    if (conflict) { refused.push({ members, conflict }); continue; }
    const [into, ...from] = [...members].sort((a, b) => rank(a) - rank(b));
    plans.push({ into, from, reason: "same name and state" });
  }

  // Wikidata's FEC ids for members held under another name.
  const res = await fetch("https://query.wikidata.org/sparql", {
    method: "POST",
    headers: { "User-Agent": "worldview-merge/1.0 (https://worldviewpolitics.com)", "Content-Type": "application/x-www-form-urlencoded", Accept: "application/sparql-results+json" },
    body: "query=" + encodeURIComponent("SELECT ?p ?fec WHERE { ?p wdt:P1839 ?fec; wdt:P31 wd:Q5 }"),
  });
  const qidByFec = new Map((await res.json()).results.bindings.map((b) => [b.fec.value, b.p.value.split("/").pop()]));
  const byQid = new Map(records.filter((r) => r.wikidata && r.bioguide).map((r) => [r.wikidata, r]));
  const planned = new Set(plans.flatMap((p) => [p.into.id, ...p.from.map((f) => f.id)]));
  for (const r of records) {
    if (r.bioguide || r.openstates || planned.has(r.id)) continue;
    const member = r.fecIds.map((f) => byQid.get(qidByFec.get(f))).find(Boolean);
    if (!member || member.id === r.id) continue;
    if (parseName(member.name)?.last !== parseName(r.name)?.last) continue; // a bad Wikidata link, not a nickname
    plans.push({ into: member, from: [r], reason: "Wikidata FEC id" });
  }

  console.log(`${plans.length} same-person groups (${plans.reduce((n, p) => n + p.from.length, 0)} records to fold in); ${refused.length} refused`);
  if (arg("plan-out", "")) {
    fs.writeFileSync(arg("plan-out", ""), plans.map((p) => `${p.reason}\t${p.into.name}\t${p.into.bioguide ?? p.into.openstates ?? p.into.imported ?? "hand"}\t${[...p.into.states].join(",")}\t${p.from.map((f) => `${f.name} [${f.imported ?? "hand"}] ${[...f.states].join(",")}`).join(" | ")}`).join("\n"));
  }
  for (const p of plans.slice(0, 40)) console.log(`  ${p.from.map((f) => `${f.name} [${f.imported ?? "hand"}]`).join(", ")} -> ${p.into.name} [${p.into.bioguide ?? p.into.openstates ?? p.into.imported ?? "hand"}]  (${p.reason})`);
  if (plans.length > 40) console.log(`  … and ${plans.length - 40} more`);
  for (const r of refused.slice(0, 10)) console.log(`  refused ${r.members.map((m) => m.name).join(" / ")}: ${r.conflict}`);

  // Reviewed cross-type pairs and Schedule A duplicates.
  const extra = [];
  for (const rule of REVIEWED) {
    const { rows: found } = await pg.query(
      `select e.id, e.type, e.metadata,
         exists (select 1 from entity_identifiers i where i.entity_id = e.id and i.scheme = 'openstates') as state_legislator,
         exists (select 1 from entity_identifiers i where i.entity_id = e.id and i.scheme = 'fec_committee') as fec
       from entities e where lower(e.name) = lower($1)`,
      [rule.name],
    );
    const candidates = found.filter((f) => !f.state_legislator);
    const into = candidates.find((f) => f.type === rule.into && (!rule.curated || !f.fec)) ?? null;
    const from = candidates.filter((f) => f !== into && rule.from.includes(f.type));
    if (into && from.length) extra.push({ into, from, reason: "reviewed" });
  }
  const { rows: scheduleA } = await pg.query(`
    select array_agg(e.id order by (e.type = 'politician') desc, e.created_at) as ids
    from entities e
    where e.type in ('company', 'politician')
      and (e.metadata like '%openfec-schedule_a%' or e.metadata like '%scaffold-cycle%')
    group by e.name having count(*) > 1 and bool_or(e.metadata like '%openfec-schedule_a%')
      and count(*) filter (where e.type = 'politician') <= 1`);
  for (const r of scheduleA) extra.push({ into: { id: r.ids[0] }, from: r.ids.slice(1).map((id) => ({ id })), reason: "schedule A" });
  console.log(`${extra.length} reviewed or Schedule A groups`);

  if (!apply) return;
  let merged = 0;
  const failed = [];
  for (const plan of [...plans, ...extra]) {
    for (const f of plan.from) {
      try {
        await mergeEntity(pg, f.id, plan.into.id, plan.reason);
        merged++;
      } catch (err) {
        failed.push(`${f.name ?? f.id} -> ${plan.into.name ?? plan.into.id}: ${err.message}`);
      }
    }
  }
  console.log(`\nmerged ${merged} entities; ${failed.length} refused`);
  for (const f of failed.slice(0, 20)) console.log(`  ${f}`);
}

loadEnv();
const pg = await connectPg();
try {
  const manual = arg("merge", "");
  const undo = arg("unmerge", "");
  if (flag("people")) {
    await peoplePass(pg, flag("apply"));
  } else if (undo) {
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
