import { eq, count } from "drizzle-orm";
import { db } from "./client";
import { rollCalls } from "./schema";
import type { RollCall } from "../validation/rollCall";

function toRollCall(row: typeof rollCalls.$inferSelect): RollCall {
  return {
    id: row.id,
    billId: row.billId,
    jurisdiction: row.jurisdiction,
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

export async function countRollCalls(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(rollCalls);
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

