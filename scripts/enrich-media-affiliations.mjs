// Connects the isolated pundit/journalist nodes (~33% of the graph) to the
// outlets and shows already named in their own `description` text, e.g.
// "host and executive producer of Democracy Now!" -> a `hosts` edge to a
// Democracy Now! organization node (created if missing).
//
// Idempotent: edges are MERGEd on (person, org, relType); orgs are matched
// case-insensitively before creating. Anything whose description names no
// outlet stays isolated — a later Wikidata pass can pick those up.
//
// Usage: node scripts/enrich-media-affiliations.mjs [--dry-run]

process.loadEnvFile(".env.local");

import { randomUUID } from "node:crypto";
import neo4j from "neo4j-driver";

const DRY_RUN = process.argv.includes("--dry-run");

// [pattern, relType, label]. First match wins. The capture group is the
// outlet/show name; it's cleaned up by `normalizeOrg`. Deliberately
// conservative — a missed connection is fine, a junk org node is not.
const PATTERNS = [
  [/co-?founder of (?:the )?([^.,;]+)/i, "co-founded", "co-founded"],
  [/founder of (?:the )?([^.,;]+)/i, "founded", "founded"],
  [/co-?hosts? of (?:the )?([^.,;]+)/i, "co-hosts", "co-hosts"],
  [/(?:host|anchor)(?:s| and executive producer)? of (?:the )?([^.,;]+)/i, "hosts", "hosts"],
  [/executive producer of (?:the )?([^.,;]+)/i, "hosts", "hosts"],
  [/(?:columnist|correspondent|contributor|editor|analyst|reporter) (?:for|at) (?:the )?([^.,;]+)/i, "contributes-to", "contributes to"],
  [/associated with (?:the )?([^.,;]+)/i, "affiliated-with", "associated with"],
];

function normalizeOrg(raw) {
  let s = raw
    .trim()
    .replace(/^(a|an|the|his|her|their|its)\s+/i, "")
    .replace(/['"]/g, "")
    .replace(/\s+(podcast|programs?|newsletter|channel|show)$/i, "")
    .replace(/\s+and\s+the\s+.*/i, "") // "Daily Show and The Weekly" -> "Daily Show"
    .trim();
  if (s.length < 3 || s.length > 60) return null;
  if (!/^[A-Z]/.test(s)) return null; // a proper name, not a fragment
  if (/\b(programs?|shows?|commentary|media|politics|content)$/i.test(s)) return null;
  return s;
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
         RETURN e.id AS id, e.name AS name, e.description AS description`,
      )
    ).records.map((r) => ({
      id: r.get("id"),
      name: r.get("name"),
      description: r.get("description") ?? "",
    }));
    console.log(`${isolated.length} isolated pundits/journalists`);

    const existingOrgs = (
      await session.run("MATCH (e:Entity {type: 'organization'}) RETURN e.id AS id, e.name AS name")
    ).records.map((r) => ({ id: r.get("id"), name: r.get("name") }));
    const orgIdByLower = new Map(existingOrgs.map((o) => [o.name.toLowerCase(), o.id]));

    let matched = 0;
    let orgsCreated = 0;
    const plan = [];

    for (const person of isolated) {
      let hit = null;
      for (const [re, relType, label] of PATTERNS) {
        const m = person.description.match(re);
        if (m) {
          const org = normalizeOrg(m[1]);
          if (org) {
            hit = { org, relType, label };
            break;
          }
        }
      }
      if (!hit) continue;
      matched++;
      plan.push({ person, ...hit });
    }

    console.log(`${matched} matched an outlet in their description`);
    if (DRY_RUN) {
      for (const p of plan.slice(0, 40)) {
        console.log(`  ${p.person.name}  --${p.label}-->  ${p.org}`);
      }
      if (plan.length > 40) console.log(`  … and ${plan.length - 40} more`);
      console.log("\nDRY RUN — no writes.");
      return;
    }

    for (const { person, org, relType, label } of plan) {
      let orgId = orgIdByLower.get(org.toLowerCase());
      if (!orgId) {
        orgId = randomUUID();
        await session.run(
          `CREATE (e:Entity {
             id: $id, type: 'organization', name: $name,
             description: 'Media outlet / show.', biography: '', imageUrl: '',
             websiteUrl: '', xUrl: '', facebookUrl: '', instagramUrl: '',
             youtubeUrl: '', linkedinUrl: '', highlights: '', metadata: '{}',
             createdAt: datetime(), updatedAt: datetime()
           })`,
          { id: orgId, name: org },
        );
        orgIdByLower.set(org.toLowerCase(), orgId);
        orgsCreated++;
      }
      await session.run(
        `MATCH (p:Entity {id: $personId}), (o:Entity {id: $orgId})
         MERGE (p)-[r:RELATED_TO {sourceKey: $key}]->(o)
         ON CREATE SET r.id = $edgeId, r.createdAt = datetime()
         SET r.label = $label, r.relType = $relType, r.role = '',
             r.validFrom = '', r.validTo = '', r.notes = 'Inferred from profile description.',
             r.sourceRecordId = '', r.updatedAt = datetime()`,
        {
          personId: person.id,
          orgId,
          key: `${person.id}:${relType}:${org.toLowerCase()}`,
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
      `\nConnected ${plan.length} people (${orgsCreated} new outlet nodes). ` +
        `Still isolated: ${stillIsolated}.`,
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
