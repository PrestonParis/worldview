import { describe, it, expect } from "vitest";
import {
  computeState,
  coveredStatementsByQuestion,
  issueStates,
  isValidAnswer,
  nextItem,
  predictedAgreement,
  REFINE_STEP,
  type QuizAnswer,
} from "./engine";
import { computeResult, matchPercent, verdict, MATCH_CEILING, MATCH_FLOOR, type IdeologyMatch } from "./results";
import { randomRespondent, simulate } from "./sim";
import { axisIds } from "./types";

describe("response models", () => {
  it("directional agreement rises toward the statement's pole and holds at the extreme", () => {
    const at = (t: number) => predictedAgreement("directional", 0.75, t);
    expect(at(-1)).toBeLessThan(at(0));
    expect(at(0)).toBeLessThan(at(0.75));
    expect(at(1)).toBeGreaterThanOrEqual(at(0.75));
    expect(at(1)).toBeGreaterThan(2);
  });

  it("ideal-point agreement peaks at the location and falls on both sides", () => {
    const at = (t: number) => predictedAgreement("ideal", 0, t);
    expect(at(0)).toBe(3);
    expect(at(-0.8)).toBeLessThan(0);
    expect(at(0.8)).toBeLessThan(0);
  });
});

describe("answers", () => {
  it("validates item ids and values", () => {
    expect(isValidAnswer({ kind: "statement", id: "federalism.01", value: 3 })).toBe(true);
    expect(isValidAnswer({ kind: "statement", id: "federalism.01", value: 4 })).toBe(false);
    expect(isValidAnswer({ kind: "statement", id: "nope.01", value: 1 })).toBe(false);
    expect(isValidAnswer({ kind: "choice", id: "abortion.legal", value: "most" })).toBe(true);
    expect(isValidAnswer({ kind: "choice", id: "abortion.legal", value: "nope" })).toBe(false);
    expect(isValidAnswer({ kind: "choice", id: "abortion.legal", value: null })).toBe(true);
    expect(isValidAnswer({ kind: "choice", id: "abortion.legal", value: "__none_fit__" })).toBe(true);
    expect(isValidAnswer({ kind: "choice", id: "abortion.exceptions", value: ["life", "rape"] })).toBe(true);
    expect(isValidAnswer({ kind: "choice", id: "abortion.exceptions", value: ["none", "rape"] })).toBe(false);
  });

  it("agreeing with a pole statement moves the axis toward that pole", () => {
    const s = computeState([{ kind: "statement", id: "federalism.18", value: 3 }]);
    expect(s.axes.federalism.mean).toBeGreaterThan(0.2);
    const d = computeState([{ kind: "statement", id: "federalism.18", value: -3 }]);
    expect(d.axes.federalism.mean).toBeLessThan(0);
  });

  it("uses issue importance to change evidence strength, not direction", () => {
    const low = computeState([{ kind: "choice", id: "guns.overall", value: "strict", importance: 1 }]);
    const high = computeState([{ kind: "choice", id: "guns.overall", value: "strict", importance: 3 }]);
    expect(Math.sign(low.axes.regulation.mean)).toBe(Math.sign(high.axes.regulation.mean));
    expect(Math.abs(high.axes.regulation.mean)).toBeGreaterThan(Math.abs(low.axes.regulation.mean));
  });
});

describe("issue branching", () => {
  const abortion = (answers: QuizAnswer[]) => issueStates(answers).find((i) => i.module.id === "abortion")!;

  it("asks follow-ups that the screener answer leaves open", () => {
    const i = abortion([{ kind: "choice", id: "abortion.legal", value: "some" }]);
    expect(i.pending.map((q) => q.id)).toContain("abortion.limit");
    expect(i.pending.map((q) => q.id)).toContain("abortion.exceptions");
  });

  it("does not invent narrower answers from a broad answer", () => {
    const i = abortion([{ kind: "choice", id: "abortion.legal", value: "all-illegal" }]);
    expect(i.pending.map((q) => q.id)).not.toContain("abortion.exceptions");
    expect(i.values.get("abortion.exceptions")).toBeUndefined();
  });

  it("a skipped screener closes the module", () => {
    const i = abortion([{ kind: "choice", id: "abortion.legal", value: null }]);
    expect(i.skipped).toBe(true);
    expect(i.pending).toEqual([]);
  });

  it("interleaves an open issue with statements", () => {
    const answers: QuizAnswer[] = [{ kind: "choice", id: "abortion.legal", value: "some" }];
    const item = nextItem(answers, computeState(answers), "seed");
    expect(item?.kind).toBe("statement");
  });

  it("lets policy answers satisfy basic axis coverage", () => {
    const state = computeState([{ kind: "choice", id: "guns.overall", value: "strict" }]);
    expect(state.axes.regulation.answered).toBe(1);
    expect(state.axes.social.answered).toBe(1);
  });
});

