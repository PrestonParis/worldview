import { count, desc, eq, gte, or } from "drizzle-orm";
import { db } from "./client";
import { entityEdges } from "./schema";
import type { Edge, EdgeInput } from "../validation/edge";

function toEdge(row: typeof entityEdges.$inferSelect): Edge {
  return {
    id: row.id,
    sourceEntityId: row.sourceEntityId,
    targetEntityId: row.targetEntityId,
    label: row.label,
    relType: row.relType,
    role: row.role,
    validFrom: row.validFrom,
    validTo: row.validTo,
    notes: row.notes,
    sourceRecordId: row.sourceRecordId ?? "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function countEdges(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(entityEdges);
  return row.value;
}

export async function countEdgesCreatedSince(since: Date): Promise<number> {
  const [row] = await db.select({ value: count() }).from(entityEdges).where(gte(entityEdges.createdAt, since));
  return row.value;
}

export async function listEdges(): Promise<Edge[]> {
  const rows = await db.select().from(entityEdges).orderBy(desc(entityEdges.createdAt));
  return rows.map(toEdge);
}

// Every edge touching the entity, in either direction.
export async function listEdgesForEntity(entityId: string): Promise<Edge[]> {
  const rows = await db
    .select()
    .from(entityEdges)
    .where(or(eq(entityEdges.sourceEntityId, entityId), eq(entityEdges.targetEntityId, entityId)));
  return rows.map(toEdge);
}

export async function createEdge(input: EdgeInput): Promise<Edge> {
  try {
    const [row] = await db
      .insert(entityEdges)
      .values({
        sourceEntityId: input.sourceEntityId,
        targetEntityId: input.targetEntityId,
        label: input.label,
        relType: input.relType ?? "",
        role: input.role ?? "",
        validFrom: input.validFrom ?? "",
        validTo: input.validTo ?? "",
        notes: input.notes ?? "",
        sourceRecordId: input.sourceRecordId || null,
      })
      .returning();
    return toEdge(row);
  } catch (err) {
    if ((err as { cause?: { code?: string } }).cause?.code === "23503") {
      throw new Error("Couldn't create the relationship. Check that both entities exist.");
    }
    throw err;
  }
}

export async function deleteEdge(id: string): Promise<void> {
  await db.delete(entityEdges).where(eq(entityEdges.id, id));
}
