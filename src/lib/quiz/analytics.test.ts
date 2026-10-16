import { describe, it, expect } from "vitest";
import { analyzeQuiz, MIN_SUGGEST_N, toCsv, type AnalyticsSession } from "./analytics";
import { DIRECTIONAL_SLOPE, DIRECTIONAL_THRESHOLD, IDEAL_WIDTH, RESPONSE_SD, primaryAxis, seededRandom, type QuizAnswer } from "./engine";
import { statements } from "./bank";
import { randomRespondent, simulate } from "./sim";
import { parseOpenerEvent } from "./openers";
import type { Statement } from "./types";

const T0 = Date.parse("2026-10-01T12:00:00Z");

function session(answers: QuizAnswer[], over: Partial<AnalyticsSession> = {}): AnalyticsSession {
  return {
    key: crypto.randomUUID(),
    source: "live",
    slug: null,
    claimed: false,
    isTest: false,
    bankVersion: "4.0.0",
    engineVersion: "5.0.0",
    targetMode: "standard",
    highestCompletedMode: null,
    entryVariant: "general",
    entryTopic: null,
    answers,
    refine: {},
    deferred: [],
    checkpointHistory: [],
    createdAt: new Date(T0),
    updatedAt: new Date(T0),
    completedAt: null,
    ...over,
  };
}

// A response drawn from the engine's own model: a discretized normal around
// the predicted agreement.
function respond(st: Statement, location: number, theta: number, rand: () => number): number {
  const mu =
    st.model === "ideal"
      ? 3 - 6 * Math.min(1, Math.abs(theta - location) / IDEAL_WIDTH)
      : 3 * Math.tanh(DIRECTIONAL_SLOPE * Math.sign(location) * (theta - DIRECTIONAL_THRESHOLD * location));
  const w = [-3, -2, -1, 0, 1, 2, 3].map((r) => Math.exp(-((r - mu) ** 2) / (2 * RESPONSE_SD ** 2)));
  let x = rand() * w.reduce((a, b) => a + b, 0);
  let i = 0;
  while (x > w[i]) x -= w[i++];
  return Math.min(i, 6) - 3;
}

// Respondents spread over one axis, each answering every statement written
// for it, 20 seconds apart. `shift` moves one item's true location.
function axisPanel(axis: string, n: number, shift?: { id: string; location: number }) {
  const items = statements.filter((s) => primaryAxis(s) === axis);
  const rand = seededRandom(`panel:${axis}:${shift?.id ?? ""}`);
  return Array.from({ length: n }, (_, k) => {
    const theta = -0.9 + (1.8 * k) / (n - 1);
    const answers: QuizAnswer[] = items.map((st, i) => {
      const location = shift?.id === st.id ? shift.location : st.axes[primaryAxis(st)]!.location;
      return { kind: "statement", id: st.id, value: respond(st, location, theta, rand), shown: { text: st.text, answer: "", at: new Date(T0 + i * 20_000).toISOString() } };
    });
    return session(answers, { key: `p${k}` });
  });
}

describe("parameter recovery", () => {
  const panel = axisPanel("redistribution", 160);
  const a = analyzeQuiz(panel, [], { now: new Date(T0 + 86_400_000) });

  it("recovers the response noise and slope it was generated with", () => {
    const sd = a.parameters.find((p) => p.name === "RESPONSE_SD")!;
    expect(sd.fitted!.lo).toBeLessThanOrEqual(RESPONSE_SD);
    expect(sd.fitted!.hi).toBeGreaterThanOrEqual(RESPONSE_SD);
    const slope = a.parameters.find((p) => p.name === "DIRECTIONAL_SLOPE")!;
    expect(Math.abs(slope.fitted!.estimate - DIRECTIONAL_SLOPE)).toBeLessThanOrEqual(1);
  });

  it("finds item locations near the ones used, with items that fit", () => {
    const items = a.statements.filter((s) => s.axis === "redistribution");
    expect(items.length).toBeGreaterThan(5);
    const covered = items.filter((s) => s.location >= s.fittedLocation!.lo - 0.1 && s.location <= s.fittedLocation!.hi + 0.1);
    expect(covered.length / items.length).toBeGreaterThanOrEqual(0.8);
    for (const s of items) {
      expect(s.outfit!).toBeGreaterThan(0.5);
      expect(s.outfit!).toBeLessThan(1.6);
      if (s.expectedSign !== null && Math.abs(s.location) >= 0.25) expect(Math.sign(s.itemRest!)).toBe(s.expectedSign);
    }
  });

  it("has reliable positions on the measured axis", () => {
    const axis = a.axes.find((x) => x.axis === "redistribution")!;
    expect(axis.n).toBe(160);
    expect(axis.reliability!).toBeGreaterThan(0.7);
  });

  it("flags an item whose real location differs from the bank's", () => {
    const target = statements.find((s) => primaryAxis(s) === "redistribution" && s.model === "directional" && s.axes.redistribution!.location <= -0.5)!;
    const shifted = axisPanel("redistribution", 160, { id: target.id, location: 0.6 });
    const b = analyzeQuiz(shifted, [], { now: new Date(T0 + 86_400_000) });
    const flagged = b.suggestions.filter((s) => s.target === target.id);
    expect(flagged.some((s) => s.kind === "statement-location" || s.kind === "statement-reversed")).toBe(true);
  });
});

