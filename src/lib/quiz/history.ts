// A visitor's quiz history for the landing page: finished results with their
// closest traditions, and the unfinished quiz worth resuming. Server-only.

import { viewerQuizSessions } from "./access";
import { computeState } from "./engine";
import { computeResult } from "./results";
import type { QuizModeId } from "./modes";
import type { IdeologyFamily } from "./types";

// Finished results shown (each one is re-scored on every visit).
const MAX_RESULTS = 8;

export interface HistoryMatch {
  id: string;
  name: string;
  family: IdeologyFamily;
  match: number;
}

export interface HistoryResult {
  slug: string;
  mode: QuizModeId;
  answered: number;
  finishedAt: Date;
  // Unclaimed quizzes live only in this browser until claimed.
  claimed: boolean;
  top: HistoryMatch[];
}

export interface QuizHistory {
  results: HistoryResult[]; // newest first
  resume: { slug: string; mode: QuizModeId; answered: number; updatedAt: Date } | null;
}

export async function quizHistory(): Promise<QuizHistory> {
  const sessions = await viewerQuizSessions();
  const results = sessions
    .filter(({ session }) => session.status === "complete")
    .slice(0, MAX_RESULTS)
    .map(({ session: s, claimed }): HistoryResult => {
      const result = computeResult(s.answers, s.refine, computeState(s.answers, s.refine));
      return {
        slug: s.slug,
        mode: s.targetMode,
        answered: s.answers.length,
        finishedAt: s.completedAt ?? s.updatedAt,
        claimed,
        top: result.ideologies.slice(0, 3).map((m) => ({ id: m.ideology.id, name: m.ideology.name, family: m.ideology.family, match: m.match })),
      };
    })
    .sort((a, b) => b.finishedAt.getTime() - a.finishedAt.getTime());

  // The newest unfinished quiz with answers, unless a result came after it.
  const latestFinish = results[0]?.finishedAt.getTime() ?? 0;
  const open = sessions.find(({ session: s }) => s.status !== "complete" && s.answers.length > 0 && s.updatedAt.getTime() > latestFinish)?.session;
  return {
    results,
    resume: open ? { slug: open.slug, mode: open.targetMode, answered: open.answers.length, updatedAt: open.updatedAt } : null,
  };
}
