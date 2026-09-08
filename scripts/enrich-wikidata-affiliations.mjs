// Second pass at connecting the isolated pundit/journalist nodes: resolve
// each name to a Wikidata QID via the Wikipedia REST summary endpoint
// (redirect-aware, lightly rate-limited), then one SPARQL query fetches
// their employer (P108), owner-of (P1830, founders) and member-of (P463)
// organizations. Complements enrich-media-affiliations.mjs (description
// text only).
//
// Idempotent: edges MERGE on (person, org, relType); orgs match
// case-insensitively before creating. QID lookups cached under
// backups/.wikidata-cache.json.
//
// Usage: node scripts/enrich-wikidata-affiliations.mjs [--dry-run] [--limit N]

process.loadEnvFile(".env.local");

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import neo4j from "neo4j-driver";

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT_ARG = process.argv.indexOf("--limit");
const LIMIT = LIMIT_ARG > -1 ? Number(process.argv[LIMIT_ARG + 1]) : Infinity;

const CACHE_FILE = path.join("backups", ".wikidata-cache.json");
const REST_DELAY_MS = 60;
const UA = "worldview-people-enrichment/1.0 (https://github.com/; local dev)";

// P108 employer, P1830 owner-of (founders). P463 (member-of) is skipped —
// it's mostly fraternities, honour societies and "the press corps".
const PROP_MAP = {
  P108: ["works-for", "works for"],
  P1830: ["founded", "founded"],
};
const MAX_ORGS_PER_PERSON = 5;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  } catch {
    return { qid: {} };
  }
}
let cache = loadCache();
function saveCache() {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

async function resolveQid(name) {
  if (cache.qid[name] !== undefined) return cache.qid[name];
  const url =
    "https://en.wikipedia.org/api/rest_v1/page/summary/" +
    encodeURIComponent(name.replace(/ /g, "_"));
  let qid = null;
  let transient = false;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) {
      const data = await res.json();
      qid = data.wikibase_item ?? null;
    } else if (res.status === 429 || res.status >= 500) {
      transient = true;
      console.warn(`  ! ${name}: HTTP ${res.status} (will retry on re-run)`);
      await sleep(2000);
    } else if (res.status !== 404) {
      console.warn(`  ! ${name}: HTTP ${res.status}`);
    }
  } catch (err) {
    transient = true;
    console.warn(`  ! ${name}: ${err.message}`);
  }
  await sleep(REST_DELAY_MS);
  if (!transient) cache.qid[name] = qid; // don't cache transient failures
  return qid;
}

async function sparqlOrgs(qids) {
  // person -> [{ orgName, relType, label }]
  const out = new Map();
  for (let i = 0; i < qids.length; i += 120) {
    const batch = qids.slice(i, i + 120);
    const values = batch.map((q) => `wd:${q}`).join(" ");
    const query = `
      SELECT ?person ?prop ?orgLabel WHERE {
        VALUES ?person { ${values} }
        { ?person wdt:P108 ?org. BIND("P108" AS ?prop) }
        UNION { ?person wdt:P1830 ?org. BIND("P1830" AS ?prop) }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }`;
    const res = await fetch("https://query.wikidata.org/sparql", {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/sparql-results+json",
      },
      body: "query=" + encodeURIComponent(query),
    });
    if (!res.ok) {
      console.warn(`  ! SPARQL batch ${i}: HTTP ${res.status}`);
      continue;
    }
    const data = await res.json();
    for (const row of data.results?.bindings ?? []) {
      const person = row.person.value.split("/").pop();
      const orgName = row.orgLabel?.value;
      if (!orgName || /^Q\d+$/.test(orgName)) continue; // unlabeled
      const [relType, label] = PROP_MAP[row.prop.value];
      const list = out.get(person) ?? out.set(person, []).get(person);
      list.push({ orgName, relType, label });
    }
    await sleep(500);
  }
  return out;
}

