import { and, asc, count, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import { entities, entityIdentifiers, entityMerges, entityProfiles } from "./schema";
import type { Entity, EntityInput, EntityType } from "../validation/entity";
import { publicEntityPath, publicEntitySlug } from "../people/public";

// Crosswalk schemes in entity_identifiers (scripts/lib/entities.mjs has the
// Neo4j property each maps to).
export type IdentifierScheme =
  | "bioguide"
  | "openstates"
  | "icpsr"
  | "wikidata"
  | "govtrack"
  | "opensecrets"
  | "votesmart"
  | "ballotpedia"
  | "thomas"
  | "lis"
  | "fec_candidate"
  | "fec_committee"
  | "congress_committee"
  | "lda_client"
  | "lda_registrant"
  | "scdb";

const bioguide = sql<string | null>`(
  select ${entityIdentifiers.value} from ${entityIdentifiers}
  where ${entityIdentifiers.entityId} = ${entities.id} and ${entityIdentifiers.scheme} = 'bioguide'
)`;

const entityColumns = {
  id: entities.id,
  type: entities.type,
  name: entities.name,
  description: entities.description,
  biography: entities.biography,
  imageUrl: entities.imageUrl,
  websiteUrl: entities.websiteUrl,
  xUrl: entities.xUrl,
  facebookUrl: entities.facebookUrl,
  instagramUrl: entities.instagramUrl,
  youtubeUrl: entities.youtubeUrl,
  linkedinUrl: entities.linkedinUrl,
  highlights: entities.highlights,
  metadata: entities.metadata,
  bioguideId: bioguide,
  createdAt: entities.createdAt,
  updatedAt: entities.updatedAt,
};

type EntityRow = Omit<typeof entities.$inferSelect, never> & { bioguideId: string | null };

function toEntity(row: EntityRow): Entity {
  return {
    ...row,
    type: row.type as EntityType,
    bioguideId: row.bioguideId ?? "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function selectEntities() {
  return db.select(entityColumns).from(entities);
}

export async function listEntities(filter?: { type?: EntityType; limit?: number }): Promise<Entity[]> {
  const query = selectEntities()
    .where(filter?.type ? eq(entities.type, filter.type) : undefined)
    .orderBy(asc(entities.name));
  const rows = filter?.limit ? await query.limit(filter.limit) : await query;
  return rows.map(toEntity);
}

// Public relevance: full dossiers first, then the size of the documented
// network (membership edges excluded, or every legislature and committee would
// outrank the people in it), political money given or received, federal office
// and curated-collection membership. Text length only breaks ties.
const relevance = sql<number>`
  (case when exists (select 1 from entity_profiles p where p.entity_id = ${entities.id}) then 1000000 else 0 end) +
  60 * least((
    select count(*) from entity_edges x
    where (x.source_entity_id = ${entities.id} or x.target_entity_id = ${entities.id})
      and x.rel_type not in ('serves-in', 'sits-on-committee', 'member-of', 'party-member', 'holds-office', 'chairs', 'governor-of')
  ), 50) +
  15 * least((select count(*) from entity_event_participants x where x.entity_id = ${entities.id}), 40) +
  120 * log(1 + greatest(coalesce((
    select sum(c.amount) from contributions c
    where (c.donor_entity_id = ${entities.id} or c.recipient_entity_id = ${entities.id})
      and coalesce(c.memo_code, '') <> 'X'
  ), 0), 0)) +
  (case when ${bioguide} is not null then 600 else 0 end) +
  (case when ${entities.metadata} like '%"collection":%' then 400 else 0 end) +
  (case when coalesce(${entities.imageUrl}, '') <> '' then 150 else 0 end) +
  least(length(coalesce(${entities.biography}, '')) + length(coalesce(${entities.description}, '')), 1000) / 20
`;

// FEC-style "LAST, FIRST" contributor stubs make poor recommendations.
const notContributorStub = sql`not (${entities.name} like '%,%' and ${entities.name} = upper(${entities.name}))`;

export interface DossierProfile {
  id: string;
  name: string;
  path: string;
  imageUrl: string;
  summary: string;
  roles: string[];
  given: number;
}

// Homepage order: the most recognizable finished dossiers, across parties and
// money. Names not found (or not finished) are skipped; relevance fills the rest.
const FEATURED_DOSSIERS = ["donald trump", "elon musk", "george soros", "miriam adelson", "stephen miller", "peter thiel"];

// Finished editorial dossiers (reviewed, source-checked, with chapters and a
// portrait), featured names first and then by relevance, with itemized
// federal giving for the homepage.
export async function listDossierProfiles(limit: number): Promise<DossierProfile[]> {
  const rows = await db
    .select({
      id: entities.id,
      name: entities.name,
      imageUrl: entities.imageUrl,
      summary: entityProfiles.summary,
      roles: sql<
        string[]
      >`coalesce((select array_agg(r->>'label') from jsonb_array_elements(${entityProfiles.roles}) r), '{}')`,
      given: sql<string | null>`(
        select sum(c.amount) from contributions c
        where c.donor_entity_id = ${entities.id} and coalesce(c.memo_code, '') <> 'X'
      )`,
    })
    .from(entityProfiles)
    .innerJoin(entities, eq(entities.id, entityProfiles.entityId))
    .where(
      sql`${entityProfiles.summary} <> '' and coalesce(${entities.imageUrl}, '') <> ''
        and ${entityProfiles.editorialReviewedAt} is not null and ${entityProfiles.sourcesVerifiedAt} is not null
        and jsonb_array_length(coalesce(${entityProfiles.chapters}, '[]'::jsonb)) > 0`,
    )
    .orderBy(
      sql`array_position(${sql.raw(`array[${FEATURED_DOSSIERS.map((name) => `'${name}'`).join(", ")}]`)}::text[], lower(${entities.name})) nulls last`,
      desc(relevance),
      asc(entities.name),
    )
    .limit(limit);
  return rows.map((row) => ({
    ...row,
    path: publicEntityPath(row),
    roles: row.roles ?? [],
    given: Number(row.given ?? 0),
  }));
}

// The most relevant entities of one type, for discovery surfaces.
export async function listProfiledEntities(type: EntityType, limit: number): Promise<Entity[]> {
  const rows = await selectEntities()
    .where(and(eq(entities.type, type), notContributorStub))
    .orderBy(desc(relevance), asc(entities.name))
    .limit(limit);
  return rows.map(toEntity);
}

// Every entity with a full dossier, most relevant first.
export async function listCaseFileEntities(limit?: number): Promise<Entity[]> {
  const query = selectEntities()
    .innerJoin(entityProfiles, eq(entityProfiles.entityId, entities.id))
    .orderBy(desc(relevance), asc(entities.name));
  const rows = limit ? await query.limit(limit) : await query;
  return rows.map(toEntity);
}

// Entity ids that have a full dossier (an entity_profiles row).
export async function getDossierEntityIds(ids: string[]): Promise<Set<string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Set();
  const rows = await db
    .select({ id: entityProfiles.entityId })
    .from(entityProfiles)
    .where(inArray(entityProfiles.entityId, unique));
  return new Set(rows.map((r) => r.id));
}

// id -> name for just the given entities (the election overview needs a few
// hundred candidate names, not the whole graph).
export async function getEntityNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({ id: entities.id, name: entities.name })
    .from(entities)
    .where(inArray(entities.id, unique));
  return new Map(rows.map((r) => [r.id, r.name]));
}

