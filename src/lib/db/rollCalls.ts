import { eq, count, gte } from "drizzle-orm";
import { db } from "./client";
import { rollCalls } from "./schema";
import type { RollCall, RollCallImportInput } from "../validation/rollCall";

function toRollCall(row: typeof rollCalls.$inferSelect): RollCall {
  return {
    id: row.id,
    billId: row.billId,
    congress: row.congress,
    chamber: row.chamber,
    session: row.session,
    rollNumber: row.rollNumber,
    question: row.question ?? "",
    voteType: row.voteType ?? "",
    result: row.result ?? "",
    date: row.date.toISOString(),
    externalId: row.externalId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listRollCallsForBill(billId: string): Promise<RollCall[]> {
  const rows = await db.query.rollCalls.findMany({
    where: eq(rollCalls.billId, billId),
    orderBy: (r, { desc: d }) => d(r.date),
  });
  return rows.map(toRollCall);
}

export async function getRollCall(id: string): Promise<RollCall | null> {
  const row = await db.query.rollCalls.findFirst({ where: eq(rollCalls.id, id) });
  return row ? toRollCall(row) : null;
}

export async function getRollCallByExternalId(
  externalId: string,
): Promise<RollCall | null> {
  const row = await db.query.rollCalls.findFirst({
    where: eq(rollCalls.externalId, externalId),
  });
  return row ? toRollCall(row) : null;
}

export async function countRollCalls(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(rollCalls);
  return row.value;
}

export async function countRollCallsCreatedSince(since: Date): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(rollCalls)
    .where(gte(rollCalls.createdAt, since));
  return row.value;
}

// Roll-call count per bill, one grouped query — the /legislation list shows
// it per row alongside the (bill-level) tally.
export async function listRollCallCountsByBill(): Promise<Map<string, number>> {
  const rows = await db
    .select({ billId: rollCalls.billId, value: count() })
    .from(rollCalls)
    .groupBy(rollCalls.billId);
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.billId) counts.set(row.billId, row.value);
  }
  return counts;
}

// Idempotent upsert keyed on `externalId`. A roll call's own fields don't
// change after the vote is recorded, so a conflict just refreshes the
// bill link and metadata and returns the existing id.
export async function upsertRollCallFromImport(
  input: RollCallImportInput,
): Promise<{ rollCall: RollCall; inserted: boolean }> {
  const existing = await db.query.rollCalls.findFirst({
    where: eq(rollCalls.externalId, input.externalId),
  });

  const mutable = {
    billId: input.billId ?? null,
    question: input.question || null,
    voteType: input.voteType || null,
    result: input.result || null,
    sourceId: input.sourceId ?? null,
    updatedAt: new Date(),
  };

  if (existing) {
    const [row] = await db
      .update(rollCalls)
      .set(mutable)
      .where(eq(rollCalls.id, existing.id))
      .returning();
    return { rollCall: toRollCall(row), inserted: false };
  }

  const [row] = await db
    .insert(rollCalls)
    .values({
      ...mutable,
      externalId: input.externalId,
      congress: input.congress,
      chamber: input.chamber,
      session: input.session ?? null,
      rollNumber: input.rollNumber,
      date: new Date(input.date),
    })
    .returning();
  return { rollCall: toRollCall(row), inserted: true };
}
