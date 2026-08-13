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
    imageUrl: (p.imageUrl as string) ?? "",
    highlights: (p.highlights as string) ?? "",
    metadata: (p.metadata as string) ?? "",
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
         imageUrl: $imageUrl,
         highlights: $highlights,
         metadata: $metadata,
         createdAt: datetime(),
         updatedAt: datetime()
       })
       RETURN e`,
      {
        id,
        type: input.type,
        name: input.name,
        description: input.description ?? "",
        imageUrl: input.imageUrl ?? "",
        highlights: input.highlights ?? "",
        metadata: input.metadata ?? "",
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
           e.imageUrl = $imageUrl,
           e.highlights = $highlights,
           e.metadata = $metadata,
           e.updatedAt = datetime()
       RETURN e`,
      {
        id,
        type: input.type,
        name: input.name,
        description: input.description ?? "",
        imageUrl: input.imageUrl ?? "",
        highlights: input.highlights ?? "",
        metadata: input.metadata ?? "",
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