describe("selection", () => {
  it("is deterministic for a given seed and log", () => {
    const answers: QuizAnswer[] = [{ kind: "statement", id: "social.01", value: 2 }];
    const s = computeState(answers);
    expect(nextItem(answers, s, "abc")).toEqual(nextItem(answers, s, "abc"));
  });

  it("never repeats an item", () => {
    const { answers } = simulate(randomRespondent("norepeat"), "norepeat");
    const keys = answers.map((a) => `${a.kind}:${a.id}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("does not ask an abstract duplicate after a concrete policy answer", () => {
    const answers: QuizAnswer[] = [{ kind: "choice", id: "healthcare.system", value: "public-option" }];
    const blocked = new Set(coveredStatementsByQuestion["healthcare.system"]);
    let state = computeState(answers);
    const log = [...answers];
    for (let step = 0; step < 40; step++) {
      const item = nextItem(log, state, "dedupe");
      if (!item) break;
      if (item.kind === "statement") expect(blocked.has(item.statement.id)).toBe(false);
      log.push(item.kind === "statement"
        ? { kind: "statement", id: item.statement.id, value: 0 }
        : { kind: "choice", id: item.question.id, value: null });
      state = computeState(log);
    }
  });
});

describe("simulated respondents", () => {
  const runs = ["a", "b", "c"].map((seed) => {
    const r = randomRespondent(seed);
    const { answers, steps } = simulate(r, seed);
    return { r, answers, steps, state: computeState(answers) };
  });

  it("finish with every axis settled and every issue covered", () => {
    for (const { state, steps } of runs) {
      expect(state.complete).toBe(true);
      expect(steps).toBeGreaterThanOrEqual(100);
      expect(steps).toBeLessThan(260);
    }
  });

  it("recover the respondent's true positions", () => {
    for (const { r, state } of runs) {
      const errs = axisIds.map((a) => Math.abs(state.axes[a].mean - r.truth[a]));
      expect(errs.reduce((x, y) => x + y, 0) / errs.length).toBeLessThan(0.12);
    }
  });

  it("refining an axis reopens it for more statements", () => {
    const { answers } = runs[0];
    const axis = axisIds[0];
    const refine = { [axis]: computeState(answers).axes[axis].asked + REFINE_STEP };
    const state = computeState(answers, refine);
    expect(state.complete).toBe(false);
    const item = nextItem(answers, state, "refine", refine);
    expect(item?.kind).toBe("statement");
    expect(item && item.kind === "statement" && item.statement.id.startsWith(`${axis}.`)).toBe(true);
  });

  it("produce a full result", () => {
    const res = computeResult(runs[0].answers);
    expect(res.axes).toHaveLength(axisIds.length);
    expect(res.profiles).toHaveLength(25);
    expect(res.ideologies).toHaveLength(55);
    expect(res.ideologies[0].distance).toBeLessThanOrEqual(res.ideologies[1].distance);
    expect(res.ideologies[0].match).toBeGreaterThanOrEqual(res.ideologies[1].match);
    for (const a of res.axes) expect(a.influences.length).toBeGreaterThan(0);
  });
});

describe("match percentage", () => {
  it("runs from 100 at the floor to 0 at the ceiling, decreasing with distance", () => {
    expect(matchPercent(0)).toBe(100);
    expect(matchPercent(MATCH_FLOOR)).toBe(100);
    expect(matchPercent(MATCH_CEILING)).toBe(0);
    expect(matchPercent(2)).toBe(0);
    expect(matchPercent(0.4)).toBeGreaterThan(matchPercent(0.6));
  });
});

describe("verdict", () => {
  const at = (...ms: number[]) => ms.map((match) => ({ match }) as IdeologyMatch);
  it("reads the top match's lead over the runner-up", () => {
    expect(verdict(at(90, 75))).toBe("clear");
    expect(verdict(at(90, 85))).toBe("lean");
    expect(verdict(at(90, 88))).toBe("torn");
  });
});
