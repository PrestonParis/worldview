import { z } from "zod";

export const resultAreaKinds = ["county", "precinct", "district", "state"] as const;

export const electionResultSchema = z.object({
  id: z.uuid().optional(),
  electionId: z.uuid(),
  candidacyId: z.uuid(),
  areaKind: z.enum(resultAreaKinds),
  areaId: z.string().min(1, "areaId is required").max(20),
  areaName: z.string().max(200).optional().or(z.literal("")),
  votes: z.coerce.number().int("votes must be a whole number").nonnegative(),
});

export type ElectionResultInput = z.infer<typeof electionResultSchema>;

export interface ElectionResult
  extends Omit<ElectionResultInput, "areaName" | "votes"> {
  id: string;
  areaName: string;
  votes: number;
  externalId: string;
  createdAt: string;
}

// A result row joined with the party of its candidacy — the shape the
// detail-page table and the choropleth aggregation both consume.
export interface ResultRow {
  areaKind: string;
  areaId: string;
  areaName: string;
  candidacyId: string;
  candidateEntityId: string;
  party: string;
  votes: number;
}

// One geographic area's roll-up across an election's candidacies — what the
// choropleth colours a county by and what the area table shows per row.
export interface AreaBreakdown {
  areaId: string;
  areaName: string;
  total: number;
  leaderCandidacyId: string | null;
  leaderParty: string;
  leaderVotes: number;
  runnerUpVotes: number;
  margin: number; // leader − runner-up, in votes
  marginPct: number; // as share of `total`
}

// Per-area winner + margin, built from the flat rows in JS (a few thousand
// per election — cheaper than a windowed SQL query and easier to read).
// Pure — safe on either side of the server/client boundary.
export function areaBreakdowns(rows: ResultRow[]): AreaBreakdown[] {
  const byArea = new Map<string, ResultRow[]>();
  for (const row of rows) {
    const list = byArea.get(row.areaId) ?? [];
    list.push(row);
    byArea.set(row.areaId, list);
  }
  const out: AreaBreakdown[] = [];
  for (const [areaId, list] of byArea) {
    const sorted = [...list].sort((a, b) => b.votes - a.votes);
    const total = list.reduce((s, r) => s + r.votes, 0);
    const leader = sorted[0];
    const runnerUp = sorted[1];
    const margin = leader ? leader.votes - (runnerUp?.votes ?? 0) : 0;
    out.push({
      areaId,
      areaName: leader?.areaName ?? "",
      total,
      leaderCandidacyId: leader?.candidacyId ?? null,
      leaderParty: leader?.party ?? "",
      leaderVotes: leader?.votes ?? 0,
      runnerUpVotes: runnerUp?.votes ?? 0,
      margin,
      marginPct: total > 0 ? (margin / total) * 100 : 0,
    });
  }
  return out;
}
