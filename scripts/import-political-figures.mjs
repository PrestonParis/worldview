// Loads the curated political-figure collections into the graph: profiles
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
// Usage: node scripts/import-political-figures.mjs [--dry-run] [--force] [--collection=name] [--profile=name]
//        node scripts/import-political-figures.mjs --docs   (regenerate docs/political-figures.md, no DB)

import fs from "node:fs";
import { randomUUID } from "node:crypto";

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const DOCS = process.argv.includes("--docs");
const PROFILE_ARG = process.argv
  .find((arg) => arg.startsWith("--profile="))
  ?.split("=")[1]
  ?.trim()
  .toLowerCase();
const DATA_PATHS = ["data/political-figures.json", "data/political-influence-wealth.json"];
const COLLECTIONS = DATA_PATHS.map((path) => ({ path, data: JSON.parse(fs.readFileSync(path, "utf8")) }));
const COLLECTION_ARG = process.argv.find((arg) => arg.startsWith("--collection="))?.split("=")[1];
const ACTIVE_COLLECTIONS = COLLECTION_ARG
  ? COLLECTIONS.filter(({ data }) => data.collection === COLLECTION_ARG)
  : COLLECTIONS;
if (COLLECTION_ARG && ACTIVE_COLLECTIONS.length === 0) {
  throw new Error(`Unknown collection: ${COLLECTION_ARG}`);
}
const DOCS_PATH = "docs/political-figures.md";

// Mirrors the limits in src/lib/validation/entity.ts.
const LIMITS = { description: 2000, biography: 12000, highlights: 2000, metadata: 24000 };

function biographyText(profile) {
  if (profile.biography) return profile.biography;
  return (profile.profile?.sections ?? []).map((section) => `${section.heading}\n${section.body}`).join("\n\n");
}

