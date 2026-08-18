import { eq, count, gte } from "drizzle-orm";
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
