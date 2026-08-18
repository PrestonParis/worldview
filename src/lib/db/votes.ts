import { eq, count } from "drizzle-orm";
import { db } from "./client";
import { votes } from "./schema";
import type { Vote, VoteInput, VoteTally } from "../validation/vote";

function toVote(row: typeof votes.$inferSelect): Vote {
  return {
    id: row.id,
    billId: row.billId,
    voterEntityId: row.voterEntityId,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listVotesForBill(billId: string): Promise<Vote[]> {
  const rows = await db.query.votes.findMany({
    where: eq(votes.billId, billId),
    orderBy: (v, { desc }) => desc(v.createdAt),
  });
  return rows.map(toVote);
}

function emptyTally(): VoteTally {
  return { yea: 0, nay: 0, present: 0, absent: 0 };
}

// One grouped query for every bill's tally, rather than one query per bill
// — used by the bill list view, which shows a tally per row.
export async function listVoteTalliesByBill(): Promise<Map<string, VoteTally>> {
  const rows = await db
    .select({ billId: votes.billId, position: votes.position, value: count() })
    .from(votes)
    .groupBy(votes.billId, votes.position);

  const tallies = new Map<string, VoteTally>();
  for (const row of rows) {
    const tally = tallies.get(row.billId) ?? emptyTally();
    tally[row.position] = row.value;
    tallies.set(row.billId, tally);
  }
  return tallies;
}

export async function createVote(input: VoteInput): Promise<Vote> {
  const [row] = await db
    .insert(votes)
    .values({
      billId: input.billId,
      voterEntityId: input.voterEntityId,
      position: input.position,
    })
    .returning();
  return toVote(row);
}

export async function deleteVote(id: string): Promise<void> {
  await db.delete(votes).where(eq(votes.id, id));
}
