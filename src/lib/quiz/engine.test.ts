import { describe, it, expect } from "vitest";
import {
  answerEvidence,
  computeState,
  COVERAGE_ORDER,
  COVERAGE_PER_AXIS,
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
import { axisIds, lensIds } from "./types";
import { acceptedLens } from "./lenses";
import { issues } from "./bank";
import { ideologies } from "./ideologies";
import { answerSnapshot } from "./runner";

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

  it("keeps issue importance separate from measurement confidence", () => {
    const low = computeState([{ kind: "choice", id: "guns.overall", value: "strict", importance: 1 }]);
    const high = computeState([{ kind: "choice", id: "guns.overall", value: "strict", importance: 3 }]);
    expect(low.axes.regulation.mean).toBeCloseTo(high.axes.regulation.mean);
    expect(low.axes.regulation.sd).toBeCloseTo(high.axes.regulation.sd);
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

  it("asks an open issue's follow-ups right after its screener", () => {
    const answers: QuizAnswer[] = [{ kind: "choice", id: "abortion.legal", value: "some" }];
    const item = nextItem(answers, computeState(answers), "seed");
    expect(item?.kind === "choice" && item.question.id).toBe("abortion.limit");
  });

  it("skips issues whose premise a foundation answer rules out", () => {
    const communist = issueStates([{ kind: "choice", id: "economic-system.system", value: "communism" }]);
    const excluded = communist.filter((i) => i.excluded).map((i) => i.module.id);
    expect(excluded).toEqual(expect.arrayContaining(["taxes", "labor", "entitlements", "debt"]));
    expect(excluded).not.toContain("abortion");
    const autocrat = issueStates([{ kind: "choice", id: "regime.authority", value: "unelected" }]);
    expect(autocrat.filter((i) => i.excluded).map((i) => i.module.id)).toEqual(["voting-rules", "judiciary"]);
  });

  it("never skips an issue because a foundation was skipped or answered 'none fits'", () => {
    for (const value of [null, "__none_fit__"]) {
      const states = issueStates([{ kind: "choice", id: "economic-system.system", value }]);
      expect(states.some((i) => i.excluded)).toBe(false);
    }
  });

  it("keeps an issue already answered even if a later edit would rule it out", () => {
    const states = issueStates([
      { kind: "choice", id: "taxes.top-rate", value: "70" },
      { kind: "choice", id: "economic-system.system", value: "communism" },
    ]);
    const taxes = states.find((i) => i.module.id === "taxes")!;
    expect(taxes.excluded).toBe(false);
    expect(taxes.pending.length).toBeGreaterThan(0);
  });

  it("lets policy answers satisfy basic axis coverage", () => {
    const state = computeState([{ kind: "choice", id: "guns.overall", value: "strict" }]);
    expect(state.axes.regulation.answered).toBe(1);
    expect(state.axes.social.answered).toBe(1);
  });
});

describe("checklists", () => {
  const mean = (answers: QuizAnswer[], axis: (typeof axisIds)[number]) => computeState(answers).axes[axis].mean;

  it("score an unchecked item as a 'no'", () => {
    const none = mean([{ kind: "choice", id: "guns.laws", value: ["none"] }], "regulation");
    const all = mean([{ kind: "choice", id: "guns.laws", value: ["background", "red-flag", "age", "carry-permit", "assault", "buyback"] }], "regulation");
    const some = mean([{ kind: "choice", id: "guns.laws", value: ["background", "red-flag"] }], "regulation");
    expect(none).toBeGreaterThan(0.3);
    expect(all).toBeLessThan(-0.3);
    expect(some).toBeGreaterThan(all);
    expect(some).toBeLessThan(none);
  });

  it("caps same-screen evidence toward axis coverage", () => {
    const state = computeState([{ kind: "choice", id: "voting-rules.rules", value: ["photo-id"] }]);
    expect(state.axes.voting.answered).toBe(2);
  });

  it("ignore items with no axis loadings", () => {
    const withLimits = answerEvidence({ kind: "choice", id: "voting-rules.rules", value: ["term-limits"] });
    const without = answerEvidence({ kind: "choice", id: "voting-rules.rules", value: ["none"] });
    expect(withLimits).toEqual(without);
  });

  it("give every item a stance in the policy profile, checked or not", () => {
    const res = computeResult([
      { kind: "choice", id: "lgbtq.marriage", value: "protected" },
      { kind: "choice", id: "lgbtq.policies", value: ["sports"] },
    ]);
    const stances = res.profiles.find((p) => p.issueId === "lgbtq")!.attributes.filter((a) => a.questionId === "lgbtq.policies").map((a) => a.stance);
    expect(stances).toHaveLength(4);
    expect(stances).toContain("trans athletes compete by gender identity");
    expect(stances).toContain("no \"X\" marker on IDs");
  });
});

describe("order", () => {
  const run = simulate(randomRespondent("order"), "order").answers;
  const kindAt = (i: number) => {
    const a = run[i];
    return a.kind === "statement" ? "statement" : issues.find((m) => a.id.startsWith(`${m.id}.`))!;
  };

  it("asks the foundations first, before any statement", () => {
    const firstStatement = run.findIndex((a) => a.kind === "statement");
    const foundations = run.slice(0, firstStatement).map((_, i) => kindAt(i));
    expect(foundations.every((m) => m !== "statement" && m.foundation)).toBe(true);
    expect(new Set(foundations.map((m) => (m as (typeof issues)[number]).id))).toEqual(
      new Set(issues.filter((m) => m.foundation).map((m) => m.id)),
    );
  });

  it("then covers every axis in order, before any other issue", () => {
    const firstStatement = run.findIndex((a) => a.kind === "statement");
    const coverage = run.slice(firstStatement, firstStatement + axisIds.length * COVERAGE_PER_AXIS);
    expect(coverage.every((a) => a.kind === "statement")).toBe(true);
    const axesInOrder = [...new Set(coverage.map((a) => a.id.split(".")[0]))];
    expect(axesInOrder).toEqual(COVERAGE_ORDER);
  });

  it("asks issues in bank order, each as one block", () => {
    const modules = run.flatMap((_, i) => {
      const k = kindAt(i);
      return k === "statement" ? [] : [k.id];
    });
    const blocks = modules.filter((id, i) => id !== modules[i - 1]);
    expect(new Set(blocks).size).toBe(blocks.length);
    const order = issues.map((m) => m.id);
    expect(blocks).toEqual([...blocks].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
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

  it("keeps a deferred question out of the immediate selection", () => {
    const answers: QuizAnswer[] = [];
    const state = computeState(answers);
    const first = nextItem(answers, state, "defer", {}, { mode: "quick" });
    expect(first).not.toBeNull();
    const id = first!.kind === "statement" ? first!.statement.id : first!.question.id;
    const second = nextItem(answers, state, "defer", {}, {
      mode: "quick",
      deferred: [{ kind: first!.kind, id, deferredAtMode: "quick", deferCount: 1 }],
    });
    const secondId = second!.kind === "statement" ? second!.statement.id : second!.question.id;
    expect(secondId).not.toBe(id);
  });

  it("produces coverage-balanced quick and standard checkpoints", () => {
    for (const mode of ["quick", "standard"] as const) {
      const { answers, steps } = simulate(randomRespondent(`mode:${mode}`), `mode:${mode}`, 200, mode);
      const state = computeState(answers);
      expect(steps).toBe(mode === "quick" ? 24 : 54);
      expect(axisIds.every((axis) => state.axes[axis].answered >= (mode === "quick" ? 1 : 2))).toBe(true);
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
    expect(res.profiles).toHaveLength(computeState(runs[0].answers).issues.filter((i) => !i.excluded).length);
    expect(res.ideologies).toHaveLength(ideologies.length);
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

describe("statement and policy conflict", () => {
  const statementsFor = (value: number): QuizAnswer[] =>
    ["federalism.15", "federalism.16", "federalism.17", "federalism.18", "federalism.20", "federalism.11"].map((id) => ({
      kind: "statement",
      id,
      value,
    }));
  const statesPolicies: QuizAnswer[] = [
    { kind: "choice", id: "abortion.level", value: "states" },
    { kind: "choice", id: "education.department", value: "yes" },
    { kind: "choice", id: "housing.federal-role", value: "no" },
    { kind: "choice", id: "healthcare.medicaid", value: "states" },
    { kind: "choice", id: "ai.states", value: "yes" },
  ];

  it("flags an axis where statements and policy answers point opposite ways", () => {
    const state = computeState([...statementsFor(3), ...statesPolicies]);
    expect(state.axes.federalism.conflict).toBe(true);
    expect(computeResult([...statementsFor(3), ...statesPolicies]).axes.find((a) => a.axis === "federalism")!.lowReason).toBe("mixed");
  });

  it("does not flag consistent answers", () => {
    expect(computeState([...statementsFor(-3), ...statesPolicies]).axes.federalism.conflict).toBe(false);
  });
});

describe("answer snapshots", () => {
  it("record the wording and response as shown", () => {
    const shown = answerSnapshot({ kind: "choice", id: "abortion.legal", value: "some", importance: 3 });
    expect(shown?.text).toBe("Which comes closest to your view on abortion?");
    expect(shown?.options).toContain("Mixed / none of these fits");
    expect(shown?.importance).toBe("High");
    expect(answerSnapshot({ kind: "statement", id: "social.01", value: -3 })?.answer).toBe("Strongly disagree");
  });

  it("keep the wording of retired statements, which no longer score", () => {
    const retired: QuizAnswer = { kind: "statement", id: "religion.09", value: 3 };
    expect(answerSnapshot(retired)?.text).toMatch(/^Religion is a private matter/);
    expect(computeState([retired]).axes.religion.answered).toBe(0);
  });
});

describe("lenses", () => {
  const tradition = (value: string): QuizAnswer => ({ kind: "choice", id: "religion-law.tradition", value });

  it("are read from the chosen options", () => {
    expect(computeResult([tradition("sunni")]).lenses).toEqual({ tradition: "sunni" });
    expect(computeResult([{ kind: "choice", id: "regime.authority", value: "elected" }]).lenses).toEqual({ authority: "elected" });
    const party: QuizAnswer[] = [
      { kind: "choice", id: "regime.authority", value: "unelected" },
      { kind: "choice", id: "regime.ruler", value: "party" },
    ];
    expect(computeResult(party).lenses).toEqual({ authority: "party" });
  });

  it("separate religious ideologies by tradition", () => {
    const rank = (answers: QuizAnswer[], id: string) => computeResult(answers).ideologies.findIndex((m) => m.ideology.id === id);
    const theocrat: QuizAnswer[] = [
      { kind: "statement", id: "religion.28", value: 3 },
      { kind: "statement", id: "religion.29", value: 3 },
      { kind: "choice", id: "regime.authority", value: "unelected" },
      { kind: "choice", id: "regime.ruler", value: "clergy" },
    ];
    expect(rank([...theocrat, tradition("catholic")], "integralism")).toBeLessThan(rank([...theocrat, tradition("catholic")], "islamism"));
    expect(rank([...theocrat, tradition("sunni")], "islamism")).toBeLessThan(rank([...theocrat, tradition("sunni")], "integralism"));
  });

  it("let a simulated respondent on a lens-tagged ideology find it", () => {
    for (const id of ["islamism", "hindutva", "integralism", "maoism", "developmentalism"]) {
      const ideology = ideologies.find((i) => i.id === id)!;
      const lens = Object.fromEntries(lensIds.flatMap((l) => (acceptedLens(ideology, l) ? [[l, acceptedLens(ideology, l)!]] : [])));
      const { answers } = simulate({ truth: { ...ideology.position }, noise: 1, skipRate: 0, lens }, id);
      expect(computeResult(answers).ideologies[0].ideology.id, id).toBe(id);
    }
  });
});
