import { eq, count, gte, max } from "drizzle-orm";
import { db } from "./client";
import { elections } from "./schema";
import type { Election, ElectionInput } from "../validation/election";
import { validateFederalElectionDate } from "../elections/dates";

function toElection(row: typeof elections.$inferSelect): Election {
  return {
    id: row.id,
    name: row.name,
    office: row.office,
    jurisdiction: row.jurisdiction,
    level: row.level,
    electionType: row.electionType,
    status: row.status,
    electionDate: row.electionDate.toISOString(),
    totalVotes: row.totalVotes,
    priorElectionId: row.priorElectionId ?? "",
    parentElectionId: row.parentElectionId ?? "",
    externalId: row.externalId ?? "",
    cycle: row.cycle ?? null,
    openSeat: row.openSeat,
    seatClass: row.seatClass ?? null,
    notes: row.notes ?? "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRow(input: ElectionInput) {
  const dateError = validateFederalElectionDate(input);
  if (dateError) throw new Error(dateError);
  return {
    name: input.name,
    office: input.office,
    jurisdiction: input.jurisdiction,
    level: input.level,
    electionType: input.electionType,
    status: input.status,
    electionDate: new Date(input.electionDate),
    totalVotes: input.totalVotes ? Number(input.totalVotes) : null,
    priorElectionId: input.priorElectionId || null,
    parentElectionId: input.parentElectionId || null,
    notes: input.notes || null,
  };
}

export async function listElections(): Promise<Election[]> {
  const rows = await db.query.elections.findMany({
    orderBy: (e, { desc }) => desc(e.electionDate),
  });
  return rows.map(toElection);
}

export async function listElectionsByCycle(cycle: number): Promise<Election[]> {
  const rows = await db.query.elections.findMany({
    where: eq(elections.cycle, cycle),
    orderBy: (e, { asc }) => [asc(e.office), asc(e.jurisdiction)],
  });
  return rows.map(toElection);
}

// The most recent cycle any election is tagged with — the dashboard's
// default view.
export async function latestCycle(): Promise<number | null> {
  const [row] = await db.select({ value: max(elections.cycle) }).from(elections);
  return row?.value ?? null;
}

export async function getElection(id: string): Promise<Election | null> {
  const row = await db.query.elections.findFirst({ where: eq(elections.id, id) });
  return row ? toElection(row) : null;
}

export async function countElections(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(elections);
  return row.value;
}

export async function countElectionsCreatedSince(since: Date): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(elections)
    .where(gte(elections.createdAt, since));
  return row.value;
}

export async function createElection(input: ElectionInput): Promise<Election> {
  const [row] = await db.insert(elections).values(toRow(input)).returning();
  return toElection(row);
}

export async function updateElection(
  id: string,
  input: ElectionInput,
): Promise<Election | null> {
  const [row] = await db
    .update(elections)
    .set({ ...toRow(input), updatedAt: new Date() })
    .where(eq(elections.id, id))
    .returning();
  return row ? toElection(row) : null;
}

export async function deleteElection(id: string): Promise<void> {
  await db.delete(elections).where(eq(elections.id, id));
}

// Import / ingest path — re-runnable on a stable externalId, unlike the
// hand-entry create/update above (mirrors the FEC import convention on
// contributions.externalId).
export async function upsertElectionByExternalId(
  externalId: string,
  input: ElectionInput,
): Promise<Election> {
  const [row] = await db
    .insert(elections)
    .values({ ...toRow(input), externalId })
    .onConflictDoUpdate({
      target: elections.externalId,
      set: { ...toRow(input), updatedAt: new Date() },
    })
    .returning();
  return toElection(row);
}
