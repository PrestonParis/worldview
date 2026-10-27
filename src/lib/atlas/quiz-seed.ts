import { getQuizSession } from "../db/quizSessions";
import { quizAccess, SLUG_PATTERN } from "../quiz/access";
import { computeState } from "../quiz/engine";
import { computeResult } from "../quiz/results";

export async function quizAxisSeed(slug: string | undefined): Promise<{ slug?: string; axes: Record<string, number> }> {
  if (!slug || !SLUG_PATTERN.test(slug)) return { axes: {} };
  const session = await getQuizSession(slug);
  if (!session || !(await quizAccess(session)).canView) return { axes: {} };
  const result = computeResult(session.answers, session.refine, computeState(session.answers, session.refine));
  return { slug, axes: Object.fromEntries(result.axes.map((x) => [x.axis, x.mean])) };
}
