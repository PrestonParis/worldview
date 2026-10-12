import { and, eq, inArray, sum } from "drizzle-orm";
import { db } from "./client";
import { independentExpenditures } from "./schema";

export interface CandidateOutsideSpending {
  support: number;
  oppose: number;
}

export async function outsideSpendingByCandidate(entityIds: string[], cycle: number): Promise<Map<string, CandidateOutsideSpending>> {
  if (!entityIds.length) return new Map();
  const rows = await db
    .select({
      entityId: independentExpenditures.candidateEntityId,
      position: independentExpenditures.supportOppose,
      total: sum(independentExpenditures.amount),
    })
    .from(independentExpenditures)
    .where(and(eq(independentExpenditures.cycle, cycle), inArray(independentExpenditures.candidateEntityId, entityIds)))
    .groupBy(independentExpenditures.candidateEntityId, independentExpenditures.supportOppose);

  const result = new Map<string, CandidateOutsideSpending>();
  for (const row of rows) {
    if (!row.entityId) continue;
    const current = result.get(row.entityId) ?? { support: 0, oppose: 0 };
    if (row.position === "S") current.support += Number(row.total ?? 0);
    if (row.position === "O") current.oppose += Number(row.total ?? 0);
    result.set(row.entityId, current);
  }
  return result;
}
