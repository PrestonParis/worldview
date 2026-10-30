import { describe, expect, it } from "vitest";
import {
  ECONOMIC_MODES,
  economicDimensionIds,
  economicMatches,
  economicModeComplete,
  economicQuestions,
  economicReadings,
  economicSchools,
  nextEconomicQuestion,
} from "./economics";

describe("Economic Foundations", () => {
  it("has a deep, directionally balanced bank for every dimension", () => {
    for (const id of economicDimensionIds) {
      const questions = economicQuestions.filter((q) => q.dimension === id);
      expect(questions.length).toBeGreaterThanOrEqual(5);
      expect(new Set(questions.map((q) => q.direction))).toEqual(new Set([-1, 1]));
      expect(questions.some((q) => q.tier === "core")).toBe(true);
      expect(questions.some((q) => q.tier === "deep")).toBe(true);
    }
    expect(economicQuestions.filter((question) => question.options).length).toBeGreaterThanOrEqual(5);
  });

  it("returns each school as its own closest reference point", () => {
    for (const school of economicSchools) {
      expect(economicMatches(school.position)[0].school.id).toBe(school.id);
    }
  });

  it("keeps an Atlas seed weaker than direct economic evidence", () => {
    const readings = economicReadings(
      { "ownership-stake": -1, "ownership-private": 1 },
      { ownership: { value: -1, confidence: "high" } },
    );
    const ownership = readings.find((reading) => reading.id === "ownership")!;

    expect(ownership.mean).toBeGreaterThan(0.4);
    expect(ownership.direct).toBe(2);
    expect(ownership.seeded).toBe(true);
  });

  it("covers all dimensions before spending questions on clarification", () => {
    const answers: Record<string, number | null> = {};
    for (let i = 0; i < economicDimensionIds.length; i++) {
      const question = nextEconomicQuestion(answers, {}, "snapshot")!;
      expect(answers).not.toHaveProperty(question.id);
      answers[question.id] = 0;
    }

    const covered = new Set(
      Object.keys(answers).map((id) => economicQuestions.find((question) => question.id === id)!.dimension),
    );
    expect(covered).toEqual(new Set(economicDimensionIds));
  });

  it("ends each checkpoint at its configured target after coverage", () => {
    const answers = Object.fromEntries(
      economicQuestions.slice(0, ECONOMIC_MODES.snapshot.target).map((q) => [q.id, 0]),
    );
    expect(economicModeComplete(answers, "snapshot")).toBe(false);

    const covered = Object.fromEntries(
      economicDimensionIds.map((id) => [economicQuestions.find((q) => q.dimension === id)!.id, 0]),
    );
    const remaining = economicQuestions.filter((q) => !(q.id in covered)).slice(0, 2);
    expect(
      economicModeComplete({ ...covered, ...Object.fromEntries(remaining.map((q) => [q.id, 0])) }, "snapshot"),
    ).toBe(true);
  });
});
