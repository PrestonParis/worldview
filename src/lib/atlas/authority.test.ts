import { describe, expect, it } from "vitest";
import {
  AUTHORITY_MODES,
  authorityDimensionIds,
  authorityDimensionValues,
  authorityMatches,
  authorityModeComplete,
  authorityQuestionById,
  authorityQuestions,
  authorityReadings,
  authoritySchools,
  nextAuthorityQuestion,
  type AuthorityAnswers,
} from "./authority";

describe("power and democracy assessment", () => {
  it("has five questions for every dimension and a 60-question deep map", () => {
    expect(authorityQuestions).toHaveLength(60);
    for (const id of authorityDimensionIds) {
      expect(authorityQuestions.filter((question) => question.dimension === id)).toHaveLength(5);
    }
    expect(AUTHORITY_MODES.deep.target).toBe(60);
    expect(authorityQuestions.filter((question) => question.options).length).toBeGreaterThanOrEqual(6);
  });

  it("keeps ids unique", () => {
    expect(authorityQuestionById.size).toBe(authorityQuestions.length);
    expect(new Set(authoritySchools.map((school) => school.id)).size).toBe(authoritySchools.length);
  });

  it("recovers every governing tradition from its own ideal position", () => {
    for (const school of authoritySchools) {
      expect(authorityMatches(school.position)[0].school.id).toBe(school.id);
    }
  });

  it("treats an Atlas seed as a weak prior that direct evidence overtakes", () => {
    const first = authorityQuestions.find(
      (question) => question.dimension === "executive" && question.direction === 1,
    )!;
    const seed = { executive: { value: -1, confidence: "low" as const } };
    expect(authorityReadings({}, seed).find((reading) => reading.id === "executive")?.mean).toBe(-1);
    const reading = authorityReadings({ [first.id]: 1 }, seed).find((item) => item.id === "executive")!;
    expect(reading.mean).toBeGreaterThan(0.5);
    expect(reading.seeded).toBe(true);
  });

  it("covers all dimensions before asking a clarifier", () => {
    let answers: AuthorityAnswers = {};
    const seen: string[] = [];
    for (let index = 0; index < authorityDimensionIds.length; index += 1) {
      const next = nextAuthorityQuestion(answers, {}, "snapshot")!;
      seen.push(next.dimension);
      expect(next.tier).toBe("core");
      answers = { ...answers, [next.id]: 0 };
    }
    expect(new Set(seen)).toEqual(new Set(authorityDimensionIds));
  });

  it("does not finish a checkpoint without coverage", () => {
    const oneDimension = Object.fromEntries(
      authorityQuestions.slice(0, AUTHORITY_MODES.snapshot.target).map((question) => [question.id, 0]),
    );
    expect(authorityModeComplete(oneDimension, "snapshot")).toBe(false);

    const covered = Object.fromEntries(
      authorityDimensionIds.map((id) => [authorityQuestions.find((question) => question.dimension === id)!.id, 0]),
    );
    const remaining = authorityQuestions.filter((question) => !(question.id in covered)).slice(0, 2);
    expect(
      authorityModeComplete(
        { ...covered, ...Object.fromEntries(remaining.map((question) => [question.id, 0])) },
        "snapshot",
      ),
    ).toBe(true);
  });

  it("produces bounded dimensions for uncertain and direct answers", () => {
    const answers = Object.fromEntries(
      authorityQuestions.map((question, index) => [question.id, index % 4 === 0 ? null : index % 2 ? 1 : -1]),
    );
    for (const value of Object.values(authorityDimensionValues(answers))) {
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
