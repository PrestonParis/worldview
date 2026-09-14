import { eq, sql } from "drizzle-orm";
import { db } from "./client";
import { electionResults, candidacies } from "./schema";
import type {
  ElectionResultInput,
  ResultRow,
} from "../validation/electionResult";

export { areaBreakdowns } from "../validation/electionResult";
export type { ResultRow } from "../validation/electionResult";

export async function listResultsForElection(
  electionId: string,
): Promise<ResultRow[]> {
  const rows = await db
    .select({
      areaKind: electionResults.areaKind,
      areaId: electionResults.areaId,
      areaName: electionResults.areaName,
      candidacyId: electionResults.candidacyId,
      candidateEntityId: candidacies.candidateEntityId,
      party: candidacies.party,
      votes: electionResults.votes,
    })
    .from(electionResults)
    .innerJoin(candidacies, eq(candidacies.id, electionResults.candidacyId))
    .where(eq(electionResults.electionId, electionId));

  return rows.map((r) => ({
    areaKind: r.areaKind,
    areaId: r.areaId,
    areaName: r.areaName ?? "",
    candidacyId: r.candidacyId,
    candidateEntityId: r.candidateEntityId,
    party: r.party ?? "",
    votes: r.votes,
  }));
}

export async function electionIdsWithResults(): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ id: electionResults.electionId })
    .from(electionResults);
  return new Set(rows.map((r) => r.id));
}

export async function countElectionResults(): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(electionResults);
  return row?.value ?? 0;
}

function toRow(input: ElectionResultInput) {
  return {
    electionId: input.electionId,
    candidacyId: input.candidacyId,
    areaKind: input.areaKind,
    areaId: input.areaId,
    areaName: input.areaName || null,
    votes: input.votes,
  };
}

export async function createElectionResult(input: ElectionResultInput) {
  const [row] = await db.insert(electionResults).values(toRow(input)).returning();
  return row;
}

export async function upsertElectionResultByExternalId(
  externalId: string,
  input: ElectionResultInput,
) {
  const [row] = await db
    .insert(electionResults)
    .values({ ...toRow(input), externalId })
    .onConflictDoUpdate({
      target: electionResults.externalId,
      set: { votes: input.votes, areaName: input.areaName || null },
    })
    .returning();
  return row;
}
