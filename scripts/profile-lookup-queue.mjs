// The attribute lookup queue: curated people (a dossier in data/profiles, or
// an entry in the political-*.json collections) missing a core attribute in
// both their dossier facts and their Wikidata/Wikipedia traits. Each entry is
// a lookup to do while writing that person's dossier
// (docs/people/profile-guide.md, "Attribute lookups").
//
// Usage: node scripts/profile-lookup-queue.mjs [--write]   (--write saves data/profiles/lookup-queue.json)

import fs from "node:fs";
import { connectPg, flag, loadEnv } from "./lib/bulk.mjs";

const CORE = ["born", "sex", "ethnicity", "race", "citizenship", "religion"];
// entity_traits.trait → attribute key.
const TRAIT_KEY = { sex: "sex", birth_year: "born", race: "race", ancestry: "ethnicity", religion: "religion" };

loadEnv();
const pg = await connectPg();
try {
  const { rows: people } = await pg.query(
    `select e.id, e.name, e.type, (p.entity_id is not null) as dossier
     from entities e left join entity_profiles p on p.entity_id = e.id
     where e.type not in ('organization', 'company')
       and (p.entity_id is not null or e.metadata like '%"collection":%')
     order by e.name`,
  );
  const ids = people.map((p) => p.id);
  const { rows: facts } = await pg.query("select entity_id, fact_key from entity_facts where entity_id = any($1)", [ids]);
  // Former affiliations ("American former Protestants") don't count.
  const { rows: traits } = await pg.query(
    "select entity_id, trait from entity_traits where entity_id = any($1) and detail !~* '\\mformer\\M'",
    [ids],
  );
  const have = new Map(ids.map((id) => [id, new Set()]));
  for (const f of facts) have.get(f.entity_id).add(f.fact_key);
  for (const t of traits) if (TRAIT_KEY[t.trait]) have.get(t.entity_id).add(TRAIT_KEY[t.trait]);

  const queue = people
    .map((p) => ({ name: p.name, type: p.type, id: p.id, dossier: p.dossier, missing: CORE.filter((k) => !have.get(p.id).has(k)) }))
    .filter((p) => p.missing.length);
  for (const p of queue) console.log(`${p.name.padEnd(28)} ${p.dossier ? "dossier " : "        "} missing ${p.missing.join(", ")}`);
  console.log(`\n${queue.length} of ${people.length} curated people need lookups.`);
  if (flag("write")) {
    fs.writeFileSync("data/profiles/lookup-queue.json", JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), attributes: CORE, queue }, null, 2) + "\n");
    console.log("Wrote data/profiles/lookup-queue.json");
  }
} finally {
  await pg.end();
}