async function main() {
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
  );
  const session = driver.session();
  try {
    const isolated = (
      await session.run(
        `MATCH (e:Entity)
         WHERE e.type IN ['pundit','journalist'] AND COUNT{(e)--()} = 0
         RETURN e.id AS id, e.name AS name ORDER BY e.name`,
      )
    ).records
      .map((r) => ({ id: r.get("id"), name: r.get("name") }))
      .slice(0, LIMIT);
    console.log(`${isolated.length} isolated pundits/journalists`);

    const existingOrgs = (
      await session.run("MATCH (e:Entity {type: 'organization'}) RETURN e.id AS id, e.name AS name")
    ).records.map((r) => ({ id: r.get("id"), name: r.get("name") }));
    const orgIdByLower = new Map(existingOrgs.map((o) => [o.name.toLowerCase(), o.id]));

    const qidByPerson = new Map();
    for (const p of isolated) {
      const qid = await resolveQid(p.name);
      if (qid) qidByPerson.set(qid, p);
    }
    saveCache();
    console.log(`resolved ${qidByPerson.size}/${isolated.length} to a Wikidata QID`);

    const orgsByQid = await sparqlOrgs([...qidByPerson.keys()]);

    const writes = [];
    const seen = new Set();
    for (const [qid, orgs] of orgsByQid) {
      const person = qidByPerson.get(qid);
      let perPerson = 0;
      for (const { orgName, relType, label } of orgs) {
        if (orgName.length > 80 || perPerson >= MAX_ORGS_PER_PERSON) continue;
        const k = `${person.id}:${relType}:${orgName.toLowerCase()}`;
        if (seen.has(k)) continue;
        seen.add(k);
        perPerson++;
        writes.push({ person, orgName, relType, label });
      }
    }
    console.log(`${writes.length} org edges to create for ${orgsByQid.size} people`);

    if (DRY_RUN) {
      for (const w of writes.slice(0, 60)) console.log(`  ${w.person.name}  --${w.label}-->  ${w.orgName}`);
      if (writes.length > 60) console.log(`  … and ${writes.length - 60} more`);
      console.log("\nDRY RUN — no writes.");
      return;
    }

    let orgsCreated = 0;
    for (const { person, orgName, relType, label } of writes) {
      let orgId = orgIdByLower.get(orgName.toLowerCase());
      if (!orgId) {
        orgId = randomUUID();
        await session.run(
          `CREATE (e:Entity {
             id: $id, type: 'organization', name: $name,
             description: 'Organization (Wikidata).', biography: '', imageUrl: '',
             websiteUrl: '', xUrl: '', facebookUrl: '', instagramUrl: '',
             youtubeUrl: '', linkedinUrl: '', highlights: '', metadata: '{}',
             createdAt: datetime(), updatedAt: datetime()
           })`,
          { id: orgId, name: orgName },
        );
        orgIdByLower.set(orgName.toLowerCase(), orgId);
        orgsCreated++;
      }
      await session.run(
        `MATCH (p:Entity {id: $personId}), (o:Entity {id: $orgId})
         MERGE (p)-[r:RELATED_TO {sourceKey: $key}]->(o)
         ON CREATE SET r.id = $edgeId, r.createdAt = datetime()
         SET r.label = $label, r.relType = $relType, r.role = '',
             r.validFrom = '', r.validTo = '', r.notes = 'From Wikidata.',
             r.sourceRecordId = '', r.updatedAt = datetime()`,
        {
          personId: person.id,
          orgId,
          key: `${person.id}:${relType}:${orgName.toLowerCase()}`,
          edgeId: randomUUID(),
          label,
          relType,
        },
      );
    }

    const stillIsolated = (
      await session.run(
        `MATCH (e:Entity)
         WHERE e.type IN ['pundit','journalist'] AND COUNT{(e)--()} = 0
         RETURN count(e) AS c`,
      )
    ).records[0]
      .get("c")
      .toNumber();
    console.log(
      `\nCreated ${writes.length} edges (${orgsCreated} new org nodes). Still isolated: ${stillIsolated}.`,
    );
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
