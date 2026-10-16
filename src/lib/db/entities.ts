import { and, asc, count, desc, eq, gte, ilike, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import { entities, entityIdentifiers, entityMerges } from "./schema";
import type { Entity, EntityInput, EntityType } from "../validation/entity";
import { publicEntitySlug } from "../people/public";

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
  | "lda_registrant";

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

export async function listEntities(filter?: { type?: EntityType }): Promise<Entity[]> {
  const rows = await selectEntities()
    .where(filter?.type ? eq(entities.type, filter.type) : undefined)
    .orderBy(asc(entities.name));
  return rows.map(toEntity);
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

// bioguideId -> entity id, for the legislation importers to resolve
// sponsors and voters in one round trip.
export function listPoliticianBioguideMap(): Promise<Map<string, string>> {
  return getIdentifierMap("bioguide");
}

// Entities whose name contains `query`, case-insensitive, best matches
// first: names starting with the query, then a word starting with it.
export async function searchEntities(query: string, limit: number): Promise<Entity[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const pattern = `%${escapeLike(q)}%`;
  const rank = sql`case
    when lower(${entities.name}) like ${`${escapeLike(q)}%`} then 0
    when lower(${entities.name}) like ${`% ${escapeLike(q)}%`} then 1
    else 2 end`;
  const rows = await selectEntities()
    .where(ilike(entities.name, pattern))
    .orderBy(rank, asc(entities.name))
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

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function countEntities(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(entities);
  return row.value;
}

export async function countEntitiesCreatedSince(since: Date): Promise<number> {
  const [row] = await db.select({ value: count() }).from(entities).where(gte(entities.createdAt, since));
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
  return rows.map(toEntity).find((entity) => publicEntitySlug(entity) === slug) ?? null;
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
