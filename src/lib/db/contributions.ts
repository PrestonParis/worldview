import { and, eq, count, sum, sql } from "drizzle-orm";
import { db } from "./client";
import { contributions } from "./schema";
import type { Contribution, ContributionInput } from "../validation/contribution";
import type { CounterpartyTotal, CurrencyTotal, EntityContributionSummary, IndustryBreakdownRow, StateBreakdownRow } from "../money";

// FEC memo lines (memo_code 'X') itemize money already counted on another
// line — a joint-fundraising committee's allocation, a conduit's earmark —
// so every total leaves them out.
export const countedContribution = sql`coalesce(${contributions.memoCode}, '') <> 'X'`;

function toContribution(row: typeof contributions.$inferSelect): Contribution {
  return {
    id: row.id,
    donorEntityId: row.donorEntityId,
    recipientEntityId: row.recipientEntityId,
    amount: row.amount,
    currency: row.currency,
    date: row.date.toISOString(),
    sourceRecordId: row.sourceRecordId ?? "",
    notes: row.notes ?? "",
    contributionType: row.contributionType ?? "",
    donorState: row.donorState ?? "",
    donorCity: row.donorCity ?? "",
    donorZip: row.donorZip ?? "",
    donorIndustry: row.donorIndustry ?? "",
    employer: row.employer ?? "",
    occupation: row.occupation ?? "",
    externalId: row.externalId ?? "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listContributions(): Promise<Contribution[]> {
  const rows = await db.query.contributions.findMany({
    orderBy: (c, { desc }) => desc(c.date),
  });
  return rows.map(toContribution);
}

export async function getContribution(id: string): Promise<Contribution | null> {
  const row = await db.query.contributions.findFirst({ where: eq(contributions.id, id) });
  return row ? toContribution(row) : null;
}

export async function countContributions(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(contributions);
  return row.value;
}

// Grouped by currency, not summed blind across them — a $5,000 total and a
// €5,000 total are not the same $10,000.
export async function listContributionTotalsByCurrency(): Promise<
  { currency: string; total: number }[]
> {
  const rows = await db
    .select({ currency: contributions.currency, total: sum(contributions.amount) })
    .from(contributions)
    .where(countedContribution)
    .groupBy(contributions.currency);
  return rows.map((r) => ({ currency: r.currency, total: Number(r.total ?? 0) }));
}

// One row per (recipient, donor industry, donor, currency) — the single
// query behind /money/industries. The client pivots it: sum by industry
// for the sector bars, filter by recipient (or sum across all), and drill
// into the donors within a sector. donor_industry is "" (not null) here
// when unclassified. Bounded by recipients × industries × donors, which
// stays small for the politician-scoped data this view is about.
export async function listIndustryBreakdown(): Promise<IndustryBreakdownRow[]> {
  const rows = await db
    .select({
      recipientEntityId: contributions.recipientEntityId,
      industry: contributions.donorIndustry,
      donorEntityId: contributions.donorEntityId,
      currency: contributions.currency,
      total: sum(contributions.amount),
      count: count(),
    })
    .from(contributions)
    .where(countedContribution)
    .groupBy(
      contributions.recipientEntityId,
      contributions.donorIndustry,
      contributions.donorEntityId,
      contributions.currency,
    );
  return rows.map((r) => ({
    recipientEntityId: r.recipientEntityId,
    industry: r.industry ?? "",
    donorEntityId: r.donorEntityId,
    currency: r.currency,
    total: Number(r.total ?? 0),
    count: Number(r.count ?? 0),
  }));
}

// One row per (recipient, donor state, donor, currency) — the query behind
// /money/map. Same client-pivot approach as listIndustryBreakdown: the view
// filters by recipient, sums per state for the choropleth, and drills into
// the donors within a state. donor_state is "" when the filing had none.
export async function listStateBreakdown(): Promise<StateBreakdownRow[]> {
  const rows = await db
    .select({
      recipientEntityId: contributions.recipientEntityId,
      state: contributions.donorState,
      donorEntityId: contributions.donorEntityId,
      currency: contributions.currency,
      total: sum(contributions.amount),
      count: count(),
    })
    .from(contributions)
    .where(countedContribution)
    .groupBy(
      contributions.recipientEntityId,
      contributions.donorState,
      contributions.donorEntityId,
      contributions.currency,
    );
  return rows.map((r) => ({
    recipientEntityId: r.recipientEntityId,
    state: (r.state ?? "").toUpperCase(),
    donorEntityId: r.donorEntityId,
    currency: r.currency,
    total: Number(r.total ?? 0),
    count: Number(r.count ?? 0),
  }));
}

export async function getEntityContributionSummary(
  entityId: string,
): Promise<EntityContributionSummary> {
  const amountDesc = sql`sum(${contributions.amount}) desc`;
  const [raisedRows, givenRows, donorRows, recipientRows] = await Promise.all([
    db
      .select({ currency: contributions.currency, total: sum(contributions.amount), count: count() })
      .from(contributions)
      .where(and(eq(contributions.recipientEntityId, entityId), countedContribution))
      .groupBy(contributions.currency),
    db
      .select({ currency: contributions.currency, total: sum(contributions.amount), count: count() })
      .from(contributions)
      .where(and(eq(contributions.donorEntityId, entityId), countedContribution))
      .groupBy(contributions.currency),
    db
      .select({
        entityId: contributions.donorEntityId,
        currency: contributions.currency,
        total: sum(contributions.amount),
        count: count(),
      })
      .from(contributions)
      .where(and(eq(contributions.recipientEntityId, entityId), countedContribution))
      .groupBy(contributions.donorEntityId, contributions.currency)
      .orderBy(amountDesc)
      .limit(8),
    db
      .select({
        entityId: contributions.recipientEntityId,
        currency: contributions.currency,
        total: sum(contributions.amount),
        count: count(),
      })
      .from(contributions)
      .where(and(eq(contributions.donorEntityId, entityId), countedContribution))
      .groupBy(contributions.recipientEntityId, contributions.currency)
      .orderBy(amountDesc)
      .limit(8),
  ]);

  const currencyTotal = (r: { currency: string; total: unknown; count: unknown }): CurrencyTotal => ({
    currency: r.currency,
    total: Number(r.total ?? 0),
    count: Number(r.count ?? 0),
  });
  const counterparty = (r: {
    entityId: string;
    currency: string;
    total: unknown;
    count: unknown;
  }): CounterpartyTotal => ({
    entityId: r.entityId,
    currency: r.currency,
    total: Number(r.total ?? 0),
    count: Number(r.count ?? 0),
  });

  return {
    raised: raisedRows.map(currencyTotal),
    given: givenRows.map(currencyTotal),
    topDonors: donorRows.map(counterparty),
    topRecipients: recipientRows.map(counterparty),
  };
}

// The Phase 2 classification / geography fields, normalized from the form's
// "" sentinels to null. Shared by create + update.
function classificationValues(input: ContributionInput) {
  return {
    contributionType: input.contributionType || null,
    donorState: input.donorState || null,
    donorCity: input.donorCity || null,
    donorZip: input.donorZip || null,
    donorIndustry: input.donorIndustry || null,
    employer: input.employer || null,
    occupation: input.occupation || null,
  };
}

export async function createContribution(input: ContributionInput): Promise<Contribution> {
  const [row] = await db
    .insert(contributions)
    .values({
      donorEntityId: input.donorEntityId,
      recipientEntityId: input.recipientEntityId,
      amount: Number(input.amount),
      currency: input.currency || "USD",
      date: new Date(input.date),
      sourceRecordId: input.sourceRecordId || null,
      notes: input.notes || null,
      ...classificationValues(input),
    })
    .returning();
  return toContribution(row);
}

export async function updateContribution(
  id: string,
  input: ContributionInput,
): Promise<Contribution | null> {
  const [row] = await db
    .update(contributions)
    .set({
      donorEntityId: input.donorEntityId,
      recipientEntityId: input.recipientEntityId,
      amount: Number(input.amount),
      currency: input.currency || "USD",
      date: new Date(input.date),
      sourceRecordId: input.sourceRecordId || null,
      notes: input.notes || null,
      ...classificationValues(input),
      updatedAt: new Date(),
    })
    .where(eq(contributions.id, id))
    .returning();
  return row ? toContribution(row) : null;
}

export async function deleteContribution(id: string): Promise<void> {
  await db.delete(contributions).where(eq(contributions.id, id));
}
