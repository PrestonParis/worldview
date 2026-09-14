import { eq, and, isNotNull, inArray, desc } from "drizzle-orm";
import { db } from "./client";
import { votes, rollCalls, bills } from "./schema";
import type { votePositions } from "../validation/vote";
import type { MinimalVote } from "../legislation/votingRecord";

type Position = (typeof votePositions)[number];

export interface VoterRollCallVote {
  voteId: string;
  rollCallId: string;
  position: Position;
  party: string | null;
  chamber: string;
  rollNumber: number;
  question: string;
  result: string;
  date: string;
  billId: string | null;
  billNumber: string | null;
  billTitle: string | null;
  policyArea: string | null;
}

// Every roll-call vote this member cast, newest first, with roll-call and
// (when linked) bill context for the record view and its policy-area filter.
export async function listVoterRollCallVotes(
  entityId: string,
): Promise<VoterRollCallVote[]> {
  const rows = await db
    .select({
      voteId: votes.id,
      rollCallId: rollCalls.id,
      position: votes.position,
      party: votes.party,
      chamber: rollCalls.chamber,
      rollNumber: rollCalls.rollNumber,
      question: rollCalls.question,
      result: rollCalls.result,
      date: rollCalls.date,
      billId: bills.id,
      billNumber: bills.billNumber,
      billTitle: bills.title,
      policyArea: bills.policyArea,
    })
    .from(votes)
    .innerJoin(rollCalls, eq(votes.rollCallId, rollCalls.id))
    .leftJoin(bills, eq(rollCalls.billId, bills.id))
    .where(and(eq(votes.voterEntityId, entityId), isNotNull(votes.rollCallId)))
    .orderBy(desc(rollCalls.date));

  return rows.map((r) => ({
    voteId: r.voteId,
    rollCallId: r.rollCallId,
    position: r.position,
    party: r.party,
    chamber: r.chamber,
    rollNumber: r.rollNumber,
    question: r.question ?? "",
    result: r.result ?? "",
    date: r.date.toISOString(),
    billId: r.billId,
    billNumber: r.billNumber,
    billTitle: r.billTitle,
    policyArea: r.policyArea,
  }));
}

// All votes on the given roll calls, grouped by roll call — the input to
// partyMajorityPosition / brokeWithParty.
export async function votesByRollCall(
  rollCallIds: string[],
): Promise<Map<string, MinimalVote[]>> {
  const out = new Map<string, MinimalVote[]>();
  if (rollCallIds.length === 0) return out;
  const rows = await db
    .select({
      rollCallId: votes.rollCallId,
      voterEntityId: votes.voterEntityId,
      position: votes.position,
      party: votes.party,
    })
    .from(votes)
    .where(inArray(votes.rollCallId, rollCallIds));
  for (const r of rows) {
    if (!r.rollCallId) continue;
    const list = out.get(r.rollCallId) ?? [];
    list.push({ voterEntityId: r.voterEntityId, position: r.position, party: r.party });
    out.set(r.rollCallId, list);
  }
  return out;
}

export interface SharedVote {
  rollCallId: string;
  chamber: string;
  rollNumber: number;
  question: string;
  date: string;
  billId: string | null;
  billNumber: string | null;
  billTitle: string | null;
  positionA: Position;
  positionB: Position;
}

// Roll calls both members voted on, with each member's position and
// roll-call/bill context — for the compare view's agreement rate and
// disagreement list.
export async function listSharedVotes(
  entityIdA: string,
  entityIdB: string,
): Promise<SharedVote[]> {
  const [aRows, bRows] = await Promise.all([
    listVoterRollCallVotes(entityIdA),
    listVoterRollCallVotes(entityIdB),
  ]);
  const bByRollCall = new Map(bRows.map((r) => [r.rollCallId, r]));

  const shared: SharedVote[] = [];
  for (const a of aRows) {
    const b = bByRollCall.get(a.rollCallId);
    if (!b) continue;
    shared.push({
      rollCallId: a.rollCallId,
      chamber: a.chamber,
      rollNumber: a.rollNumber,
      question: a.question,
      date: a.date,
      billId: a.billId,
      billNumber: a.billNumber,
      billTitle: a.billTitle,
      positionA: a.position,
      positionB: b.position,
    });
  }
  return shared;
}
