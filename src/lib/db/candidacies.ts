import { desc, eq } from "drizzle-orm";
import { db } from "./client";
import { candidacies, elections } from "./schema";
import { type Candidacy, type CandidacyInput } from "../validation/candidacy";

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

export interface EntityCandidacy extends Candidacy {
  election: {
    id: string;
    name: string;
    office: string;
    jurisdiction: string;
    electionType: string;
    status: string;
    electionDate: string;
    cycle: number | null;
  };
}

// Every race one person has run in, newest first, with the election attached.
export async function listCandidaciesForEntity(entityId: string): Promise<EntityCandidacy[]> {
  const rows = await db
    .select({ candidacy: candidacies, election: elections })
    .from(candidacies)
    .innerJoin(elections, eq(elections.id, candidacies.electionId))
    .where(eq(candidacies.candidateEntityId, entityId))
    .orderBy(desc(elections.electionDate));
  return rows.map(({ candidacy, election }) => ({
    ...toCandidacy(candidacy),
    election: {
      id: election.id,
      name: election.name,
      office: election.office,
      jurisdiction: election.jurisdiction,
      electionType: election.electionType,
      status: election.status,
      electionDate: election.electionDate.toISOString(),
      cycle: election.cycle,
    },
  }));
}

export async function createCandidacy(input: CandidacyInput): Promise<Candidacy> {
  const [row] = await db.insert(candidacies).values(toRow(input)).returning();
  return toCandidacy(row);
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
