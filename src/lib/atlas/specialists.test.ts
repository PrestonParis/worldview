import { describe, expect, it } from "vitest";
import { authorityAssessment, specialistDimensions, specialistMatches } from "./specialists";

describe("specialistDimensions", () => {
  it("scores answered questions in their declared direction", () => {
    const dimensions = specialistDimensions(authorityAssessment, {
      "legitimacy-1": 1,
      "legitimacy-2": 1,
      "power-1": -1,
    });

    expect(dimensions.legitimacy).toBe(0);
    expect(dimensions.power).toBe(1);
    expect(dimensions.constraint).toBeUndefined();
  });

  it("blends an Atlas seed without replacing the measured answer", () => {
    const dimensions = specialistDimensions(authorityAssessment, { "power-1": 1 }, { power: -1, liberty: 0.4 });

    expect(dimensions.power).toBeCloseTo(-1);
    expect(dimensions.liberty).toBe(0.4);
  });
});

describe("specialistMatches", () => {
  it("returns schools from closest to farthest", () => {
    const dimensions = authorityAssessment.schools[0].position;
    const matches = specialistMatches(authorityAssessment, dimensions);

    expect(matches[0].school.id).toBe(authorityAssessment.schools[0].id);
    expect(matches[0].score).toBe(100);
    expect(matches[0].distance).toBe(0);
    expect(matches.at(-1)!.distance).toBeGreaterThanOrEqual(matches[0].distance);
  });
});
