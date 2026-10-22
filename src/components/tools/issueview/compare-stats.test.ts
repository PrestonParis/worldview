import { describe, expect, it } from "vitest";
import { correlationMatrix, linearFit, pairStats, pairs, pearson, ranks, spearman } from "./compare-stats";

const row = (geoid: string, ...values: (number | null)[]) => ({ geoid, values });

describe("pearson", () => {
  it("is ±1 for perfect lines", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1);
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1);
  });

  it("is null for a constant column or fewer than 3 pairs", () => {
    expect(pearson([1, 2, 3], [5, 5, 5])).toBeNull();
    expect(pearson([1, 2], [3, 4])).toBeNull();
  });
});

describe("spearman", () => {
  it("averages tied ranks", () => {
    expect(ranks([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4]);
  });

  it("is 1 for any increasing relationship", () => {
    expect(spearman([1, 2, 3, 4, 5], [1, 8, 27, 64, 1000])).toBeCloseTo(1);
  });
});

describe("pairs and fit", () => {
  const rows = [row("a", 1, 3), row("b", 2, null), row("c", 3, 7), row("d", 4, 9), row("e", 5, 11)];

  it("drops places missing either value", () => {
    expect(pairs(rows, 0, 1).map((p) => p.geoid)).toEqual(["a", "c", "d", "e"]);
  });

  it("fits y = 2x + 1 with zero residuals", () => {
    const fit = linearFit([1, 3, 4, 5], [3, 7, 9, 11])!;
    expect(fit.slope).toBeCloseTo(2);
    expect(fit.intercept).toBeCloseTo(1);
    const stats = pairStats(rows, 0, 1);
    expect(stats.n).toBe(4);
    expect(stats.residuals.get("c")).toBeCloseTo(0);
    expect(stats.residuals.has("b")).toBe(false);
  });
});

describe("correlationMatrix", () => {
  it("is symmetric with counts per pair", () => {
    const rows = [row("a", 1, 2, 5), row("b", 2, 4, null), row("c", 3, 6, 1), row("d", 4, 8, 3)];
    const m = correlationMatrix(rows, 3);
    expect(m[0][1].r).toBeCloseTo(1);
    expect(m[1][0]).toBe(m[0][1]);
    expect(m[0][2].n).toBe(3);
    expect(m[2][2]).toEqual({ r: 1, n: 3 });
  });
});
