import { eq, or, count, gte, desc } from "drizzle-orm";
import { db } from "./client";
import { lobbyingRegistrations, lobbyingIssues } from "./schema";
import type {
  LobbyingIssue,
  LobbyingRegistration,
  LobbyingRegistrationInput,
} from "../validation/lobbying";

type RegRow = typeof lobbyingRegistrations.$inferSelect & {
  issues?: (typeof lobbyingIssues.$inferSelect)[];
};

function toIssue(row: typeof lobbyingIssues.$inferSelect): LobbyingIssue {
  return {
    id: row.id,
    issueCode: row.issueCode ?? "",
    issueLabel: row.issueLabel ?? "",
    billId: row.billId ?? "",
    description: row.description ?? "",
  };
}

function toRegistration(row: RegRow): LobbyingRegistration {
  return {
    id: row.id,
    clientEntityId: row.clientEntityId,
    registrantEntityId: row.registrantEntityId,
    year: row.year,
    period: row.period ?? "",
    amount: row.amount ?? null,
    amountKind: (row.amountKind as LobbyingRegistration["amountKind"]) ?? "",
    notes: row.notes ?? "",
    externalId: row.externalId ?? "",
    issues: (row.issues ?? []).map(toIssue),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listLobbyingRegistrations(): Promise<LobbyingRegistration[]> {
  const rows = await db.query.lobbyingRegistrations.findMany({
    with: { issues: true },
    orderBy: (r, { desc: d }) => [d(r.year), d(r.createdAt)],
  });
  return rows.map(toRegistration);
}

export async function getLobbyingRegistration(
  id: string,
): Promise<LobbyingRegistration | null> {
  const row = await db.query.lobbyingRegistrations.findFirst({
    where: eq(lobbyingRegistrations.id, id),
    with: { issues: true },
  });
  return row ? toRegistration(row) : null;
}

export async function listLobbyingForEntity(
  entityId: string,
): Promise<LobbyingRegistration[]> {
  const rows = await db.query.lobbyingRegistrations.findMany({
    where: or(
      eq(lobbyingRegistrations.clientEntityId, entityId),
      eq(lobbyingRegistrations.registrantEntityId, entityId),
    ),
    with: { issues: true },
    orderBy: (r, { desc: d }) => [d(r.year)],
  });
  return rows.map(toRegistration);
}

export async function countLobbyingRegistrations(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(lobbyingRegistrations);
  return row.value;
}

export async function countLobbyingRegistrationsCreatedSince(since: Date): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(lobbyingRegistrations)
    .where(gte(lobbyingRegistrations.createdAt, since));
  return row.value;
}

async function replaceIssues(registrationId: string, input: LobbyingRegistrationInput) {
  await db.delete(lobbyingIssues).where(eq(lobbyingIssues.registrationId, registrationId));
  const rows = (input.issues ?? [])
    .filter((i) => i.issueCode || i.issueLabel || i.description || i.billId)
    .map((i) => ({
      registrationId,
      issueCode: i.issueCode || null,
      issueLabel: i.issueLabel || null,
      billId: i.billId || null,
      description: i.description || null,
    }));
  if (rows.length > 0) await db.insert(lobbyingIssues).values(rows);
}

export async function createLobbyingRegistration(
  input: LobbyingRegistrationInput,
): Promise<LobbyingRegistration> {
  const [row] = await db
    .insert(lobbyingRegistrations)
    .values({
      clientEntityId: input.clientEntityId,
      registrantEntityId: input.registrantEntityId,
      year: Number(input.year),
      period: input.period || null,
      amount: input.amount ? Number(input.amount) : null,
      amountKind: input.amountKind || null,
      notes: input.notes || null,
    })
    .returning();
  await replaceIssues(row.id, input);
  return (await getLobbyingRegistration(row.id))!;
}

export async function updateLobbyingRegistration(
  id: string,
  input: LobbyingRegistrationInput,
): Promise<LobbyingRegistration | null> {
  const [row] = await db
    .update(lobbyingRegistrations)
    .set({
      clientEntityId: input.clientEntityId,
      registrantEntityId: input.registrantEntityId,
      year: Number(input.year),
      period: input.period || null,
      amount: input.amount ? Number(input.amount) : null,
      amountKind: input.amountKind || null,
      notes: input.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(lobbyingRegistrations.id, id))
    .returning();
  if (!row) return null;
  await replaceIssues(id, input);
  return getLobbyingRegistration(id);
}

export async function deleteLobbyingRegistration(id: string): Promise<void> {
  await db.delete(lobbyingRegistrations).where(eq(lobbyingRegistrations.id, id));
}

export { desc };
