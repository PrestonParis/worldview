import { randomUUID } from "crypto";
import neo4j, { type Node } from "neo4j-driver";
import { getDriver } from "./client";
import type { Entity, EntityInput, EntityType } from "../validation/entity";

function toEntity(node: Node): Entity {
  const p = node.properties as Record<string, unknown>;
  return {
    id: String(p.id),
    type: p.type as EntityType,
    name: String(p.name),
    description: (p.description as string) ?? "",
    biography: (p.biography as string) ?? "",
    imageUrl: (p.imageUrl as string) ?? "",
    websiteUrl: (p.websiteUrl as string) ?? "",
    xUrl: (p.xUrl as string) ?? "",
    facebookUrl: (p.facebookUrl as string) ?? "",
    instagramUrl: (p.instagramUrl as string) ?? "",
    youtubeUrl: (p.youtubeUrl as string) ?? "",
    linkedinUrl: (p.linkedinUrl as string) ?? "",
    highlights: (p.highlights as string) ?? "",
    metadata: (p.metadata as string) ?? "",
    bioguideId: (p.bioguideId as string) ?? "",
    createdAt: String(p.createdAt),
    updatedAt: String(p.updatedAt),
  };
}

export async function listEntities(filter?: {
  type?: EntityType;
}): Promise<Entity[]> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      filter?.type
        ? "MATCH (e:Entity {type: $type}) RETURN e ORDER BY e.name"
        : "MATCH (e:Entity) RETURN e ORDER BY e.name",
      filter?.type ? { type: filter.type } : {},
    );
    return result.records.map((r) => toEntity(r.get("e")));
  } finally {
    await session.close();
  }
}

// bioguideId -> entity id, for the legislation importers to resolve
// sponsors and voters in one round trip. Only politician entities carry a
// bioguideId (see scripts/backfill-members.mjs).
export async function listPoliticianBioguideMap(): Promise<Map<string, string>> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      "MATCH (e:Entity {type: 'politician'}) WHERE e.bioguideId IS NOT NULL RETURN e.bioguideId AS bioguideId, e.id AS id",
    );
    const map = new Map<string, string>();
    for (const record of result.records) {
      map.set(String(record.get("bioguideId")), String(record.get("id")));
    }
    return map;
  } finally {
    await session.close();
  }
}

export async function countEntities(): Promise<number> {
  const session = getDriver().session();
  try {
    const result = await session.run("MATCH (e:Entity) RETURN count(e) AS c");
    return result.records[0].get("c").toNumber();
  } finally {
    await session.close();
  }
}

export async function countEntitiesCreatedSince(since: Date): Promise<number> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      "MATCH (e:Entity) WHERE e.createdAt >= datetime($since) RETURN count(e) AS c",
      { since: since.toISOString() },
    );
    return result.records[0].get("c").toNumber();
  } finally {
    await session.close();
  }
}

export async function listRecentEntities(limit: number): Promise<Entity[]> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      "MATCH (e:Entity) RETURN e ORDER BY e.createdAt DESC LIMIT $limit",
      { limit: neo4j.int(limit) },
    );
    return result.records.map((r) => toEntity(r.get("e")));
  } finally {
    await session.close();
  }
}

export async function getEntity(id: string): Promise<Entity | null> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      "MATCH (e:Entity {id: $id}) RETURN e",
      { id },
    );
    const record = result.records[0];
    return record ? toEntity(record.get("e")) : null;
  } finally {
    await session.close();
  }
}

export async function createEntity(input: EntityInput): Promise<Entity> {
  const session = getDriver().session();
  try {
    const id = randomUUID();
    const result = await session.run(
      `CREATE (e:Entity {
         id: $id,
         type: $type,
         name: $name,
         description: $description,
         biography: $biography,
         imageUrl: $imageUrl,
         websiteUrl: $websiteUrl,
         xUrl: $xUrl,
         facebookUrl: $facebookUrl,
         instagramUrl: $instagramUrl,
         youtubeUrl: $youtubeUrl,
         linkedinUrl: $linkedinUrl,
         highlights: $highlights,
         metadata: $metadata,
         bioguideId: $bioguideId,
         createdAt: datetime(),
         updatedAt: datetime()
       })
       RETURN e`,
      {
        id,
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
        // null (not "") when blank — see the note in validation/entity.ts:
        // the Neo4j uniqueness constraint would reject a second "".
        bioguideId: input.bioguideId || null,
      },
    );
    return toEntity(result.records[0].get("e"));
  } finally {
    await session.close();
  }
}

export async function updateEntity(
  id: string,
  input: EntityInput,
): Promise<Entity | null> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (e:Entity {id: $id})
       SET e.type = $type,
           e.name = $name,
           e.description = $description,
           e.biography = $biography,
           e.imageUrl = $imageUrl,
           e.websiteUrl = $websiteUrl,
           e.xUrl = $xUrl,
           e.facebookUrl = $facebookUrl,
           e.instagramUrl = $instagramUrl,
           e.youtubeUrl = $youtubeUrl,
           e.linkedinUrl = $linkedinUrl,
           e.highlights = $highlights,
           e.metadata = $metadata,
           e.bioguideId = $bioguideId,
           e.updatedAt = datetime()
       RETURN e`,
      {
        id,
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
        // null clears the property (Cypher SET x = null removes it) and
        // keeps blanks out of the uniqueness constraint — see createEntity.
        bioguideId: input.bioguideId || null,
      },
    );
    const record = result.records[0];
    return record ? toEntity(record.get("e")) : null;
  } finally {
    await session.close();
  }
}

export async function deleteEntity(id: string): Promise<void> {
  const session = getDriver().session();
  try {
    // DETACH DELETE also removes any edges touching this entity.
    await session.run("MATCH (e:Entity {id: $id}) DETACH DELETE e", { id });
  } finally {
    await session.close();
  }
}