// name -> profile path for the given names (matched case-insensitively), so
// tradition pages can link their key figures. A name shared by several
// entities (Adam Smith the economist vs. two legislators) stays unlinked.
export async function getProfilePathsByName(names: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({ id: entities.id, name: entities.name })
    .from(entities)
    .where(and(inArray(sql`lower(${entities.name})`, unique.map((n) => n.toLowerCase())), notContributorStub));
  const byName = Map.groupBy(rows, (r) => r.name.toLowerCase());
  return new Map(
    unique.flatMap((name) => {
      const matches = byName.get(name.toLowerCase());
      return matches?.length === 1 ? [[name, publicEntityPath(matches[0])] as const] : [];
    }),
  );
}

// Full records for just the given entities, for pages that reference a subset
// of the graph (money breakdowns, lobbying) rather than all of it.
export async function getEntitiesByIds(ids: string[]): Promise<Entity[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const rows = await selectEntities().where(inArray(entities.id, unique));
  return rows.map(toEntity);
}

// external id -> entity id for one crosswalk scheme.
export async function getIdentifierMap(scheme: IdentifierScheme): Promise<Map<string, string>> {
  const rows = await db
    .select({ value: entityIdentifiers.value, entityId: entityIdentifiers.entityId })
    .from(entityIdentifiers)
    .where(eq(entityIdentifiers.scheme, scheme));
  return new Map(rows.map((r) => [r.value, r.entityId]));
}

// Entities matching `query`, case-insensitive, most relevant first. A name
// matches when it contains the whole query, or when every word of the query
// starts a word of the name ("fuentes nick"). An exact name always leads;
// otherwise public relevance decides, nudged by how well the name matches, so
// a full dossier outranks an alphabetical run of state legislators.
export async function searchEntities(query: string, limit: number): Promise<Entity[]> {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return [];
  const name = sql`lower(${entities.name})`;
  const startsWord = (word: string) =>
    sql`(${name} like ${`${escapeLike(word)}%`} or ${name} like ${`% ${escapeLike(word)}%`} or ${name} like ${`%-${escapeLike(word)}%`})`;
  const words = q.split(" ");
  const everyWord = sql.join(words.map(startsWord), sql` and `);
  const match = sql<number>`case
    when ${name} = ${q} then 2000000
    when ${name} like ${`${escapeLike(q)}%`} then 400
    when ${name} like ${`% ${escapeLike(q)}%`} then 250
    when ${everyWord} then 150
    else -500 end`;
  const rows = await selectEntities()
    .where(and(sql`(${ilike(entities.name, `%${escapeLike(q)}%`)} or ${everyWord})`, notContributorStub))
    .orderBy(desc(sql`${match} + ${relevance}`), asc(entities.name))
    .limit(limit);
  return rows.map(toEntity);
}

