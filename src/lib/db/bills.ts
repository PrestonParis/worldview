import { and, count, desc, eq, ilike, inArray, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "./client";
import { bills } from "./schema";
import type { Bill, BillInput } from "../validation/bill";

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

export interface BillSearch {
  q?: string;
  status?: string;
  chamber?: string;
  policyArea?: string;
  sponsorIds?: string[]; // entities whose names matched `q`
  sponsorEntityId?: string; // only bills this member sponsored
  page?: number;
  pageSize?: number;
}

// One page of bills, newest activity first, filtered in SQL so the list
// page never ships the whole Congress to the browser.
export async function searchBills({
  q = "",
  status,
  chamber,
  policyArea,
  sponsorIds = [],
  sponsorEntityId,
  page = 1,
  pageSize = 50,
}: BillSearch): Promise<{ bills: Bill[]; total: number }> {
  const conditions: (SQL | undefined)[] = [];
  const text = q.trim();
  if (text) {
    const like = `%${text.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conditions.push(
      or(
        ilike(bills.title, like),
        ilike(bills.billNumber, like),
        // "HR 1" / "hr1" also find "H.R. 1".
        sql`regexp_replace(lower(${bills.billNumber}), '[^a-z0-9]', '', 'g') = regexp_replace(lower(${text}), '[^a-z0-9]', '', 'g')`,
        sponsorIds.length ? inArray(bills.sponsorEntityId, sponsorIds) : undefined,
      ),
    );
  }
  if (status) conditions.push(eq(bills.status, status as Bill["status"]));
  if (chamber) conditions.push(eq(bills.chamber, chamber));
  if (policyArea) conditions.push(eq(bills.policyArea, policyArea));
  if (sponsorEntityId) conditions.push(eq(bills.sponsorEntityId, sponsorEntityId));
  const where = and(...conditions);

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(bills)
      .where(where)
      .orderBy(sql`${bills.latestActionDate} desc nulls last`, desc(bills.introducedDate))
      .limit(pageSize)
      .offset((Math.max(1, page) - 1) * pageSize),
    db.select({ value: count() }).from(bills).where(where),
  ]);
  return { bills: rows.map(toBill), total };
}

// Policy areas with bill counts, for the list filter.
export async function listPolicyAreas(): Promise<{ name: string; count: number }[]> {
  return db
    .select({ name: sql<string>`${bills.policyArea}`, count: count() })
    .from(bills)
    .where(isNotNull(bills.policyArea))
    .groupBy(bills.policyArea)
    .orderBy(bills.policyArea);
}

export async function getBill(id: string): Promise<Bill | null> {
  const row = await db.query.bills.findFirst({ where: eq(bills.id, id) });
  return row ? toBill(row) : null;
}

export async function countBills(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(bills);
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

