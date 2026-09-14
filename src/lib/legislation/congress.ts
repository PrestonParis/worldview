// Explicit .ts extensions: this module is imported both through Next's
// bundler (the cron route) and by plain Node (scripts/import-congress-*.mjs),
// and Node's ESM resolver does not add extensions.
import { billStatuses } from "../validation/bill.ts";
import { votePositions } from "../validation/vote.ts";

type BillStatus = (typeof billStatuses)[number];
type VotePosition = (typeof votePositions)[number];

// Congress.gov bill types (lowercased). hr/hres/hjres/hconres originate in
// the House; s/sres/sjres/sconres in the Senate.
const HOUSE_BILL_TYPES = new Set(["hr", "hres", "hjres", "hconres"]);
const SENATE_BILL_TYPES = new Set(["s", "sres", "sjres", "sconres"]);

export function chamberForBillType(type: string): string {
  const t = type.toLowerCase();
  if (HOUSE_BILL_TYPES.has(t)) return "House";
  if (SENATE_BILL_TYPES.has(t)) return "Senate";
  return "";
}

// "119-hr-1234" — the bills.external_id idempotency key.
export function billExternalId(
  congress: number,
  type: string,
  number: number | string,
): string {
  return `${congress}-${type.toLowerCase()}-${number}`;
}

const BILL_NUMBER_LABELS: Record<string, string> = {
  hr: "H.R.",
  s: "S.",
  hres: "H.Res.",
  sres: "S.Res.",
  hjres: "H.J.Res.",
  sjres: "S.J.Res.",
  hconres: "H.Con.Res.",
  sconres: "S.Con.Res.",
};

export function billNumberLabel(type: string, number: number | string): string {
  const label = BILL_NUMBER_LABELS[type.toLowerCase()] ?? type.toUpperCase();
  return `${label} ${number}`;
}

// Congress.gov exposes no clean status enum — only `latestAction.text`.
// Map the common phrases onto our `billStatuses`, most-progressed first so
// an enacted bill whose text also mentions "Passed House" still lands on
// "enacted".
export function billStatusFromLatestAction(text: string | null | undefined): BillStatus {
  const t = (text ?? "").toLowerCase();
  if (!t) return "introduced";
  if (t.includes("became public law") || t.includes("signed by president")) return "enacted";
  if (t.includes("veto")) return "vetoed";
  const passedHouse = t.includes("passed house") || t.includes("passed/agreed to in house");
  const passedSenate = t.includes("passed senate") || t.includes("passed/agreed to in senate");
  if (passedHouse && passedSenate) return "passed_both_chambers";
  if (passedHouse || passedSenate || t.includes("resolving differences")) return "passed_chamber";
  if (t.includes("failed") || t.includes("rejected") || t.includes("motion to table")) return "failed";
  if (t.includes("committee") || t.includes("referred to")) return "in_committee";
  return "introduced";
}

// "h119-1-45" / "s119-2-12" — roll_calls.external_id. session is the
// 1-or-2 within a Congress; House number resets each session, Senate's is
// continuous, but the id is unambiguous either way.
export function rollCallExternalId(
  chamber: string,
  congress: number,
  session: number,
  rollNumber: number,
): string {
  const c = chamber.toLowerCase().startsWith("s") ? "s" : "h";
  return `${c}${congress}-${session}-${rollNumber}`;
}

const YEA = new Set(["yea", "aye", "yes", "guilty"]);
const NAY = new Set(["nay", "no", "not guilty"]);
const PRESENT = new Set(["present"]);
const ABSENT = new Set(["not voting", "absent", "present - announced"]);

// Roll-call sources spell positions many ways (House "Aye/No", Senate
// "Yea/Nay", impeachment "Guilty/Not Guilty"). Anything unrecognized is
// treated as absent rather than dropped, so a tally still sums to the
// chamber size.
export function normalizeVotePosition(raw: string | null | undefined): VotePosition {
  const v = (raw ?? "").trim().toLowerCase();
  if (YEA.has(v)) return "yea";
  if (NAY.has(v)) return "nay";
  if (PRESENT.has(v)) return "present";
  if (ABSENT.has(v)) return "absent";
  return "absent";
}

// Newest-first cursor comparison for the incremental bill sweep — both
// values are Congress.gov `updateDate` strings (ISO or "YYYY-MM-DD").
export function isAfterCursor(updateDate: string, cursor: string | null): boolean {
  if (!cursor) return true;
  return updateDate > cursor;
}

// Padded, lexically-sortable roll-call cursor key: "h-1-000045".
export function rollCallCursorKey(
  chamber: string,
  session: number,
  rollNumber: number,
): string {
  const c = chamber.toLowerCase().startsWith("s") ? "s" : "h";
  return `${c}-${session}-${String(rollNumber).padStart(6, "0")}`;
}

// The house/senate vote list endpoints wrap the results array under a
// chamber-specific key that isn't stable across the (newer) endpoints —
// take the first array-valued property. Defensive; the shape is confirmed
// on the first live run.
export function pickResultsArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const value of Object.values(payload as Record<string, unknown>)) {
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

// The vote-metadata object in a Congress.gov vote payload: the non-array
// object carrying `rollCallNumber`. On the /members response this also
// holds `voteQuestion`, which the vote *list* endpoint omits.
export function pickVoteMeta(payload: unknown): Record<string, unknown> {
  const walk = (node: unknown): Record<string, unknown> | null => {
    if (node && typeof node === "object" && !Array.isArray(node)) {
      const obj = node as Record<string, unknown>;
      if ("rollCallNumber" in obj || "voteNumber" in obj) return obj;
      for (const value of Object.values(obj)) {
        const found = walk(value);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(payload) ?? {};
}

// Finds the array of per-member results anywhere in a vote-members payload
// — the array whose entries carry a vote field.
export function findMemberVotes(payload: unknown): Array<Record<string, unknown>> {
  const walk = (node: unknown): Array<Record<string, unknown>> | null => {
    if (Array.isArray(node)) {
      const looksRight = node.some(
        (n) =>
          n &&
          typeof n === "object" &&
          ("voteCast" in n || "vote" in n || "votePosition" in n),
      );
      return looksRight ? (node as Array<Record<string, unknown>>) : null;
    }
    if (node && typeof node === "object") {
      for (const value of Object.values(node as Record<string, unknown>)) {
        const found = walk(value);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(payload) ?? [];
}

// Pulls (bioguideId, rawPosition, party) out of one member-vote entry,
// tolerating the field-name variants seen across the House and Senate
// endpoints.
export function readMemberVote(entry: Record<string, unknown>): {
  bioguideId: string | null;
  position: string;
  party: string;
} {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    bioguideId:
      s(entry.bioguideID) || s(entry.bioguideId) || s(entry.bioGuideId) || null,
    position: s(entry.voteCast) || s(entry.vote) || s(entry.votePosition),
    party: s(entry.voteParty) || s(entry.party),
  };
}
