import { eq, count, gte, sum } from "drizzle-orm";
import { db } from "./client";
import { contributions } from "./schema";
import type { Contribution, ContributionInput } from "../validation/contribution";

function toContribution(row: typeof contributions.$inferSelect): Contribution {
  return {
    id: row.id,
    donorEntityId: row.donorEntityId,
    recipientEntityId: row.recipientEntityId,
    amount: row.amount,
    currency: row.currency,
    date: row.date.toISOString(),
    sourceRecordId: row.sourceRecordId ?? "",
    notes: row.notes ?? "",
    externalId: row.externalId ?? "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listContributions(): Promise<Contribution[]> {
  const rows = await db.query.contributions.findMany({
    orderBy: (c, { desc }) => desc(c.date),
  });
  return rows.map(toContribution);
}

export async function getContribution(id: string): Promise<Contribution | null> {
  const row = await db.query.contributions.findFirst({ where: eq(contributions.id, id) });
  return row ? toContribution(row) : null;
}

export async function countContributions(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(contributions);
  return row.value;
}

export async function countContributionsCreatedSince(since: Date): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(contributions)
    .where(gte(contributions.createdAt, since));
  return row.value;
}

// Grouped by currency, not summed blind across them — a $5,000 total and a
// €5,000 total are not the same $10,000.
export async function listContributionTotalsByCurrency(): Promise<
  { currency: string; total: number }[]
> {
  const rows = await db
    .select({ currency: contributions.currency, total: sum(contributions.amount) })
    .from(contributions)
    .groupBy(contributions.currency);
  return rows.map((r) => ({ currency: r.currency, total: Number(r.total ?? 0) }));
}

export async function createContribution(input: ContributionInput): Promise<Contribution> {
  const [row] = await db
    .insert(contributions)
    .values({
      donorEntityId: input.donorEntityId,
      recipientEntityId: input.recipientEntityId,
      amount: Number(input.amount),
      currency: input.currency || "USD",
      date: new Date(input.date),
      sourceRecordId: input.sourceRecordId || null,
      notes: input.notes || null,
    })
    .returning();
  return toContribution(row);
}

export async function updateContribution(
  id: string,
  input: ContributionInput,
): Promise<Contribution | null> {
  const [row] = await db
    .update(contributions)
    .set({
      donorEntityId: input.donorEntityId,
      recipientEntityId: input.recipientEntityId,
      amount: Number(input.amount),
      currency: input.currency || "USD",
      date: new Date(input.date),
      sourceRecordId: input.sourceRecordId || null,
      notes: input.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(contributions.id, id))
    .returning();
  return row ? toContribution(row) : null;
}

export async function deleteContribution(id: string): Promise<void> {
  await db.delete(contributions).where(eq(contributions.id, id));
}
