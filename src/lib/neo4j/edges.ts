import { randomUUID } from "crypto";
import type { Relationship } from "neo4j-driver";
import { getDriver } from "./client";
import type { Edge, EdgeInput } from "../validation/edge";

function toEdge(
  rel: Relationship,
  sourceEntityId: string,
  targetEntityId: string,
): Edge {
  const p = rel.properties as Record<string, unknown>;
  return {
    id: String(p.id),
    sourceEntityId,
    targetEntityId,
    label: String(p.label),
    relType: (p.relType as string) ?? "",
    role: (p.role as string) ?? "",
    validFrom: (p.validFrom as string) ?? "",
    validTo: (p.validTo as string) ?? "",
    notes: (p.notes as string) ?? "",
    sourceRecordId: (p.sourceRecordId as string) ?? "",
    createdAt: String(p.createdAt),
    updatedAt: String(p.updatedAt),
  };
}

export async function countEdges(): Promise<number> {
  const session = getDriver().session();
  try {
    const result = await session.run("MATCH ()-[r:RELATED_TO]->() RETURN count(r) AS c");
    return result.records[0].get("c").toNumber();
  } finally {
    await session.close();
  }
}

export async function countEdgesCreatedSince(since: Date): Promise<number> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      "MATCH ()-[r:RELATED_TO]->() WHERE r.createdAt >= datetime($since) RETURN count(r) AS c",
      { since: since.toISOString() },
    );
    return result.records[0].get("c").toNumber();
  } finally {
    await session.close();
  }
}

export async function listEdges(): Promise<Edge[]> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (a:Entity)-[r:RELATED_TO]->(b:Entity)
       RETURN r, a.id AS sourceId, b.id AS targetId
       ORDER BY r.createdAt DESC`,
    );
    return result.records.map((rec) =>
      toEdge(rec.get("r"), rec.get("sourceId"), rec.get("targetId")),
    );
  } finally {
    await session.close();
  }
}

export async function listEdgesForEntity(entityId: string): Promise<Edge[]> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (a:Entity {id: $entityId})-[r:RELATED_TO]-(b:Entity)
       RETURN r,
              CASE WHEN startNode(r).id = $entityId THEN a.id ELSE b.id END AS sourceId,
              CASE WHEN startNode(r).id = $entityId THEN b.id ELSE a.id END AS targetId`,
      { entityId },
    );
    return result.records.map((rec) =>
      toEdge(rec.get("r"), rec.get("sourceId"), rec.get("targetId")),
    );
  } finally {
    await session.close();
  }
}

export async function createEdge(input: EdgeInput): Promise<Edge> {
  const session = getDriver().session();
  try {
    const id = randomUUID();
    const result = await session.run(
      `MATCH (a:Entity {id: $sourceEntityId}), (b:Entity {id: $targetEntityId})
       CREATE (a)-[r:RELATED_TO {
         id: $id,
         label: $label,
         relType: $relType,
         role: $role,
         validFrom: $validFrom,
         validTo: $validTo,
         notes: $notes,
         sourceRecordId: $sourceRecordId,
         createdAt: datetime(),
         updatedAt: datetime()
       }]->(b)
       RETURN r, a.id AS sourceId, b.id AS targetId`,
      {
        id,
        sourceEntityId: input.sourceEntityId,
        targetEntityId: input.targetEntityId,
        label: input.label,
        relType: input.relType ?? "",
        role: input.role ?? "",
        validFrom: input.validFrom ?? "",
        validTo: input.validTo ?? "",
        notes: input.notes ?? "",
        sourceRecordId: input.sourceRecordId ?? "",
      },
    );
    const record = result.records[0];
    if (!record) {
      throw new Error(
        "Couldn't create the relationship — check that both entities exist.",
      );
    }
    return toEdge(record.get("r"), record.get("sourceId"), record.get("targetId"));
  } finally {
    await session.close();
  }
}

export async function deleteEdge(id: string): Promise<void> {
  const session = getDriver().session();
  try {
    await session.run("MATCH ()-[r:RELATED_TO {id: $id}]->() DELETE r", {
      id,
    });
  } finally {
    await session.close();
  }
}
