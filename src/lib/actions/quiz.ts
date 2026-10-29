"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as quizDb from "../db/quizSessions";
import { BANK_VERSION } from "../quiz/bank";
import {
  computeState,
  ENGINE_VERSION,
  highestCompletedMode,
  isValidAnswer,
  modeComplete,
  REFINE_STEP,
  roundLeft,
  type QuizAnswer,
  type QuizState,
} from "../quiz/engine";
import {
  answerSnapshot,
  applyAnswer,
  IMPORTANCE_LABELS,
  priorityItems,
  runnerState,
  type RunnerState,
} from "../quiz/runner";
import { computeResult } from "../quiz/results";
import { planRound, ROUND_SIZES, withRound } from "../quiz/refine";
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
import { issues } from "../quiz/bank";
import { modeRank, nextQuizMode, validQuizMode, type QuizModeId } from "../quiz/modes";
import type { IssueId } from "../quiz/types";
import type { ActionResult } from "./result";
import { currentUserIsOwner } from "../auth/guard";
import { enforceRateLimits } from "../security/rate-limit";
import { verifyTurnstileToken } from "../security/turnstile";
import { maybeRunAbuseRetention } from "../security/retention";

// Every action re-checks access server side — these are reachable by direct
// POST, not just through the quiz UI.

async function loadEditable(slug: string) {
  if (!SLUG_PATTERN.test(slug)) return null;
  const session = await quizDb.getQuizSession(slug);
  if (!session) return null;
  const access = await quizAccess(session);
  return access.canEdit ? session : null;
}

async function protectQuizStart(captchaToken?: string, sourceSlug?: string): Promise<void> {
  const limited = await enforceRateLimits([
    { scope: "quiz-start-ten-minute", limit: 5, windowSeconds: 600 },
    { scope: "quiz-start-day", limit: 20, windowSeconds: 86_400 },
  ]);
  if (limited) redirect(`/atlas?abuse=rate&retry=${limited.retryAfter}`);
  if (await currentUserId()) return;
  if (sourceSlug && (await loadEditable(sourceSlug))) return;
  if (!(await verifyTurnstileToken(captchaToken, await headers()))) redirect("/atlas?abuse=challenge");
}

export async function startQuizAction(
  modeOrForm?: QuizModeId | FormData,
  entryTopic: IssueId | null = null,
  captchaToken?: string,
  sourceSlug?: string,
): Promise<void> {
  // Most entry points submit ordinary named fields, while the interactive
  // landing hero binds its selected mode before submitting. Accept both so a
  // UI refactor cannot silently turn Snapshot or Deep Map back into Profile.
  const formData = modeOrForm instanceof FormData ? modeOrForm : undefined;
  const rawMode = formData?.get("mode");
  const rawTopic = entryTopic ?? formData?.get("topic");
  const challengeToken =
    captchaToken ??
    (typeof formData?.get("captchaToken") === "string" ? String(formData.get("captchaToken")) : undefined);
  const source =
    sourceSlug ?? (typeof formData?.get("sourceQuiz") === "string" ? String(formData.get("sourceQuiz")) : undefined);
  await protectQuizStart(challengeToken, source);
  const targetMode =
    typeof modeOrForm === "string"
      ? validQuizMode(modeOrForm)
      : validQuizMode(typeof rawMode === "string" ? rawMode : undefined);
  const topic =
    typeof rawTopic === "string" && issues.some((issue) => issue.id === rawTopic) ? (rawTopic as IssueId) : null;
  const slug = newSlug();
  const token = newEditToken();
  await quizDb.createQuizSession({
    slug,
    editTokenHash: hashToken(token),
    bankVersion: BANK_VERSION,
    engineVersion: ENGINE_VERSION,
    targetMode,
    entryVariant: topic ? "topic" : "general",
    entryTopic: topic,
    isTest: await currentUserIsOwner(),
  });
  await maybeRunAbuseRetention();
  (await cookies()).set(editCookieName(slug), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: EDIT_COOKIE_MAX_AGE,
  });
  redirect(`/quiz/${slug}`);
}

