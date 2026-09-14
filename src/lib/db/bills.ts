import { eq, count, gte } from "drizzle-orm";
import { db } from "./client";
import { bills } from "./schema";
import type { Bill, BillInput, BillImportInput } from "../validation/bill";

function toBill(row: typeof bills.$inferSelect): Bill {
  return {
    id: row.id,
    billNumber: row.billNumber,
    title: row.title,
    summary: row.summary ?? "",
    status: row.status,
    chamber: row.chamber ?? "",
    introducedDate: row.introducedDate.toISOString(),
    sponsorEntityId: row.sponsorEntityId,
    congress: row.congress,
    externalId: row.externalId,
    policyArea: row.policyArea ?? "",
    subjects: row.subjects ?? "",
    latestActionDate: row.latestActionDate?.toISOString() ?? "",
    latestActionText: row.latestActionText ?? "",
    syncedAt: row.syncedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listBills(): Promise<Bill[]> {
  const rows = await db.query.bills.findMany({
    orderBy: (b, { desc }) => desc(b.introducedDate),
  });
  return rows.map(toBill);
}

export async function getBill(id: string): Promise<Bill | null> {
  const row = await db.query.bills.findFirst({ where: eq(bills.id, id) });
  return row ? toBill(row) : null;
}

export async function getBillByExternalId(externalId: string): Promise<Bill | null> {
  const row = await db.query.bills.findFirst({
    where: eq(bills.externalId, externalId),
  });
  return row ? toBill(row) : null;
}

export async function countBills(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(bills);
  return row.value;
}

export async function countBillsCreatedSince(since: Date): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(bills)
    .where(gte(bills.createdAt, since));
  return row.value;
}

export async function createBill(input: BillInput): Promise<Bill> {
  const [row] = await db
    .insert(bills)
    .values({
      billNumber: input.billNumber,
      title: input.title,
      summary: input.summary || null,
      status: input.status,
      chamber: input.chamber || null,
      introducedDate: new Date(input.introducedDate),
      sponsorEntityId: input.sponsorEntityId,
    })
    .returning();
  return toBill(row);
}

export async function updateBill(
  id: string,
  input: BillInput,
): Promise<Bill | null> {
  const [row] = await db
    .update(bills)
    .set({
      billNumber: input.billNumber,
      title: input.title,
      summary: input.summary || null,
      status: input.status,
      chamber: input.chamber || null,
      introducedDate: new Date(input.introducedDate),
      sponsorEntityId: input.sponsorEntityId,
      updatedAt: new Date(),
    })
    .where(eq(bills.id, id))
    .returning();
  return row ? toBill(row) : null;
}

export async function deleteBill(id: string): Promise<void> {
  await db.delete(bills).where(eq(bills.id, id));
}

// Idempotent upsert for the Congress.gov importer, keyed on `externalId`.
// Bills advance through statuses, so an existing row has its mutable fields
// refreshed (status, latest action, subjects, sponsor if it now resolves)
// rather than being left stale. Pre-checks existence rather than leaning on
// a RETURNING xmax trick — importer runs aren't latency-critical and are
// single-threaded, and the unique index still guards a true race.
export async function upsertBillFromImport(
  input: BillImportInput,
): Promise<{ bill: Bill; inserted: boolean }> {
  const existing = await db.query.bills.findFirst({
    columns: { id: true },
    where: eq(bills.externalId, input.externalId),
  });

  const mutable = {
    title: input.title,
    summary: input.summary || null,
    status: input.status,
    chamber: input.chamber || null,
    sponsorEntityId: input.sponsorEntityId ?? null,
    policyArea: input.policyArea || null,
    subjects: input.subjects || null,
    latestActionDate: input.latestActionDate
      ? new Date(input.latestActionDate)
      : null,
    latestActionText: input.latestActionText || null,
    sourceId: input.sourceId ?? null,
    syncedAt: new Date(),
    updatedAt: new Date(),
  };

  if (existing) {
    const [row] = await db
      .update(bills)
      .set(mutable)
      .where(eq(bills.id, existing.id))
      .returning();
    return { bill: toBill(row), inserted: false };
  }

  const [row] = await db
    .insert(bills)
    .values({
      ...mutable,
      externalId: input.externalId,
      congress: input.congress,
      billNumber: input.billNumber,
      introducedDate: new Date(input.introducedDate),
    })
    .returning();
  return { bill: toBill(row), inserted: true };
}