describe("session quality and funnel", () => {
  const timed = (values: number[], seconds: number): QuizAnswer[] => {
    const items = statements.slice(0, values.length);
    return items.map((st, i) => ({ kind: "statement", id: st.id, value: values[i], shown: { text: st.text, answer: "", at: new Date(T0 + i * seconds * 1000).toISOString() } }));
  };
  const normal = session(timed([1, -2, 3, 0, -1, 2, 1, -3, 2, 0, 1, -1], 15));
  const speeder = session(timed([1, -2, 3, 0, -1, 2, 1, -3, 2, 0, 1, -1], 1));
  const straight = session(timed(Array(12).fill(2), 15));
  const test = session(timed([1, 2, 3], 15), { isTest: true });

  it("flags speeders, straight-liners and tests, and leaves them out by default", () => {
    const a = analyzeQuiz([normal, speeder, straight, test], [], { now: new Date(T0 + 3_600_000) });
    expect(a.overview.flagged).toEqual({ test: 1, speeder: 1, "straight-line": 1 });
    expect(a.overview.analyzed).toBe(1);
    expect(a.overview.medianSecondsPerAnswer).toBe(15);
    expect(analyzeQuiz([normal, speeder, straight, test], [], { includeFlagged: true }).overview.analyzed).toBe(4);
  });

  it("counts new sessions, visits and opener answers", () => {
    const a = analyzeQuiz(
      [normal, session([], { createdAt: new Date(T0 + 7_200_000) })],
      [
        { createdAt: new Date(T0), answers: [], started: false, mode: null },
        { createdAt: new Date(T0), answers: [{ id: "redistribution.02", value: 2, ms: 4000 }], started: false, mode: null },
        { createdAt: new Date(T0), answers: [{ id: "redistribution.02", value: -1, ms: 6000 }, { id: "social.13", value: 1, ms: 9000 }], started: true, mode: "quick" },
      ],
      { now: new Date(T0 + 3 * 3_600_000), newSince: new Date(T0 + 3_600_000) },
    );
    expect(a.overview.newCount).toBe(1);
    expect(a.openers.visits).toBe(3);
    expect(a.openers.answered).toEqual([2, 1, 0]);
    expect(a.openers.started).toBe(1);
    expect(a.openers.medianSecondsToFirst).toBe(5);
    expect(a.daily.at(-1)!.visits + a.daily[0].visits).toBeGreaterThan(0);
  });

  it("replays simulated quizzes end to end", () => {
    const sims = Array.from({ length: 4 }, (_, i) => {
      const { answers } = simulate(randomRespondent(`a${i}`), `a${i}`, 400, "quick");
      return session(answers, { targetMode: "quick", highestCompletedMode: "quick" });
    });
    const a = analyzeQuiz(sims, [], { includeFlagged: true, withResponses: true });
    expect(a.ideologies.n).toBe(4);
    expect(a.overview.checkpoints.quick).toBe(4);
    expect(a.responses!.length).toBe(sims.reduce((n, s) => n + s.answers.length, 0));
    expect(a.suggestions.every((s) => s.n >= MIN_SUGGEST_N)).toBe(true);
    const csv = toCsv(a.responses!, ["respondent", "item", "value"]);
    expect(csv.split("\n")[0]).toBe("respondent,item,value");
  });
});

describe("opener events", () => {
  it("accepts well-formed visits and rejects anything else", () => {
    expect(parseOpenerEvent({ answers: [{ id: "social.13", value: -3, ms: 1200 }], started: true, mode: "deep" })).toEqual({
      answers: [{ id: "social.13", value: -3, ms: 1200 }],
      started: true,
      mode: "deep",
    });
    expect(parseOpenerEvent({ answers: [], started: false, mode: "deep" })!.mode).toBeNull();
    expect(parseOpenerEvent({ answers: [{ id: "ownership.01", value: 1, ms: 1 }], started: false })).toBeNull();
    expect(parseOpenerEvent({ answers: [{ id: "social.13", value: 4, ms: 1 }], started: false })).toBeNull();
    expect(parseOpenerEvent({ answers: [{ id: "social.13", value: 1, ms: 1 }, { id: "social.13", value: 1, ms: 2 }], started: false })).toBeNull();
    expect(parseOpenerEvent({ answers: [], started: true, mode: "huge" })).toBeNull();
    expect(parseOpenerEvent("nope")).toBeNull();
  });
});