// Members of Congress (entities carrying a Bioguide id) whose name contains
// `query` — for "bills sponsored by …" searches.
export async function findMemberIdsByName(query: string, limit = 50): Promise<string[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const rows = await db
    .select({ id: entities.id })
    .from(entities)
    .innerJoin(
      entityIdentifiers,
      and(eq(entityIdentifiers.entityId, entities.id), eq(entityIdentifiers.scheme, "bioguide")),
    )
    .where(ilike(entities.name, `%${escapeLike(q)}%`))
    .limit(limit);
  return rows.map((r) => r.id);
}

export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function countEntities(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(entities);
  return row.value;
}

export async function listRecentEntities(limit: number): Promise<Entity[]> {
  const rows = await selectEntities().orderBy(desc(entities.createdAt)).limit(limit);
  return rows.map(toEntity);
}

export async function getEntity(id: string): Promise<Entity | null> {
  const [row] = await selectEntities().where(eq(entities.id, id));
  return row ? toEntity(row) : null;
}

/** Resolve the public, human-readable profile slug without exposing CRUD URLs. */
export async function getEntityByPublicSlug(slug: string): Promise<Entity | null> {
  const shortId = slug.match(/-([0-9a-f]{8})$/i)?.[1]?.toLowerCase();
  if (!shortId) return null;
  const rows = await selectEntities()
    .where(sql`${entities.id}::text like ${`${shortId}%`}`)
    .limit(10);
  const matches = rows.map(toEntity);
  // A link built from a variant spelling (FEC names, say) still resolves when
  // the id prefix is unambiguous; the profile route redirects to the canonical slug.
  return matches.find((entity) => publicEntitySlug(entity) === slug) ?? (matches.length === 1 ? matches[0] : null);
}

// The entity a merged duplicate was folded into (scripts/merge-entities.mjs),
// so links that still carry the old id can redirect. Accepts a full id or
// the 8-character prefix public profile slugs end in.
export async function getMergedInto(idOrPrefix: string): Promise<Entity | null> {
  const prefix = idOrPrefix.toLowerCase();
  if (!/^[0-9a-f-]{8,36}$/.test(prefix)) return null;
  const [row] = await db
    .select({ intoId: entityMerges.intoId })
    .from(entityMerges)
    .where(sql`${entityMerges.mergedId}::text like ${`${prefix}%`}`)
    .limit(2);
  return row ? getEntity(row.intoId) : null;
}

function entityValues(input: EntityInput) {
  return {
    type: input.type,
    name: input.name,
    description: input.description ?? "",
    biography: input.biography ?? "",
    imageUrl: input.imageUrl ?? "",
    websiteUrl: input.websiteUrl ?? "",
    xUrl: input.xUrl ?? "",
    facebookUrl: input.facebookUrl ?? "",
    instagramUrl: input.instagramUrl ?? "",
    youtubeUrl: input.youtubeUrl ?? "",
    linkedinUrl: input.linkedinUrl ?? "",
    highlights: input.highlights ?? "",
    metadata: input.metadata ?? "",
  };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Points the entity's Bioguide id at `value`, or removes it when blank.
async function setBioguide(tx: Tx, entityId: string, value: string | undefined) {
  await tx
    .delete(entityIdentifiers)
    .where(and(eq(entityIdentifiers.entityId, entityId), eq(entityIdentifiers.scheme, "bioguide")));
  if (!value) return;
  const inserted = await tx
    .insert(entityIdentifiers)
    .values({ entityId, scheme: "bioguide", value })
    .onConflictDoNothing()
    .returning();
  if (!inserted.length) throw new Error(`Bioguide id ${value} already belongs to another entity.`);
}

export async function createEntity(input: EntityInput): Promise<Entity> {
  const id = await db.transaction(async (tx) => {
    const [row] = await tx.insert(entities).values(entityValues(input)).returning({ id: entities.id });
    await setBioguide(tx, row.id, input.bioguideId);
    return row.id;
  });
  return (await getEntity(id))!;
}

export async function updateEntity(id: string, input: EntityInput): Promise<Entity | null> {
  const updated = await db.transaction(async (tx) => {
    const rows = await tx
      .update(entities)
      .set({ ...entityValues(input), updatedAt: new Date() })
      .where(eq(entities.id, id))
      .returning({ id: entities.id });
    if (!rows.length) return false;
    await setBioguide(tx, id, input.bioguideId);
    return true;
  });
  return updated ? getEntity(id) : null;
}

// Removes the entity with its relationships and crosswalk ids. Refused by
// the database while bills, votes, money, or other records still point at it.
export async function deleteEntity(id: string): Promise<void> {
  try {
    await db.delete(entities).where(eq(entities.id, id));
  } catch (err) {
    if ((err as { cause?: { code?: string } }).cause?.code === "23503") {
      throw new Error("This entity still has records (votes, bills, contributions, or similar) and can't be deleted.");
    }
    throw err;
  }
}
