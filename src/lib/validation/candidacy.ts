import { z } from "zod";

export const candidacySchema = z.object({
  id: z.uuid().optional(),
  electionId: z.uuid(),
  candidateEntityId: z.uuid("Pick the candidate"),
  party: z.string().max(120).optional().or(z.literal("")),
  incumbent: z.boolean().optional(),
  withdrew: z.boolean().optional(),
  votes: z
    .string()
    .max(15)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || (Number.isFinite(Number(v)) && Number(v) >= 0), {
      message: "Votes must be a non-negative number",
    }),
  won: z.boolean().optional(),
});

export type CandidacyInput = z.infer<typeof candidacySchema>;

export interface Candidacy
  extends Omit<
    CandidacyInput,
    "party" | "incumbent" | "withdrew" | "votes" | "won"
  > {
  id: string;
  party: string;
  incumbent: boolean;
  withdrew: boolean;
  votes: number | null;
  won: boolean;
  // Cycle progress: "filed" | "primary_winner" | "nominee" | "withdrew" |
  // "lost_primary"; "" for historical rows.
  status: string;
  // FEC candidate id, links to candidate_finance; "" when not a federal
  // candidate or not yet matched.
  fecCandidateId: string;
  externalId: string;
  createdAt: string;
}

// Per-election roll-up shown on each list row — the VoteTally analog. Built
// server-side and passed to the client list view as a plain object.
export interface ElectionSummary {
  candidateCount: number;
  totalVotes: number;
  // Highest vote count of any candidacy that has one.
  leaderEntityId: string | null;
  leaderParty: string;
  // The candidacy flagged `won` (authoritative when set — recounts, an
  // electoral-college winner who lost the popular vote, etc.).
  winnerEntityId: string | null;
  winnerParty: string;
  // Leader − runner-up, in votes; null when fewer than two candidacies
  // report a count.
  margin: number | null;
  marginPct: number | null;
  reporting: boolean;
}

// Pure — safe to import from either side of the server/client boundary
// (mirrors formatBillStatus in legislation/bill-status.tsx).
export function summarizeCandidacies(cands: Candidacy[]): ElectionSummary {
  const withVotes = cands.filter(
    (c): c is Candidacy & { votes: number } => c.votes != null,
  );
  const totalVotes = withVotes.reduce((sum, c) => sum + c.votes, 0);
  const sorted = [...withVotes].sort((a, b) => b.votes - a.votes);
  const leader = sorted[0] ?? null;
  const runnerUp = sorted[1] ?? null;
  const winner = cands.find((c) => c.won) ?? null;
  const margin = leader && runnerUp ? leader.votes - runnerUp.votes : null;

  return {
    candidateCount: cands.length,
    totalVotes,
    leaderEntityId: leader?.candidateEntityId ?? null,
    leaderParty: leader?.party ?? "",
    winnerEntityId: winner?.candidateEntityId ?? null,
    winnerParty: winner?.party ?? "",
    margin,
    marginPct: margin != null && totalVotes > 0 ? (margin / totalVotes) * 100 : null,
    reporting: withVotes.length > 0,
  };
}