// Starts a quiz with the statements already answered on the landing page, so
// they count instead of being asked again. Each answer is validated and
// snapshotted here; the client only supplies ids and values.
export async function startQuizWithAnswersAction(
  mode: QuizModeId,
  entryTopic: IssueId | null,
  answers: QuizAnswer[],
  captchaToken?: string,
): Promise<void> {
  await protectQuizStart(captchaToken);
  const targetMode = validQuizMode(mode);
  const topic = entryTopic && issues.some((issue) => issue.id === entryTopic) ? entryTopic : null;
  const clean: QuizAnswer[] = [];
  for (const a of Array.isArray(answers) ? answers.slice(0, 10) : []) {
    if (a?.kind !== "statement" || typeof a.value !== "number") continue;
    const answer: QuizAnswer = { kind: "statement", id: String(a.id), value: a.value };
    if (!isValidAnswer(answer) || clean.some((c) => c.id === answer.id)) continue;
    answer.shown = answerSnapshot(answer) ?? undefined;
    clean.push(answer);
  }
  const slug = newSlug();
  const token = newEditToken();
  const session = await quizDb.createQuizSession({
    slug,
    editTokenHash: hashToken(token),
    bankVersion: BANK_VERSION,
    engineVersion: ENGINE_VERSION,
    targetMode,
    entryVariant: topic ? "topic" : "general",
    entryTopic: topic,
    isTest: await currentUserIsOwner(),
  });
  await maybeRunAbuseRetention();
  if (clean.length > 0) {
    await quizDb.saveQuizProgress(session.id, {
      answers: clean,
      refine: {},
      deferred: [],
      targetMode,
      highestCompletedMode: null,
      checkpointHistory: [],
      status: "in_progress",
      completedAt: null,
    });
  }
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
  // Importance is set on the priorities board, not with the answer: keep it
  // when an issue's answer is changed.
  if (clean.kind === "choice" && clean.importance === undefined) {
    const previous = session.answers.find((a) => a.kind === "choice" && a.id === clean.id);
    if (previous?.kind === "choice" && previous.importance) clean.importance = previous.importance;
  }
  // Saved server side from the bank, never taken from the client.
  clean.shown = answerSnapshot(clean) ?? undefined;

  const answers = applyAnswer(session.answers, clean);
  const state = computeState(answers, session.refine);
  const complete = modeComplete(state, answers.length, session.targetMode);
  const highest = highestCompletedMode(state, answers.length);
  const deferred = session.deferred.filter((item) => item.kind !== clean.kind || item.id !== clean.id);
  const checkpointHistory =
    complete && !session.checkpointHistory.some((checkpoint) => checkpoint.mode === session.targetMode)
      ? [
          ...session.checkpointHistory,
          { mode: session.targetMode, completedAt: new Date().toISOString(), answerCount: answers.length },
        ]
      : session.checkpointHistory;
  await quizDb.saveQuizProgress(session.id, {
    answers,
    refine: session.refine,
    deferred,
    targetMode: session.targetMode,
    highestCompletedMode: highest,
    checkpointHistory,
    status: complete ? "complete" : "in_progress",
    completedAt: complete ? (session.completedAt ?? new Date()) : session.completedAt,
  });
  return {
    ok: true,
    data: runnerState(answers, session.refine, slug, session.targetMode, deferred, session.entryTopic),
  };
}

// The priorities board: importance for every answered issue at once. Only
// issues already answered can be ranked; the rest of the input is ignored.
export async function setPrioritiesAction(
  slug: string,
  levels: Record<string, 1 | 2 | 3>,
): Promise<ActionResult<null>> {
  const session = await loadEditable(slug);
  if (!session) return { ok: false, error: "This quiz can't be edited from here." };
  const ranked = new Set(priorityItems(session.answers).map((p) => p.screenerId));
  const answers = session.answers.map((a): QuizAnswer => {
    const level = levels?.[a.id];
    if (a.kind !== "choice" || !ranked.has(a.id) || ![1, 2, 3].includes(level)) return a;
    return {
      ...a,
      importance: level,
      ...(a.shown ? { shown: { ...a.shown, importance: IMPORTANCE_LABELS[level] } } : {}),
    };
  });
  await quizDb.saveQuizProgress(session.id, {
    answers,
    refine: session.refine,
    deferred: session.deferred,
    targetMode: session.targetMode,
    highestCompletedMode: session.highestCompletedMode,
    checkpointHistory: session.checkpointHistory,
    status: session.status,
    completedAt: session.completedAt,
  });
  return { ok: true, data: null };
}

// The live runner state, for a quiz page restored from the client cache.
export async function runnerStateAction(slug: string): Promise<ActionResult<RunnerState>> {
  const session = await loadEditable(slug);
  if (!session) return { ok: false, error: "This quiz can't be edited from here." };
  return {
    ok: true,
    data: runnerState(session.answers, session.refine, slug, session.targetMode, session.deferred, session.entryTopic),
  };
}

export async function deferQuestionAction(
  slug: string,
  kind: QuizAnswer["kind"],
  id: string,
): Promise<ActionResult<RunnerState>> {
  const session = await loadEditable(slug);
  if (!session) return { ok: false, error: "This quiz can't be edited from here." };
  const live = runnerState(
    session.answers,
    session.refine,
    slug,
    session.targetMode,
    session.deferred,
    session.entryTopic,
  );
  if (!live.next || live.next.kind !== kind || live.next.id !== id)
    return { ok: false, error: "That question is no longer current." };
  const previous = session.deferred.find((item) => item.kind === kind && item.id === id);
  const deferred = [
    ...session.deferred.filter((item) => item.kind !== kind || item.id !== id),
    { kind, id, deferredAtMode: session.targetMode, deferCount: (previous?.deferCount ?? 0) + 1 },
  ];
  await quizDb.saveQuizProgress(session.id, {
    answers: session.answers,
    refine: session.refine,
    deferred,
    targetMode: session.targetMode,
    highestCompletedMode: session.highestCompletedMode,
    checkpointHistory: session.checkpointHistory,
    status: "in_progress",
    completedAt: session.completedAt,
  });
  return {
    ok: true,
    data: runnerState(session.answers, session.refine, slug, session.targetMode, deferred, session.entryTopic),
  };
}