function profileFields(profile, collection) {
  const metadata = {
    ...profile.metadata,
    ...(profile.profile ? { profile: profile.profile } : {}),
    sources: profile.sources ?? [],
    collection,
  };
  const fields = {
    description: profile.description ?? "",
    biography: biographyText(profile),
    image_url: profile.imageUrl ?? "",
    website_url: profile.websiteUrl ?? "",
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
  const people = COLLECTIONS.flatMap(({ data }) => data.people);
  const organizations = COLLECTIONS.flatMap(({ data }) => data.organizations);
  const connections = COLLECTIONS.flatMap(({ data }) => data.connections);
  const anchor = (name) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const section = (profile) => {
    const meta = profile.metadata ?? {};
    const facts = [
      meta.aliases?.length ? `**Also known as:** ${meta.aliases.join(", ")}` : "",
      meta.born ? `**Born:** ${meta.born}` : "",
      meta.died ? `**Died:** ${meta.died}` : "",
      meta.founded ? `**Founded:** ${meta.founded}` : "",
    ].filter(Boolean);
    const links = connections
      .filter((c) => c.source === profile.name || c.target === profile.name)
      .map((c) => `- ${c.source} → *${c.relType}* → ${c.target}${c.role ? ` — ${c.role}` : ""}`);
    return [
      `### ${profile.name}`,
      "",
      `*${profile.description}*`,
      facts.length ? `\n${facts.join(" · ")}` : "",
      "",
      biographyText(profile),
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
    "Generated from the `data/political-*.json` collections by `node scripts/import-political-figures.mjs --docs`.",
    "Edit those JSON files, not this document. Profiles appear on `/data/entities/[id]` (biography, highlights,",
    "aliases, born/died, sources) and in the `/people` graph via their connections.",
    "",
    "## Adding a figure",
    "",
    "1. Add an entry to `people` (or `organizations`) with `description`, `biography`, dated",
    '   `highlights` (`"YYYY — event"`), `metadata`, and at least one `sources` URL.',
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
    ...people.map((p) => `| [${p.name}](#${anchor(p.name)}) | ${p.type} | ${p.description.replaceAll("|", "\\|")} |`),
    ...organizations.map(
      (o) => `| [${o.name}](#${anchor(o.name)}) | organization | ${o.description.replaceAll("|", "\\|")} |`,
    ),
    "",
    "## People",
    "",
    ...people.map(section),
    "## Organizations",
    "",
    ...organizations.map(section),
  ].join("\n");
  fs.writeFileSync(DOCS_PATH, md);
  console.log(`Wrote ${DOCS_PATH} (${people.length} people, ${organizations.length} organizations).`);
}

async function main() {
  // Validate everything before touching the DB.
  const profiles = ACTIVE_COLLECTIONS.flatMap(({ data }) => [
    ...data.organizations.map((profile) => ({
      ...profile,
      type: "organization",
      collection: data.collection,
      fields: profileFields(profile, data.collection),
    })),
    ...data.people.map((profile) => ({
      ...profile,
      collection: data.collection,
      fields: profileFields(profile, data.collection),
    })),
  ]).filter((profile) => !PROFILE_ARG || profile.name.toLowerCase() === PROFILE_ARG);
  if (PROFILE_ARG && profiles.length === 0) throw new Error(`Unknown profile: ${PROFILE_ARG}`);
  const connections = ACTIVE_COLLECTIONS.flatMap(({ data }) =>
    data.connections.map((connection) => ({ ...connection, collection: data.collection })),
  ).filter(
    (connection) =>
      !PROFILE_ARG ||
      connection.source.toLowerCase() === PROFILE_ARG ||
      connection.target.toLowerCase() === PROFILE_ARG,
  );

  if (DOCS) return writeDocs();

  process.loadEnvFile(process.env.ENV_FILE || ".env.local");
  const { connectPg } = await import("./lib/bulk.mjs");
  const { addIdentifiers, describeConflict, upsertEdges, upsertEntities } = await import("./lib/entities.mjs");
  const pg = await connectPg();
  try {
    const { rows: existing } = await pg.query(
      "select id, name, description, biography, image_url, website_url, highlights, metadata from entities",
    );
    const byLowerName = new Map(existing.map((e) => [e.name.toLowerCase(), e]));
    const idByLowerName = new Map(existing.map((e) => [e.name.toLowerCase(), e.id]));
    const stats = { created: 0, updated: 0, edges: 0, skipped: [] };

    for (const profile of profiles) {
      const { description, biography, highlights, metadata } = profile.fields;
      const current = byLowerName.get(profile.name.toLowerCase());
      if (!current) {
        const id = randomUUID();
        if (!DRY_RUN) {
          await upsertEntities(pg, [
            {
              id,
              type: profile.type,
              name: profile.name,
              description,
              biography,
              image_url: profile.fields.image_url,
              website_url: profile.fields.website_url,
              highlights,
              metadata: JSON.stringify(metadata),
            },
          ]);
        }
        idByLowerName.set(profile.name.toLowerCase(), id);
        stats.created++;
        continue;
      }

      let mergedMeta = {};
      try {
        mergedMeta = JSON.parse(current.metadata || "{}");
      } catch (error) {
        console.warn(
          `Ignoring malformed metadata for ${current.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      const pick = (field, value) => (FORCE || !current[field] ? value : current[field]);
      if (!DRY_RUN) {
        await pg.query(
          "update entities set description = $2, biography = $3, image_url = $4, website_url = $5, highlights = $6, metadata = $7, updated_at = now() where id = $1",
          [
            current.id,
            pick("description", description),
            pick("biography", biography),
            pick("image_url", profile.fields.image_url),
            pick("website_url", profile.fields.website_url),
            pick("highlights", highlights),
            JSON.stringify({ ...mergedMeta, ...metadata }),
          ],
        );
      }
      stats.updated++;
    }

    const identifierRows = profiles.flatMap((profile) => {
      const entityId = idByLowerName.get(profile.name.toLowerCase());
      if (!entityId || !profile.identifiers) return [];
      return Object.entries(profile.identifiers).flatMap(([scheme, value]) =>
        (Array.isArray(value) ? value : [value]).map((item) => ({ entityId, scheme, value: item })),
      );
    });
    if (!DRY_RUN && identifierRows.length) {
      const conflicts = await addIdentifiers(pg, identifierRows);
      for (const conflict of conflicts) console.warn(`Identifier conflict: ${describeConflict(conflict)}`);
    }

    for (const c of connections) {
      const sourceId = idByLowerName.get(c.source.toLowerCase());
      const targetId = idByLowerName.get(c.target.toLowerCase());
      if (!sourceId || !targetId) {
        stats.skipped.push(`${c.source} → ${c.target}`);
        continue;
      }
      stats.edges++;
      if (DRY_RUN) continue;
      await upsertEdges(
        pg,
        [
          {
            source_key: `${c.collection}:${sourceId}:${c.relType}:${targetId}`,
            source_entity_id: sourceId,
            target_entity_id: targetId,
            label: c.relType === "former-role" ? "formerly worked for" : c.relType.replaceAll("-", " "),
            rel_type: c.relType,
            role: c.role ?? "",
            valid_from: c.from ?? "",
            valid_to: c.until ?? "",
          },
        ],
        { keepValidFrom: false },
      );
    }

    console.log(
      `${profiles.length} profiles: ${stats.created} created, ${stats.updated} updated${FORCE ? " (forced)" : ""}\n` +
        `  edges: ${stats.edges}` +
        (stats.skipped.length ? `\n  skipped (unknown entity): ${stats.skipped.join("; ")}` : "") +
        (DRY_RUN ? "\n  DRY RUN — no writes." : ""),
    );
  } finally {
    await pg.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
