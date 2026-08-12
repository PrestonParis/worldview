import { randomUUID } from "crypto";
import type { Node } from "neo4j-driver";
import { getDriver } from "./client";
import type { Entity, EntityInput, EntityType } from "../validation/entity";

function toEntity(node: Node): Entity {
  const p = node.properties as Record<string, unknown>;
  return {
    id: String(p.id),
    type: p.type as EntityType,
    name: String(p.name),
    description: (p.description as string) ?? "",
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
           e.metadata = $metadata,
           e.updatedAt = datetime()
       RETURN e`,
      {
        id,
        type: input.type,
        name: input.name,
        description: input.description ?? "",
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
