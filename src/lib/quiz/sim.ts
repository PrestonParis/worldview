// Synthetic respondents for tuning and testing the engine. Not used at runtime.

import { axisIds, lensIds, type AxisId, type ChoiceOption, type LensId } from "./types";
import {
  computeState,
  nextItem,
  predictedAgreement,
  primaryAxis,
  seededRandom,
  CHOICE_SHARPNESS,
  type QuizAnswer,
} from "./engine";

export interface Respondent {
  truth: Record<AxisId, number>;
  noise: number; // response noise on the -3…+3 scale
  skipRate: number;
  // Accepted values per lens; a lens question is answered with one of them.
  lens?: Partial<Record<LensId, string[]>>;
}

export function randomRespondent(seed: string, spread = 0.8, noise = 1): Respondent {
  const rand = seededRandom(seed);
  const truth = Object.fromEntries(
    axisIds.map((a) => [a, Math.max(-1, Math.min(1, (rand() * 2 - 1) * spread))]),
  ) as Record<AxisId, number>;
  return { truth, noise, skipRate: 0.03 };
}

function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

export function simulate(r: Respondent, seed: string, maxItems = 400): { answers: QuizAnswer[]; steps: number } {
  const rand = seededRandom(`answers:${seed}`);
  const answers: QuizAnswer[] = [];
  for (let step = 0; step < maxItems; step++) {
    const state = computeState(answers);
    if (state.complete) return { answers, steps: step };
    const item = nextItem(answers, state, seed);
    if (!item) return { answers, steps: step };
    if (item.kind === "statement") {
      if (rand() < r.skipRate) {
        answers.push({ kind: "statement", id: item.statement.id, value: null });
        continue;
      }
      const axis = primaryAxis(item.statement);
      const mu = predictedAgreement(item.statement.model, item.statement.axes[axis]!.location, r.truth[axis]);
      const v = Math.round(Math.max(-3, Math.min(3, mu + gaussian(rand) * r.noise)));
      answers.push({ kind: "statement", id: item.statement.id, value: v });
    } else {
      const lensPick = pickLens(r, item.question.options, rand);
      if (lensPick) {
        answers.push({ kind: "choice", id: item.question.id, value: lensPick });
        continue;
      }
      // Score each option by its distance to the respondent across the axes it loads on.
      const scores = item.question.options.map((o) => {
        const entries = Object.entries(o.axes) as [AxisId, { location: number; weight: number }][];
        if (entries.length === 0) return 0;
        return -CHOICE_SHARPNESS * entries.reduce((s, [a, l]) => s + l.weight * (r.truth[a] - l.location) ** 2, 0) /
          entries.reduce((s, [, l]) => s + l.weight, 0);
      });
      const max = Math.max(...scores);
      const ws = scores.map((s) => Math.exp(s - max));
      let x = rand() * ws.reduce((a, b) => a + b, 0);
      let idx = 0;
      while (x > ws[idx]) x -= ws[idx++];
      const optionId = item.question.options[Math.min(idx, ws.length - 1)].id;
      answers.push({
        kind: "choice",
        id: item.question.id,
        value: item.question.selection === "multiple" ? [optionId] : optionId,
      });
    }
  }
  return { answers, steps: maxItems };
}

function pickLens(r: Respondent, options: ChoiceOption[], rand: () => number): string | null {
  for (const lens of lensIds) {
    const accepted = r.lens?.[lens];
    if (!accepted) continue;
    const fits = options.filter((o) => o.lens?.[lens] && accepted.includes(o.lens[lens]!));
    if (fits.length) return fits[Math.floor(rand() * fits.length)].id;
  }
  return null;
}
