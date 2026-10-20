import { describe, expect, it } from "vitest";
import { economicDimensionIds, economicMatches, economicQuestions, economicSchools } from "./economics";

describe("Economic Foundations", () => {
  it("asks two balanced questions on every dimension", () => {
    for (const id of economicDimensionIds) {
      const questions = economicQuestions.filter((q) => q.dimension === id);
      expect(questions).toHaveLength(2);
      expect(new Set(questions.map((q) => q.direction))).toEqual(new Set([-1, 1]));
    }
  });

  it("returns each school as its own closest reference point", () => {
    for (const school of economicSchools) {
      expect(economicMatches(school.position)[0].school.id).toBe(school.id);
    }
  });
});
