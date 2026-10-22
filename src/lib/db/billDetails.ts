import { eq, asc, desc } from "drizzle-orm";
import { db } from "./client";
import {
  billCosponsors,
  billActions,
  billCommittees,
  billRelations,
  billTextVersions,
} from "./schema";
import type {
  BillCosponsor,
  BillCosponsorInput,
  BillAction,
  BillActionInput,
  BillCommittee,
  BillCommitteeInput,
  BillRelation,
  BillRelationInput,
  BillTextVersion,
  BillTextVersionInput,
} from "../validation/billDetail";

// ── Cosponsors ───────────────────────────────────────────────────────────

function toCosponsor(row: typeof billCosponsors.$inferSelect): BillCosponsor {
  return {
    id: row.id,
    billId: row.billId,
    entityId: row.entityId,
    date: row.date?.toISOString() ?? "",
    isOriginal: row.isOriginal,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listCosponsors(billId: string): Promise<BillCosponsor[]> {
  const rows = await db.query.billCosponsors.findMany({
    where: eq(billCosponsors.billId, billId),
    orderBy: [desc(billCosponsors.isOriginal), asc(billCosponsors.date)],
  });
  return rows.map(toCosponsor);
}

export async function createCosponsor(
  input: BillCosponsorInput,
): Promise<BillCosponsor> {
  const [row] = await db
    .insert(billCosponsors)
    .values({
      billId: input.billId,
      entityId: input.entityId,
      date: input.date ? new Date(input.date) : null,
      isOriginal: input.isOriginal ?? false,
    })
    .returning();
  return toCosponsor(row);
}

export async function deleteCosponsor(id: string): Promise<void> {
  await db.delete(billCosponsors).where(eq(billCosponsors.id, id));
}

// ── Actions ──────────────────────────────────────────────────────────────

function toAction(row: typeof billActions.$inferSelect): BillAction {
  return {
    id: row.id,
    billId: row.billId,
    date: row.date.toISOString(),
    chamber: row.chamber ?? "",
    text: row.text,
    actionType: row.actionType ?? "",
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listActions(billId: string): Promise<BillAction[]> {
  const rows = await db.query.billActions.findMany({
    where: eq(billActions.billId, billId),
    orderBy: [desc(billActions.date)],
  });
  return rows.map(toAction);
}

export async function createAction(input: BillActionInput): Promise<BillAction> {
  const [row] = await db
    .insert(billActions)
    .values({
      billId: input.billId,
      date: new Date(input.date),
      chamber: input.chamber || null,
      text: input.text,
      actionType: input.actionType || null,
    })
    .returning();
  return toAction(row);
}

export async function deleteAction(id: string): Promise<void> {
  await db.delete(billActions).where(eq(billActions.id, id));
}

// ── Committees ───────────────────────────────────────────────────────────

function toCommittee(row: typeof billCommittees.$inferSelect): BillCommittee {
  return {
    id: row.id,
    billId: row.billId,
    name: row.name,
    chamber: row.chamber ?? "",
    activity: row.activity ?? "",
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listCommittees(billId: string): Promise<BillCommittee[]> {
  const rows = await db.query.billCommittees.findMany({
    where: eq(billCommittees.billId, billId),
    orderBy: [asc(billCommittees.name)],
  });
  return rows.map(toCommittee);
}

export async function createCommittee(
  input: BillCommitteeInput,
): Promise<BillCommittee> {
  const [row] = await db
    .insert(billCommittees)
    .values({
      billId: input.billId,
      name: input.name,
      chamber: input.chamber || null,
      activity: input.activity || null,
    })
    .returning();
  return toCommittee(row);
}

export async function deleteCommittee(id: string): Promise<void> {
  await db.delete(billCommittees).where(eq(billCommittees.id, id));
}

// ── Related bills ────────────────────────────────────────────────────────

function toRelation(row: typeof billRelations.$inferSelect): BillRelation {
  return {
    id: row.id,
    billId: row.billId,
    relatedExternalId: row.relatedExternalId ?? "",
    relatedBillId: row.relatedBillId,
    relatedBillNumber: row.relatedBillNumber ?? "",
    relatedTitle: row.relatedTitle ?? "",
    relationshipType: row.relationshipType ?? "",
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listRelations(billId: string): Promise<BillRelation[]> {
  const rows = await db.query.billRelations.findMany({
    where: eq(billRelations.billId, billId),
    orderBy: [asc(billRelations.relatedBillNumber)],
  });
  return rows.map(toRelation);
}

export async function createRelation(
  input: BillRelationInput,
): Promise<BillRelation> {
  const [row] = await db
    .insert(billRelations)
    .values({
      billId: input.billId,
      relatedExternalId: input.relatedExternalId || null,
      relatedBillId: input.relatedBillId ?? null,
      relatedBillNumber: input.relatedBillNumber || null,
      relatedTitle: input.relatedTitle || null,
      relationshipType: input.relationshipType || null,
    })
    .returning();
  return toRelation(row);
}

export async function deleteRelation(id: string): Promise<void> {
  await db.delete(billRelations).where(eq(billRelations.id, id));
}

// ── Text versions ────────────────────────────────────────────────────────

function toTextVersion(row: typeof billTextVersions.$inferSelect): BillTextVersion {
  return {
    id: row.id,
    billId: row.billId,
    versionType: row.versionType ?? "",
    date: row.date?.toISOString() ?? "",
    format: row.format ?? "",
    url: row.url,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listTextVersions(billId: string): Promise<BillTextVersion[]> {
  const rows = await db.query.billTextVersions.findMany({
    where: eq(billTextVersions.billId, billId),
    orderBy: [desc(billTextVersions.date)],
  });
  return rows.map(toTextVersion);
}

export async function createTextVersion(
  input: BillTextVersionInput,
): Promise<BillTextVersion> {
  const [row] = await db
    .insert(billTextVersions)
    .values({
      billId: input.billId,
      versionType: input.versionType || null,
      date: input.date ? new Date(input.date) : null,
      format: input.format || null,
      url: input.url,
    })
    .returning();
  return toTextVersion(row);
}

export async function deleteTextVersion(id: string): Promise<void> {
  await db.delete(billTextVersions).where(eq(billTextVersions.id, id));
}

// ── Bulk replace (importer) ──────────────────────────────────────────────
// Each Congress.gov run replaces a bill's child rows wholesale, mirroring
// replaceRollCallVotes. All five run in one transaction per bill.

export interface BillDetailBundle {
  cosponsors: Array<{ entityId: string; date: string | null; isOriginal: boolean }>;
  actions: Array<{ date: string; chamber: string | null; text: string; actionType: string | null }>;
  committees: Array<{ name: string; chamber: string | null; activity: string | null }>;
  relations: Array<{
    relatedExternalId: string | null;
    relatedBillId: string | null;
    relatedBillNumber: string | null;
    relatedTitle: string | null;
    relationshipType: string | null;
  }>;
  textVersions: Array<{
    versionType: string | null;
    date: string | null;
    format: string | null;
    url: string;
  }>;
}

export async function replaceBillDetails(
  billId: string,
  bundle: BillDetailBundle,
): Promise<void> {
  await db.transaction(async (tx) => {
    await Promise.all([
      tx.delete(billCosponsors).where(eq(billCosponsors.billId, billId)),
      tx.delete(billActions).where(eq(billActions.billId, billId)),
      tx.delete(billCommittees).where(eq(billCommittees.billId, billId)),
      tx.delete(billRelations).where(eq(billRelations.billId, billId)),
      tx.delete(billTextVersions).where(eq(billTextVersions.billId, billId)),
    ]);

    if (bundle.cosponsors.length) {
      await tx.insert(billCosponsors).values(
        bundle.cosponsors.map((c) => ({
          billId,
          entityId: c.entityId,
          date: c.date ? new Date(c.date) : null,
          isOriginal: c.isOriginal,
        })),
      );
    }
    if (bundle.actions.length) {
      await tx.insert(billActions).values(
        bundle.actions.map((a) => ({
          billId,
          date: new Date(a.date),
          chamber: a.chamber,
          text: a.text,
          actionType: a.actionType,
        })),
      );
    }
    if (bundle.committees.length) {
      await tx.insert(billCommittees).values(
        bundle.committees.map((c) => ({ billId, ...c })),
      );
    }
    if (bundle.relations.length) {
      await tx.insert(billRelations).values(
        bundle.relations.map((r) => ({ billId, ...r })),
      );
    }
    if (bundle.textVersions.length) {
      await tx.insert(billTextVersions).values(
        bundle.textVersions.map((t) => ({
          billId,
          versionType: t.versionType,
          date: t.date ? new Date(t.date) : null,
          format: t.format,
          url: t.url,
        })),
      );
    }
  });
}
