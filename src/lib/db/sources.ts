import { eq, count, gte } from "drizzle-orm";
import { db } from "./client";
import { sources } from "./schema";
import type { Source, SourceInput } from "../validation/source";

function toSource(row: typeof sources.$inferSelect): Source {
  return {
    id: row.id,
    title: row.title,
    url: row.url ?? "",
    publisher: row.publisher ?? "",
    sourceType: row.sourceType,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : "",
    notes: row.notes ?? "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listSources(): Promise<Source[]> {
  const rows = await db.query.sources.findMany({
    orderBy: (s, { desc }) => desc(s.createdAt),
  });
  return rows.map(toSource);
}

export async function countSources(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(sources);
  return row.value;
}

export async function countSourcesCreatedSince(since: Date): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(sources)
    .where(gte(sources.createdAt, since));
  return row.value;
}

export async function getSource(id: string): Promise<Source | null> {
  const row = await db.query.sources.findFirst({
    where: eq(sources.id, id),
  });
  return row ? toSource(row) : null;
}

export async function createSource(input: SourceInput): Promise<Source> {
  const [row] = await db
    .insert(sources)
    .values({
      title: input.title,
      url: input.url || null,
      publisher: input.publisher || null,
      sourceType: input.sourceType,
      publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
      notes: input.notes || null,
    })
    .returning();
  return toSource(row);
}

export async function updateSource(
  id: string,
  input: SourceInput,
): Promise<Source | null> {
  const [row] = await db
    .update(sources)
    .set({
      title: input.title,
      url: input.url || null,
      publisher: input.publisher || null,
      sourceType: input.sourceType,
      publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
      notes: input.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(sources.id, id))
    .returning();
  return row ? toSource(row) : null;
}

export async function deleteSource(id: string): Promise<void> {
  await db.delete(sources).where(eq(sources.id, id));
}
