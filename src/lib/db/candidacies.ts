import { eq } from "drizzle-orm";
import { db } from "./client";
import { candidacies } from "./schema";
import {
  summarizeCandidacies,
  type Candidacy,
  type CandidacyInput,
  type ElectionSummary,
} from "../validation/candidacy";

function toCandidacy(row: typeof candidacies.$inferSelect): Candidacy {
  return {
    id: row.id,
    electionId: row.electionId,
    candidateEntityId: row.candidateEntityId,
    party: row.party ?? "",
    incumbent: row.incumbent,
    withdrew: row.withdrew,
    votes: row.votes,
    won: row.won,
    status: row.status ?? "",
    fecCandidateId: row.fecCandidateId ?? "",
    externalId: row.externalId ?? "",
    createdAt: row.createdAt.toISOString(),
  };
}

function toRow(input: CandidacyInput) {
  return {
    electionId: input.electionId,
    candidateEntityId: input.candidateEntityId,
    party: input.party || null,
    incumbent: input.incumbent ?? false,
    withdrew: input.withdrew ?? false,
    votes: input.votes ? Number(input.votes) : null,
    won: input.won ?? false,
  };
}

export async function listCandidaciesForElection(
  electionId: string,
): Promise<Candidacy[]> {
  const rows = await db.query.candidacies.findMany({
    where: eq(candidacies.electionId, electionId),
    orderBy: (c, { asc }) => asc(c.createdAt),
  });
  return rows.map(toCandidacy);
}

// One query for every election's roll-up, rather than one per election —
// used by the list view, which shows a summary per row (mirrors
// listVoteTalliesByBill).
export async function listElectionSummariesByElection(): Promise<
  Map<string, ElectionSummary>
> {
  const rows = await db.select().from(candidacies);
  const byElection = new Map<string, Candidacy[]>();
  for (const row of rows) {
    const list = byElection.get(row.electionId) ?? [];
    list.push(toCandidacy(row));
    byElection.set(row.electionId, list);
  }
  const summaries = new Map<string, ElectionSummary>();
  for (const [electionId, list] of byElection) {
    summaries.set(electionId, summarizeCandidacies(list));
  }
  return summaries;
}

export async function createCandidacy(input: CandidacyInput): Promise<Candidacy> {
  const [row] = await db.insert(candidacies).values(toRow(input)).returning();
  return toCandidacy(row);
}

export async function updateCandidacy(
  id: string,
  input: CandidacyInput,
): Promise<Candidacy | null> {
  const [row] = await db
    .update(candidacies)
    .set(toRow(input))
    .where(eq(candidacies.id, id))
    .returning();
  return row ? toCandidacy(row) : null;
}

export async function deleteCandidacy(id: string): Promise<void> {
  await db.delete(candidacies).where(eq(candidacies.id, id));
}

// Import / ingest path — re-runnable on a stable externalId.
export async function upsertCandidacyByExternalId(
  externalId: string,
  input: CandidacyInput,
): Promise<Candidacy> {
  const [row] = await db
    .insert(candidacies)
    .values({ ...toRow(input), externalId })
    .onConflictDoUpdate({
      target: candidacies.externalId,
      set: toRow(input),
    })
    .returning();
  return toCandidacy(row);
}
