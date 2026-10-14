"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as quizDb from "../db/quizSessions";
import { BANK_VERSION } from "../quiz/bank";
import { computeState, ENGINE_VERSION, isValidAnswer, REFINE_STEP, type QuizAnswer } from "../quiz/engine";
import { answerSnapshot, applyAnswer, runnerState, type RunnerState } from "../quiz/runner";
import {
  EDIT_COOKIE_MAX_AGE,
  SLUG_PATTERN,
  claimIfAllowed,
  currentUserId,
  editCookieName,
  hashToken,
  newEditToken,
  newSlug,
  quizAccess,
} from "../quiz/access";
import { axisIds, type AxisId } from "../quiz/types";
import type { ActionResult } from "./entities";

// Every action re-checks access server side — these are reachable by direct
// POST, not just through the quiz UI.

async function loadEditable(slug: string) {
  if (!SLUG_PATTERN.test(slug)) return null;
  const session = await quizDb.getQuizSession(slug);
  if (!session) return null;
  const access = await quizAccess(session);
  return access.canEdit ? session : null;
}

export async function startQuizAction(): Promise<void> {
  const slug = newSlug();
  const token = newEditToken();
  await quizDb.createQuizSession({
    slug,
    editTokenHash: hashToken(token),
    bankVersion: BANK_VERSION,
    engineVersion: ENGINE_VERSION,
  });
  (await cookies()).set(editCookieName(slug), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: EDIT_COOKIE_MAX_AGE,
  });
  redirect(`/quiz/${slug}`);
}

export async function submitAnswerAction(slug: string, answer: QuizAnswer): Promise<ActionResult<RunnerState>> {
  const session = await loadEditable(slug);
  if (!session) return { ok: false, error: "This quiz can't be edited from here." };
  const clean: QuizAnswer =
    answer.kind === "statement"
      ? { kind: "statement", id: String(answer.id), value: answer.value }
      : { kind: "choice", id: String(answer.id), value: answer.value, importance: answer.importance };
  if (!isValidAnswer(clean)) return { ok: false, error: "Invalid answer." };
  // Saved server side from the bank, never taken from the client.
  clean.shown = answerSnapshot(clean) ?? undefined;

  const answers = applyAnswer(session.answers, clean);
  const { complete } = computeState(answers, session.refine);
  await quizDb.saveQuizProgress(session.id, {
    answers,
    refine: session.refine,
    status: complete ? "complete" : "in_progress",
    completedAt: complete ? (session.completedAt ?? new Date()) : session.completedAt,
  });
  return { ok: true, data: runnerState(answers, session.refine, slug) };
}

// The live runner state, for a quiz page restored from the client cache.
export async function runnerStateAction(slug: string): Promise<ActionResult<RunnerState>> {
  const session = await loadEditable(slug);
  if (!session) return { ok: false, error: "This quiz can't be edited from here." };
  return { ok: true, data: runnerState(session.answers, session.refine, slug) };
}

export async function refineAxisAction(slug: string, axis: AxisId): Promise<void> {
  const session = await loadEditable(slug);
  if (!session || !axisIds.includes(axis)) redirect(`/quiz/${slug}`);
  const state = computeState(session.answers, session.refine);
  const refine = { ...session.refine, [axis]: state.axes[axis].asked + REFINE_STEP };
  const { complete } = computeState(session.answers, refine);
  await quizDb.saveQuizProgress(session.id, {
    answers: session.answers,
    refine,
    status: complete ? "complete" : "in_progress",
    completedAt: session.completedAt,
  });
  redirect(`/quiz/${slug}?take=1`);
}

function parseVisibility(v: FormDataEntryValue | null): quizDb.QuizVisibility {
  return v === "private" ? "private" : "public";
}

export async function claimQuizAction(slug: string, formData: FormData): Promise<void> {
  if (!SLUG_PATTERN.test(slug)) redirect("/quiz");
  await claimIfAllowed(slug, parseVisibility(formData.get("visibility")));
  // Back to the results page the form was on, even for an unfinished quiz.
  revalidatePath(`/quiz/${slug}`);
  redirect(`/quiz/${slug}?view=results`);
}

export async function setVisibilityAction(slug: string, formData: FormData): Promise<void> {
  if (!SLUG_PATTERN.test(slug)) redirect("/quiz");
  const session = await quizDb.getQuizSession(slug);
  const userId = await currentUserId();
  if (session && userId && session.ownerId === userId) {
    await quizDb.setQuizVisibility(session.id, userId, parseVisibility(formData.get("visibility")));
  }
  revalidatePath(`/quiz/${slug}`);
  redirect(`/quiz/${slug}?view=results`);
}

export async function deleteQuizAction(slug: string): Promise<void> {
  if (!SLUG_PATTERN.test(slug)) redirect("/quiz");
  const session = await quizDb.getQuizSession(slug);
  const userId = await currentUserId();
  if (session && userId && session.ownerId === userId) {
    await quizDb.deleteQuizSession(session.id, userId);
  }
  revalidatePath("/quiz");
  redirect("/quiz");
}
