import { describe, it, expect } from "vitest";
import { computeState, nextItem, roundLeft, type QuizAnswer } from "./engine";
import { computeResult } from "./results";
import { randomRespondent, simulate } from "./sim";
import { planRound, ROUND_SIZES, withRound } from "./refine";
import { axisIds } from "./types";

describe("sharpen rounds", () => {
  const { answers } = simulate(randomRespondent("sharpen"), "sharpen");
  const state = computeState(answers);
  const result = computeResult(answers, {}, state);

  it("starts from a finished quiz", () => {
    expect(state.complete).toBe(true);
    expect(roundLeft(state)).toBe(0);
  });

  for (const size of ROUND_SIZES) {
    it(`plans exactly ${size} questions, spread over several axes`, () => {
      const plan = planRound(result, state, size);
      const counts = Object.values(plan);
      expect(counts.reduce((a, b) => a + b, 0)).toBe(size);
      expect(counts.length).toBeGreaterThan(1);
      for (const [axis, n] of Object.entries(plan) as [keyof typeof plan, number][]) {
        expect(n).toBeLessThanOrEqual(state.remaining[axis]);
      }
    });
  }

  it("reopens the quiz for exactly the planned questions, then closes it", () => {
    const size = ROUND_SIZES[0];
    const refine = withRound({}, state, planRound(result, state, size));
    let after = computeState(answers, refine);
    expect(after.complete).toBe(false);
    expect(roundLeft(after)).toBe(size);

    const log: QuizAnswer[] = [...answers];
    for (let i = 0; i < size; i++) {
      const item = nextItem(log, after, "sharpen", refine);
      expect(item?.kind).toBe("statement");
      if (item?.kind !== "statement") break;
      log.push({ kind: "statement", id: item.statement.id, value: 0 });
      after = computeState(log, refine);
      expect(roundLeft(after)).toBe(size - i - 1);
    }
    // An answer can reopen an axis; it settles again within a few questions.
    for (let extra = 0; !after.complete && extra < 6; extra++) {
      const item = nextItem(log, after, "sharpen", refine);
      if (item?.kind !== "statement") break;
      log.push({ kind: "statement", id: item.statement.id, value: 0 });
      after = computeState(log, refine);
    }
    expect(after.complete).toBe(true);
  });

  it("never lowers an existing refine target", () => {
    const axis = axisIds[0];
    const refine = withRound({ [axis]: 99 }, state, { [axis]: 1 });
    expect(refine[axis]).toBe(99);
  });

  it("doesn't count refine targets on an unfinished quiz as a round", () => {
    const partial = answers.slice(0, 5);
    const refine = { [axisIds[0]]: 30 };
    expect(roundLeft(computeState(partial, refine))).toBe(0);
  });
});
