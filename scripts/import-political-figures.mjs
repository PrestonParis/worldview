// Loads data/political-figures.json into the graph: curated profiles
// (description, biography, dated highlights, aliases, sources) for people and
// organizations, plus the typed connections between them.
//
// Existing entities are matched by name (case-insensitive) and only their
// empty fields are filled — pass --force to overwrite description/biography/
// highlights with the curated text. Curated metadata keys (born, died,
// aliases, sources, …) are merged over whatever metadata is already there.
// Connections to names that exist neither in the file nor the graph are
// skipped with a warning rather than creating blank stubs.
//
// Idempotent: entities MERGE on a name key, edges MERGE on a sourceKey.
//
// Usage: node scripts/import-political-figures.mjs [--dry-run] [--force]
//        node scripts/import-political-figures.mjs --docs   (regenerate docs/political-figures.md, no DB)

import fs from "node:fs";
import { randomUUID } from "node:crypto";

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const DOCS = process.argv.includes("--docs");
const DATA = JSON.parse(fs.readFileSync("data/political-figures.json", "utf8"));
const DOCS_PATH = "docs/political-figures.md";

// Mirrors the limits in src/lib/validation/entity.ts.
const LIMITS = { description: 2000, biography: 12000, highlights: 2000, metadata: 4000 };

function profileFields(profile) {
  const metadata = { ...profile.metadata, sources: profile.sources ?? [], collection: DATA.collection };
  const fields = {
    description: profile.description ?? "",
    biography: profile.biography ?? "",
    highlights: (profile.highlights ?? []).join("\n"),
    metadata,
  };
  for (const [key, limit] of Object.entries(LIMITS)) {
    const length = key === "metadata" ? JSON.stringify(metadata).length : fields[key].length;
    if (length > limit) throw new Error(`${profile.name}: ${key} is ${length} chars (max ${limit})`);
  }
  return fields;
}

function writeDocs() {
  const anchor = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const section = (profile) => {
    const meta = profile.metadata ?? {};
    const facts = [
      meta.aliases?.length ? `**Also known as:** ${meta.aliases.join(", ")}` : "",
      meta.born ? `**Born:** ${meta.born}` : "",
      meta.died ? `**Died:** ${meta.died}` : "",
      meta.founded ? `**Founded:** ${meta.founded}` : "",
    ].filter(Boolean);
    const links = DATA.connections
      .filter((c) => c.source === profile.name || c.target === profile.name)
      .map((c) => `- ${c.source} → *${c.relType}* → ${c.target}${c.role ? ` — ${c.role}` : ""}`);
    return [
      `### ${profile.name}`,
      "",
      `*${profile.description}*`,
      facts.length ? `\n${facts.join(" · ")}` : "",
      "",
      profile.biography,
      "",
      "**Notable events**",
      "",
      ...profile.highlights.map((h) => `- ${h}`),
      ...(links.length ? ["", "**Connections**", "", ...links] : []),
      "",
      "**Sources:** " + profile.sources.map((url) => `<${url}>`).join(" · "),
      "",
    ].join("\n");
  };

  const md = [
    "# Political figures — curated profiles",
    "",
    "Generated from `data/political-figures.json` by `node scripts/import-political-figures.mjs --docs`.",
    "Edit the JSON, not this file. Profiles appear on `/data/entities/[id]` (biography, highlights,",
    "aliases, born/died, sources) and in the `/people` graph via their connections.",
    "",
    "## Adding a figure",
    "",
    "1. Add an entry to `people` (or `organizations`) with `description`, `biography`, dated",
    "   `highlights` (`\"YYYY — event\"`), `metadata`, and at least one `sources` URL.",
    "2. Add `connections` using slugs from `src/lib/relationships.ts`.",
    "3. `node scripts/import-political-figures.mjs --dry-run`, then without `--dry-run`",
    "   (`ENV_FILE=.env.cloud` for production), then `--docs`.",
    "",
    "Every claim should be dated and traceable to a listed source. Where the public record",
    "is incomplete (e.g. a pending charge), the write-up says so rather than guessing.",
    "",
    "## Index",
    "",
    "| Name | Kind | Summary |",
    "|---|---|---|",
    ...DATA.people.map((p) => `| [${p.name}](#${anchor(p.name)}) | ${p.type} | ${p.description.replaceAll("|", "\\|")} |`),
    ...DATA.organizations.map((o) => `| [${o.name}](#${anchor(o.name)}) | organization | ${o.description.replaceAll("|", "\\|")} |`),
    "",
    "## People",
    "",
    ...DATA.people.map(section),
    "## Organizations",
    "",
    ...DATA.organizations.map(section),
  ].join("\n");
  fs.writeFileSync(DOCS_PATH, md);
  console.log(`Wrote ${DOCS_PATH} (${DATA.people.length} people, ${DATA.organizations.length} organizations).`);
}

