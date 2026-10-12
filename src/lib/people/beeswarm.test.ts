import { describe, expect, it } from "vitest";
import { beeswarm } from "./beeswarm";

describe("beeswarm", () => {
  it("keeps isolated points on the axis", () => {
    expect(beeswarm([0, 100, 200], 5)).toEqual([0, 0, 0]);
  });

  it("never overlaps two circles", () => {
    const xs = Array.from({ length: 200 }, (_, i) => 50 + Math.sin(i) * 20);
    const ys = beeswarm(xs, 4, 1);
    for (let a = 0; a < xs.length; a++) {
      for (let b = a + 1; b < xs.length; b++) {
        expect(Math.hypot(xs[a] - xs[b], ys[a] - ys[b])).toBeGreaterThanOrEqual(9 - 1e-6);
      }
    }
  });

  it("stacks identical values symmetrically around the axis", () => {
    const ys = beeswarm([10, 10, 10], 5, 0);
    expect(ys.map(Math.abs).sort((a, b) => a - b)).toEqual([0, 10, 10]);
    expect(Math.sign(ys[1]) * Math.sign(ys[2])).toBe(-1);
  });
});
