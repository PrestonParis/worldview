import { describe, expect, it } from "vitest";
import { benchOrder } from "./bench";

describe("benchOrder", () => {
  it("seats the Chief in the middle and alternates associates outward by seniority", () => {
    const justices = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((seniority) => ({ seniority }));
    expect(benchOrder(justices).map((j) => j.seniority)).toEqual([7, 5, 3, 1, 0, 2, 4, 6, 8]);
  });
});
