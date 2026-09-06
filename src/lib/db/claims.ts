import { eq, count, gte } from "drizzle-orm";
import { db } from "./client";
import { claims } from "./schema";
import type { Claim, ClaimInput } from "../validation/claim";

function toClaim(row: typeof claims.$inferSelect): Claim {
  return {
    id: row.id,
    speakerEntityId: row.speakerEntityId,
    date: row.date.toISOString(),
    venue: row.venue ?? "",
    quote: row.quote,
    topic: row.topic ?? "",
    positionClassification: row.positionClassification ?? "",
    confidence: row.confidence,
    contradictsClaimId: row.contradictsClaimId ?? "",
    sourceId: row.sourceId ?? "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listClaims(): Promise<Claim[]> {
  const rows = await db.query.claims.findMany({
    orderBy: (c, { desc }) => desc(c.date),
  });
  return rows.map(toClaim);
}

export async function countClaims(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(claims);
  return row.value;
}

export async function countClaimsCreatedSince(since: Date): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(claims)
    .where(gte(claims.createdAt, since));
  return row.value;
}

export async function listRecentClaims(limit: number): Promise<Claim[]> {
  const rows = await db.query.claims.findMany({
    orderBy: (c, { desc }) => desc(c.createdAt),
    limit,
  });
  return rows.map(toClaim);
}

export async function listClaimsForEntity(
  speakerEntityId: string,
): Promise<Claim[]> {
  const rows = await db.query.claims.findMany({
    where: eq(claims.speakerEntityId, speakerEntityId),
    orderBy: (c, { desc }) => desc(c.date),
  });
  return rows.map(toClaim);
}

export async function createClaim(input: ClaimInput): Promise<Claim> {
  const [row] = await db
    .insert(claims)
    .values({
      speakerEntityId: input.speakerEntityId,
      date: new Date(input.date),
      venue: input.venue || null,
      quote: input.quote,
      topic: input.topic || null,
      positionClassification: input.positionClassification || null,
      confidence: input.confidence ? Number(input.confidence) : null,
      contradictsClaimId: input.contradictsClaimId || null,
      sourceId: input.sourceId || null,
    })
    .returning();
  return toClaim(row);
}

export async function updateClaim(
  id: string,
  input: ClaimInput,
): Promise<Claim | null> {
  const [row] = await db
    .update(claims)
    .set({
      speakerEntityId: input.speakerEntityId,
      date: new Date(input.date),
      venue: input.venue || null,
      quote: input.quote,
      topic: input.topic || null,
      positionClassification: input.positionClassification || null,
      confidence: input.confidence ? Number(input.confidence) : null,
      contradictsClaimId: input.contradictsClaimId || null,
      sourceId: input.sourceId || null,
      updatedAt: new Date(),
    })
    .where(eq(claims.id, id))
    .returning();
  return row ? toClaim(row) : null;
}

export async function deleteClaim(id: string): Promise<void> {
  await db.delete(claims).where(eq(claims.id, id));
}
