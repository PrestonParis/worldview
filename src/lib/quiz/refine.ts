// Planning an opt-in "sharpen your result" round: extra statements spent
// where they can most change the outcome, as refine targets the engine
// already knows how to serve.

import type { QuizState, RefineTargets } from "./engine";
import type { QuizResult } from "./results";
import { axisIds, type AxisId } from "./types";

export const ROUND_SIZES = [10, 25] as const;
export type RoundSize = (typeof ROUND_SIZES)[number];

// A round in progress or just finished, and the top match before it.
export interface SharpenOutcome {
  round: number; // questions in the round
  was: { id: string; name: string; match: number };
}

// Ideologies within this many points of the top match are still in the
// running, and the axes that separate them are worth asking about.
const CONTENDER_SPREAD = 10;
const MAX_CONTENDERS = 4;
// No single axis takes more than this many questions in one round, so a
// round still reads as varied.
const MAX_PER_AXIS_PER_ROUND = 6;

// Questions to add per axis. An axis earns questions by how uncertain it is
// times how much the contenders disagree on it; each extra question on the
// same axis is worth less than the last.
export function planRound(result: QuizResult, state: QuizState, size: number): Partial<Record<AxisId, number>> {
  const top = result.ideologies[0];
  const contenders = result.ideologies
    .slice(0, MAX_CONTENDERS)
    .filter((m, i) => i < 2 || top.match - m.match <= CONTENDER_SPREAD);
  const byAxis = new Map(result.axes.map((a) => [a.axis, a]));

  const value = Object.fromEntries(
    axisIds.map((a) => {
      const positions = contenders.map((m) => m.ideology.position[a]);
      const separation = Math.max(...positions) - Math.min(...positions);
      return [a, byAxis.get(a)!.sd * (0.25 + separation)];
    }),
  ) as Record<AxisId, number>;

  const cap = (a: AxisId) => Math.min(MAX_PER_AXIS_PER_ROUND, state.remaining[a]);
  const plan: Partial<Record<AxisId, number>> = {};
  for (let n = 0; n < size; n++) {
    let best: AxisId | null = null;
    let bestScore = 0;
    for (const a of axisIds) {
      const k = plan[a] ?? 0;
      if (k >= cap(a)) continue;
      const score = value[a] / (1 + k);
      if (score > bestScore) {
        best = a;
        bestScore = score;
      }
    }
    if (!best) break;
    plan[best] = (plan[best] ?? 0) + 1;
  }
  return plan;
}

// Refine targets with a round added on top of what's already been asked.
export function withRound(refine: RefineTargets, state: QuizState, plan: Partial<Record<AxisId, number>>): RefineTargets {
  const next = { ...refine };
  for (const [axis, extra] of Object.entries(plan) as [AxisId, number][]) {
    next[axis] = Math.max(next[axis] ?? 0, state.axes[axis].asked + extra);
  }
  return next;
}
