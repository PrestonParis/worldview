import { eq, and, count, desc } from "drizzle-orm";
import { db } from "./client";
import { candidateFinance } from "./schema";

export interface CandidateFinance {
  id: string;
  entityId: string;
  cycle: number;
  fecCandidateId: string;
  party: string;
  office: string;
  state: string;
  district: string;
  incumbentChallenge: string;
  totalReceipts: number | null;
  totalDisbursements: number | null;
  cashOnHand: number | null;
  debtsOwed: number | null;
  individualContributions: number | null;
  pacContributions: number | null;
  partyContributions: number | null;
  coverageEndDate: string;
  updatedAt: string;
}

function toCandidateFinance(row: typeof candidateFinance.$inferSelect): CandidateFinance {
  return {
    id: row.id,
    entityId: row.entityId,
    cycle: row.cycle,
    fecCandidateId: row.fecCandidateId ?? "",
    party: row.party ?? "",
    office: row.office ?? "",
    state: row.state ?? "",
    district: row.district ?? "",
    incumbentChallenge: row.incumbentChallenge ?? "",
    totalReceipts: row.totalReceipts,
    totalDisbursements: row.totalDisbursements,
    cashOnHand: row.cashOnHand,
    debtsOwed: row.debtsOwed,
    individualContributions: row.individualContributions,
    pacContributions: row.pacContributions,
    partyContributions: row.partyContributions,
    coverageEndDate: row.coverageEndDate ? row.coverageEndDate.toISOString() : "",
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listCandidateFinance(cycle: number): Promise<CandidateFinance[]> {
  const rows = await db
    .select()
    .from(candidateFinance)
    .where(eq(candidateFinance.cycle, cycle))
    .orderBy(desc(candidateFinance.totalReceipts));
  return rows.map(toCandidateFinance);
}

export async function getCandidateFinanceForEntity(
  entityId: string,
  cycle?: number,
): Promise<CandidateFinance | null> {
  const row = await db.query.candidateFinance.findFirst({
    where: cycle
      ? and(eq(candidateFinance.entityId, entityId), eq(candidateFinance.cycle, cycle))
      : eq(candidateFinance.entityId, entityId),
    orderBy: (c, { desc: d }) => [d(c.cycle)],
  });
  return row ? toCandidateFinance(row) : null;
}

export async function listCycles(): Promise<number[]> {
  const rows = await db
    .selectDistinct({ cycle: candidateFinance.cycle })
    .from(candidateFinance)
    .orderBy(desc(candidateFinance.cycle));
  return rows.map((r) => r.cycle);
}

export async function countCandidateFinance(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(candidateFinance);
  return row.value;
}
