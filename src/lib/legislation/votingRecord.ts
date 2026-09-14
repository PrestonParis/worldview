// Pure analysis over roll-call votes — party-line detection and pairwise
// agreement. No I/O; covered by votingRecord.test.ts.

import type { votePositions } from "../validation/vote";

type Position = (typeof votePositions)[number];

export interface MinimalVote {
  voterEntityId: string;
  position: Position;
  party: string | null;
}

// Normalize the many party spellings the importer snapshots ("R",
// "Republican", "D", "Democrat", "I", "Independent", …) to a single letter.
export function normalizeParty(party: string | null | undefined): string {
  const p = (party ?? "").trim().toLowerCase();
  if (!p) return "";
  if (p.startsWith("r")) return "R";
  if (p.startsWith("d")) return "D";
  if (p.startsWith("i")) return "I";
  return p[0].toUpperCase();
}

// The yea/nay position a majority of a given party took on one roll call.
// Only yea and nay count (present/absent aren't a position); null on a tie
// or when the party cast no decisive votes.
export function partyMajorityPosition(
  votes: MinimalVote[],
  party: string,
): Position | null {
  const norm = normalizeParty(party);
  let yea = 0;
  let nay = 0;
  for (const v of votes) {
    if (normalizeParty(v.party) !== norm) continue;
    if (v.position === "yea") yea++;
    else if (v.position === "nay") nay++;
  }
  if (yea === 0 && nay === 0) return null;
  if (yea === nay) return null;
  return yea > nay ? "yea" : "nay";
}

// True when the member cast a decisive vote (yea/nay) opposite their own
// party's majority on that roll call.
export function brokeWithParty(member: MinimalVote, rollCallVotes: MinimalVote[]): boolean {
  if (member.position !== "yea" && member.position !== "nay") return false;
  const majority = partyMajorityPosition(rollCallVotes, member.party ?? "");
  if (!majority) return false;
  return member.position !== majority;
}

export interface AgreementSummary {
  shared: number; // roll calls where both cast a yea/nay
  agreed: number;
  rate: number; // agreed / shared, 0 when shared === 0
}

// Agreement between two members over the roll calls both voted on (yea/nay
// only). `positionsByRollCall` maps rollCallId -> [positionA, positionB].
export function agreementRate(
  positionsByRollCall: Map<string, [Position, Position]>,
): AgreementSummary {
  let shared = 0;
  let agreed = 0;
  for (const [a, b] of positionsByRollCall.values()) {
    const aDecisive = a === "yea" || a === "nay";
    const bDecisive = b === "yea" || b === "nay";
    if (!aDecisive || !bDecisive) continue;
    shared++;
    if (a === b) agreed++;
  }
  return { shared, agreed, rate: shared === 0 ? 0 : agreed / shared };
}
