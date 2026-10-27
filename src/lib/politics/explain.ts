// Why a quiz result came out the way it did, from the result alone: the axes
// where the respondent and the top match agree most, and the axis that most
// separates the top match from the runner-up for this respondent.

import { BALANCED } from "./axis-language";
import type { AxisComparison, QuizResult } from "../quiz/results";
import type { AxisId } from "../quiz/types";

const SHARED_GAP = 0.35;

export interface ResultExplanation {
  shared: AxisComparison[]; // up to 3, defining axes first, strongest first
  rival: {
    name: string;
    lead: number; // similarity points
    axis: AxisId | null; // where the top match fits better than the rival
    gapTop: number;
    gapRival: number;
  } | null;
}

export function explainResult(result: QuizResult): ResultExplanation {
  const [top, second] = result.ideologies;
  const core = new Set(top.ideology.core ?? top.comparisons.map((c) => c.axis));
  const shared = top.comparisons
    .filter(
      (c) =>
        c.gap < SHARED_GAP &&
        Math.abs(c.them) >= BALANCED &&
        Math.abs(c.you) >= BALANCED &&
        Math.sign(c.you) === Math.sign(c.them),
    )
    .sort((a, b) => Number(core.has(b.axis)) - Number(core.has(a.axis)) || Math.abs(b.you) - Math.abs(a.you))
    .slice(0, 3);

  let rival: ResultExplanation["rival"] = null;
  if (second) {
    const rivalGap = new Map(second.comparisons.map((c) => [c.axis, c.gap]));
    let best: { axis: AxisId; gapTop: number; gapRival: number; margin: number } | null = null;
    for (const c of top.comparisons) {
      const g = rivalGap.get(c.axis);
      if (g === undefined) continue;
      const margin = g - c.gap;
      if (margin > 0.2 && (!best || margin > best.margin)) best = { axis: c.axis, gapTop: c.gap, gapRival: g, margin };
    }
    rival = {
      name: second.ideology.name,
      lead: top.match - second.match,
      axis: best?.axis ?? null,
      gapTop: best?.gapTop ?? 0,
      gapRival: best?.gapRival ?? 0,
    };
  }
  return { shared, rival };
}
