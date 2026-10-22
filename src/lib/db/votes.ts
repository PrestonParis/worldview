import { eq, count, isNull, and } from "drizzle-orm";
import { db } from "./client";
import { votes } from "./schema";
import {
  emptyTally,
  type Vote,
  type VoteInput,
  type VoteTally,
  type RollCallVoteInput,
} from "../validation/vote";

function toVote(row: typeof votes.$inferSelect): Vote {
  return {
    id: row.id,
    billId: row.billId,
    rollCallId: row.rollCallId,
    voterEntityId: row.voterEntityId,
    position: row.position,
    party: row.party,
    createdAt: row.createdAt.toISOString(),
  };
}

// Bill-level (hand-entered) votes for a bill — the ones the VotesEditor
// manages. Roll-call votes are read via `listVotesForRollCall`.
export async function listVotesForBill(billId: string): Promise<Vote[]> {
  const rows = await db.query.votes.findMany({
    where: and(eq(votes.billId, billId), isNull(votes.rollCallId)),
    orderBy: (v, { desc }) => desc(v.createdAt),
  });
  return rows.map(toVote);
}

export async function listVotesForRollCall(rollCallId: string): Promise<Vote[]> {
  const rows = await db.query.votes.findMany({
    where: eq(votes.rollCallId, rollCallId),
    orderBy: (v, { desc }) => desc(v.createdAt),
  });
  return rows.map(toVote);
}

// One grouped query for every bill's *bill-level* tally (roll_call_id null)
// — the /legislation list shows this per row. Summing across a bill's roll
// calls would double-count members, so roll-call detail is per roll call.
export async function listVoteTalliesByBill(): Promise<Map<string, VoteTally>> {
  const rows = await db
    .select({ billId: votes.billId, position: votes.position, value: count() })
    .from(votes)
    .where(isNull(votes.rollCallId))
    .groupBy(votes.billId, votes.position);

  const tallies = new Map<string, VoteTally>();
  for (const row of rows) {
    if (!row.billId) continue;
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

// Replaces every recorded vote for a roll call in one transaction — the
// importer re-runs whole roll calls, and a roll call's membership is fixed
// once recorded, so delete-then-insert is simpler and safer than diffing.
// Returns the number of vote rows written.
export async function replaceRollCallVotes(
  rollCallId: string,
  rows: RollCallVoteInput[],
): Promise<number> {
  return db.transaction(async (tx) => {
    await tx.delete(votes).where(eq(votes.rollCallId, rollCallId));
    if (rows.length === 0) return 0;
    await tx.insert(votes).values(
      rows.map((r) => ({
        rollCallId,
        billId: r.billId ?? null,
        voterEntityId: r.voterEntityId,
        position: r.position,
        party: r.party || null,
      })),
    );
    return rows.length;
  });
}