async function main() {
  // Validate everything before touching the DB.
  const profiles = [
    ...DATA.organizations.map((o) => ({ ...o, type: "organization" })),
    ...DATA.people,
  ].map((p) => ({ ...p, fields: profileFields(p) }));

  if (DOCS) return writeDocs();

  process.loadEnvFile(process.env.ENV_FILE || ".env.local");
  const { default: neo4j } = await import("neo4j-driver");
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
  );
  const session = driver.session();
  try {
    const existing = (
      await session.run(
        `MATCH (e:Entity) RETURN e.id AS id, e.name AS name, e.description AS description,
           e.biography AS biography, e.highlights AS highlights, e.metadata AS metadata`,
      )
    ).records.map((r) => r.toObject());
    const byLowerName = new Map(existing.map((e) => [e.name.toLowerCase(), e]));
    const idByLowerName = new Map(existing.map((e) => [e.name.toLowerCase(), e.id]));
    const stats = { created: 0, updated: 0, edges: 0, skipped: [] };

    for (const profile of profiles) {
      const { description, biography, highlights, metadata } = profile.fields;
      const current = byLowerName.get(profile.name.toLowerCase());
      if (!current) {
        const id = randomUUID();
        if (!DRY_RUN) {
          await session.run(
            `CREATE (e:Entity {
               id: $id, type: $type, name: $name, description: $description,
               biography: $biography, imageUrl: '', websiteUrl: '', xUrl: '', facebookUrl: '',
               instagramUrl: '', youtubeUrl: '', linkedinUrl: '', highlights: $highlights,
               metadata: $metadata, createdAt: datetime(), updatedAt: datetime()
             })`,
            { id, type: profile.type, name: profile.name, description, biography, highlights, metadata: JSON.stringify(metadata) },
          );
        }
        idByLowerName.set(profile.name.toLowerCase(), id);
        stats.created++;
        continue;
      }

      let mergedMeta = {};
      try {
        mergedMeta = JSON.parse(current.metadata || "{}");
      } catch {}
      const pick = (field, value) => (FORCE || !current[field] ? value : current[field]);
      if (!DRY_RUN) {
        await session.run(
          `MATCH (e:Entity {id: $id})
           SET e.description = $description, e.biography = $biography,
               e.highlights = $highlights, e.metadata = $metadata, e.updatedAt = datetime()`,
          {
            id: current.id,
            description: pick("description", description),
            biography: pick("biography", biography),
            highlights: pick("highlights", highlights),
            metadata: JSON.stringify({ ...mergedMeta, ...metadata }),
          },
        );
      }
      stats.updated++;
    }

    for (const c of DATA.connections) {
      const sourceId = idByLowerName.get(c.source.toLowerCase());
      const targetId = idByLowerName.get(c.target.toLowerCase());
      if (!sourceId || !targetId) {
        stats.skipped.push(`${c.source} → ${c.target}`);
        continue;
      }
      stats.edges++;
      if (DRY_RUN) continue;
      await session.run(
        `MATCH (a:Entity {id: $sourceId}), (b:Entity {id: $targetId})
         MERGE (a)-[r:RELATED_TO {sourceKey: $key}]->(b)
         ON CREATE SET r.id = $edgeId, r.createdAt = datetime()
         SET r.label = $label, r.relType = $relType, r.role = $role,
             r.validFrom = $validFrom, r.validTo = $validTo,
             r.notes = '', r.sourceRecordId = '', r.updatedAt = datetime()`,
        {
          sourceId,
          targetId,
          key: `${DATA.collection}:${sourceId}:${c.relType}:${targetId}`,
          edgeId: randomUUID(),
          label: c.relType === "former-role" ? "formerly worked for" : c.relType.replaceAll("-", " "),
          relType: c.relType,
          role: c.role ?? "",
          validFrom: c.from ?? "",
          validTo: c.until ?? "",
        },
      );
    }

    console.log(
      `${profiles.length} profiles: ${stats.created} created, ${stats.updated} updated${FORCE ? " (forced)" : ""}\n` +
        `  edges: ${stats.edges}` +
        (stats.skipped.length ? `\n  skipped (unknown entity): ${stats.skipped.join("; ")}` : "") +
        (DRY_RUN ? "\n  DRY RUN — no writes." : ""),
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
