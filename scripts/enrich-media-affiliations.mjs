// Connects the isolated pundit/journalist nodes (~33% of the graph) to the
// outlets and shows already named in their own `description` text, e.g.
// "host and executive producer of Democracy Now!" -> a `hosts` edge to a
// Democracy Now! organization node (created if missing).
//
// Idempotent: edges upsert on (person, org, relType); orgs are matched
// case-insensitively before creating. Anything whose description names no
// outlet stays isolated — a later Wikidata pass can pick those up.
//
// Usage: node scripts/enrich-media-affiliations.mjs [--dry-run]

process.loadEnvFile(process.env.ENV_FILE || ".env.local");

import { randomUUID } from "node:crypto";
import { connectPg } from "./lib/bulk.mjs";
import { upsertEdges, upsertEntities } from "./lib/entities.mjs";

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
  const pg = await connectPg();
  try {
    const { rows: isolated } = await pg.query(
      `select e.id, e.name, e.description from entities e
         where e.type in ('pundit', 'journalist')
           and not exists (select 1 from entity_edges r where r.source_entity_id = e.id or r.target_entity_id = e.id)`,
    );
    console.log(`${isolated.length} isolated pundits/journalists`);

    const { rows: existingOrgs } = await pg.query("select id, name from entities where type = 'organization'");
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
        await upsertEntities(pg, [{ id: orgId, type: "organization", name: org, description: "Media outlet / show.", metadata: "{}" }]);
        orgIdByLower.set(org.toLowerCase(), orgId);
        orgsCreated++;
      }
      await upsertEdges(
        pg,
        [
          {
            source_key: `${person.id}:${relType}:${org.toLowerCase()}`,
            source_entity_id: person.id,
            target_entity_id: orgId,
            label,
            rel_type: relType,
            notes: "Inferred from profile description.",
          },
        ],
        { keepValidFrom: false },
      );
    }

    const stillIsolated = (await pg.query(`select count(*)::int as c from (
         select e.id, e.name, e.description from entities e
         where e.type in ('pundit', 'journalist')
           and not exists (select 1 from entity_edges r where r.source_entity_id = e.id or r.target_entity_id = e.id)
       ) t`)).rows[0].c;

    console.log(
      `\nConnected ${plan.length} people (${orgsCreated} new outlet nodes). ` +
        `Still isolated: ${stillIsolated}.`,
    );
  } finally {
    await pg.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