export async function reviewDeferredAction(slug: string): Promise<void> {
  const session = await loadEditable(slug);
  if (!session) redirect(`/quiz/${slug}`);
  await quizDb.saveQuizProgress(session.id, {
    answers: session.answers,
    refine: session.refine,
    deferred: [],
    targetMode: session.targetMode,
    highestCompletedMode: session.highestCompletedMode,
    checkpointHistory: session.checkpointHistory,
    status: "in_progress",
    completedAt: session.completedAt,
  });
  redirect(`/quiz/${slug}?take=1`);
}

export async function continueQuizAction(slug: string, requested: QuizModeId): Promise<void> {
  const session = await loadEditable(slug);
  if (!session) redirect(`/quiz/${slug}`);
  const next = nextQuizMode(session.targetMode);
  if (!next || requested !== next || modeRank(requested) <= modeRank(session.targetMode))
    redirect(`/quiz/${slug}?view=results`);
  await quizDb.saveQuizProgress(session.id, {
    answers: session.answers,
    refine: session.refine,
    deferred: session.deferred,
    targetMode: requested,
    highestCompletedMode: session.highestCompletedMode,
    checkpointHistory: session.checkpointHistory,
    status: "in_progress",
    completedAt: session.completedAt,
  });
  redirect(`/quiz/${slug}?take=1`);
}

export async function refineAxisAction(slug: string, axis: AxisId): Promise<void> {
  const session = await loadEditable(slug);
  if (!session || !axisIds.includes(axis)) redirect(`/quiz/${slug}`);
  const state = computeState(session.answers, session.refine);
  const refine = { ...session.refine, [axis]: state.axes[axis].asked + REFINE_STEP };
  const after = computeState(session.answers, refine);
  await quizDb.saveQuizProgress(session.id, {
    answers: session.answers,
    refine,
    deferred: session.deferred,
    targetMode: "deep",
    highestCompletedMode: session.highestCompletedMode,
    checkpointHistory: session.checkpointHistory,
    status: after.complete ? "complete" : "in_progress",
    completedAt: session.completedAt,
  });
  redirect(roundHref(slug, session.answers, state, after));
}

// An opt-in round of extra questions on a finished quiz, aimed at what most
// separates the respondent's top matches. The current top match rides along
// in the URL so the reveal afterwards can show what changed.
export async function sharpenAction(slug: string, size: number): Promise<void> {
  const session = await loadEditable(slug);
  if (!session || !(ROUND_SIZES as readonly number[]).includes(size)) redirect(`/quiz/${slug}`);
  const state = computeState(session.answers, session.refine);
  const result = computeResult(session.answers, session.refine, state);
  const refine = withRound(session.refine, state, planRound(result, state, size));
  const after = computeState(session.answers, refine);
  if (after.refineLeft === 0) redirect(`/quiz/${slug}?view=results`);
  await quizDb.saveQuizProgress(session.id, {
    answers: session.answers,
    refine,
    deferred: session.deferred,
    targetMode: "deep",
    highestCompletedMode: session.highestCompletedMode,
    checkpointHistory: session.checkpointHistory,
    status: after.complete ? "complete" : "in_progress",
    completedAt: session.completedAt,
  });
  redirect(roundHref(slug, session.answers, state, after, result));
}

// Into the runner for a round. On a finished quiz the current top match
// rides along in the URL, so the reveal afterwards can show what changed.
function roundHref(
  slug: string,
  answers: QuizAnswer[],
  before: QuizState,
  after: QuizState,
  result = computeResult(answers, {}, before),
): string {
  const left = roundLeft(after);
  if (left === 0) return `/quiz/${slug}?take=1`;
  const top = result.ideologies[0];
  const params = new URLSearchParams({
    take: "1",
    round: String(left),
    was: top.ideology.id,
    wasPct: String(top.match),
  });
  return `/quiz/${slug}?${params}`;
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

// Drops an unclaimed quiz from this browser's history by forgetting its edit
// key. The quiz itself stays at its link; this browser can no longer edit it.
export async function forgetQuizAction(slug: string): Promise<void> {
  if (!SLUG_PATTERN.test(slug)) return;
  (await cookies()).delete(editCookieName(slug));
  revalidatePath("/atlas");
  revalidatePath("/quiz");
}

// /quiz/stats: mark a session as a test so analytics leave it out.
export async function setQuizTestFlagAction(id: string, isTest: boolean): Promise<void> {
  if (!(await currentUserIsOwner())) return;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await quizDb.setQuizTestFlag(id, isTest);
  revalidatePath("/quiz/stats");
}
