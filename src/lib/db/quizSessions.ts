import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "./client";
import { quizSessions } from "./schema";
import type { QuizAnswer, RefineTargets } from "../quiz/engine";
import { validQuizMode, type DeferredQuestion, type QuizCheckpointRecord, type QuizModeId } from "../quiz/modes";
import type { IssueId } from "../quiz/types";

export type QuizVisibility = "public" | "private";
export type QuizStatus = "in_progress" | "complete";

// Unclaimed quizzes are deleted after this long (docs/quiz-plan.md).
export const UNCLAIMED_TTL_DAYS = 7;

export interface QuizSession {
  id: string;
  slug: string;
  editTokenHash: string;
  ownerId: string | null;
  visibility: QuizVisibility;
  status: QuizStatus;
  bankVersion: string;
  engineVersion: string;
  targetMode: QuizModeId;
  highestCompletedMode: QuizModeId | null;
  entryVariant: "general" | "topic";
  entryTopic: IssueId | null;
  answers: QuizAnswer[];
  refine: RefineTargets;
  deferred: DeferredQuestion[];
  checkpointHistory: QuizCheckpointRecord[];
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  claimedAt: Date | null;
}

function toSession(row: typeof quizSessions.$inferSelect): QuizSession {
  return {
    ...row,
    visibility: row.visibility as QuizVisibility,
    status: row.status as QuizStatus,
    answers: row.answers as QuizAnswer[],
    refine: row.refine as RefineTargets,
    targetMode: validQuizMode(row.targetMode, "deep"),
    highestCompletedMode: row.highestCompletedMode ? validQuizMode(row.highestCompletedMode, "quick") : null,
    entryVariant: row.entryVariant === "topic" ? "topic" : "general",
    entryTopic: row.entryTopic as IssueId | null,
    deferred: row.deferred as DeferredQuestion[],
    checkpointHistory: row.checkpointHistory as QuizCheckpointRecord[],
  };
}

export function expiresAt(session: Pick<QuizSession, "createdAt">): Date {
  return new Date(session.createdAt.getTime() + UNCLAIMED_TTL_DAYS * 86_400_000);
}

export async function createQuizSession(input: {
  slug: string;
  editTokenHash: string;
  bankVersion: string;
  engineVersion: string;
  targetMode?: QuizModeId;
  entryVariant?: "general" | "topic";
  entryTopic?: IssueId | null;
}): Promise<QuizSession> {
  const [row] = await db.insert(quizSessions).values(input).returning();
  return toSession(row);
}

// Expired unclaimed quizzes read as missing even before the purge job runs.
export async function getQuizSession(slug: string): Promise<QuizSession | null> {
  const row = await db.query.quizSessions.findFirst({ where: eq(quizSessions.slug, slug) });
  if (!row) return null;
  const session = toSession(row);
  if (!session.ownerId && expiresAt(session) < new Date()) return null;
  return session;
}

export async function saveQuizProgress(
  id: string,
  patch: {
    answers: QuizAnswer[];
    refine: RefineTargets;
    deferred: DeferredQuestion[];
    targetMode: QuizModeId;
    highestCompletedMode: QuizModeId | null;
    checkpointHistory: QuizCheckpointRecord[];
    status: QuizStatus;
    completedAt: Date | null;
  },
): Promise<void> {
  await db
    .update(quizSessions)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(quizSessions.id, id));
}

export async function claimQuizSession(id: string, ownerId: string, visibility: QuizVisibility): Promise<boolean> {
  const rows = await db
    .update(quizSessions)
    .set({ ownerId, visibility, claimedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(quizSessions.id, id), isNull(quizSessions.ownerId)))
    .returning({ id: quizSessions.id });
  return rows.length > 0;
}

export async function setQuizVisibility(id: string, ownerId: string, visibility: QuizVisibility): Promise<void> {
  await db
    .update(quizSessions)
    .set({ visibility, updatedAt: new Date() })
    .where(and(eq(quizSessions.id, id), eq(quizSessions.ownerId, ownerId)));
}

export async function deleteQuizSession(id: string, ownerId: string): Promise<void> {
  await db.delete(quizSessions).where(and(eq(quizSessions.id, id), eq(quizSessions.ownerId, ownerId)));
}

export async function listQuizSessions(ownerId: string): Promise<QuizSession[]> {
  const rows = await db.query.quizSessions.findMany({
    where: eq(quizSessions.ownerId, ownerId),
    orderBy: desc(quizSessions.updatedAt),
  });
  return rows.map(toSession);
}
