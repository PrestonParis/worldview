// The landing page's opening questions and the anonymous visit log they feed
// (quiz_opener_events, src/app/api/quiz/opener/route.ts).

import { quizModeIds, type QuizModeId } from "./modes";

// One economic, one social, one on how a country should be governed, so each
// answer moves the map in a different direction. They're real bank statements
// and carry over into the quiz. Chosen to hook: concrete, genuinely contested,
// and something people have a gut reaction to, with the most arresting one
// first.
export const OPENERS = ["redistribution.02", "social.13", "democracy.12"];

// ms: time since the landing page loaded.
export interface OpenerAnswer {
  id: string;
  value: number;
  ms: number;
}

export interface OpenerEvent {
  answers: OpenerAnswer[];
  started: boolean;
  mode: QuizModeId | null;
}

const MAX_MS = 6 * 60 * 60 * 1000;

// The posted body, or null when anything about it is off.
export function parseOpenerEvent(body: unknown): OpenerEvent | null {
  if (!body || typeof body !== "object") return null;
  const { answers, started, mode } = body as Record<string, unknown>;
  if (!Array.isArray(answers) || answers.length > OPENERS.length || typeof started !== "boolean") return null;
  if (mode !== null && mode !== undefined && !quizModeIds.includes(mode as QuizModeId)) return null;
  const clean: OpenerAnswer[] = [];
  for (const a of answers) {
    if (!a || typeof a !== "object") return null;
    const { id, value, ms } = a as Record<string, unknown>;
    if (typeof id !== "string" || !OPENERS.includes(id) || clean.some((c) => c.id === id)) return null;
    if (!Number.isInteger(value) || (value as number) < -3 || (value as number) > 3) return null;
    if (!Number.isInteger(ms) || (ms as number) < 0 || (ms as number) > MAX_MS) return null;
    clean.push({ id, value: value as number, ms: ms as number });
  }
  return { answers: clean, started, mode: started ? ((mode as QuizModeId | undefined) ?? null) : null };
}
