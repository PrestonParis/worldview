import { describe, expect, it } from "vitest";
import { demographicSeries, getDemographicSeries } from "./forecast";
import { packedValue, packSeries, projectRegion, trendPath, unpackSeries } from "./regional";

const race = getDemographicSeries("race");
const reference = { points: race.points, scenarios: race.scenarios ?? [] };
const history = race.points.filter((point) => point.year <= 2025).map(({ year, values }) => ({ year, values }));
const sum = (values: Record<string, number>) => Object.values(values).reduce((total, value) => total + value, 0);

describe("regional projections", () => {
  it("reproduces the reference when the region matches it", () => {
    const { points } = projectRegion({ history, observedThrough: 2025, reference, includeTrend: false });
    const mine = points.find((point) => point.year === 2050)!;
    const theirs = race.points.find((point) => point.year === 2050)!;
    for (const key of Object.keys(theirs.values)) expect(mine.values[key]).toBeCloseTo(theirs.values[key], 0);
  });

  it("keeps compositions whole and brackets the central path", () => {
    const skewed = history.map(({ year, values }) => ({
      year,
      values: { ...values, nhWhite: values.nhWhite + 20, hispanic: Math.max(1, values.hispanic - 15), nhAsian: values.nhAsian / 2 },
    }));
    const { points, scenarios } = projectRegion({ history: skewed, observedThrough: 2025, reference, includeTrend: true });
    expect(points.at(-1)?.year).toBe(2050);
    expect(scenarios).toHaveLength((race.scenarios?.length ?? 0) + 1);
    for (const point of points.filter((item) => item.year > 2025)) {
      expect(sum(point.values)).toBeCloseTo(100, 5);
      for (const key of Object.keys(point.values)) {
        expect(point.low![key]).toBeLessThanOrEqual(point.values[key] + 0.01);
        expect(point.high![key]).toBeGreaterThanOrEqual(point.values[key] - 0.01);
      }
    }
  });

  it("scales whole scenarios, so a majority group does not take the national swing", () => {
    // A region that is 90% White non-Hispanic should lose far fewer points
    // than the national 20% relative decline would imply.
    const base = { nhWhite: 90, hispanic: 3, nhBlack: 2, nhAsian: 2, nhMultiracial: 2.5, nhAian: 0.4, nhNhpi: 0.1 };
    const { points } = projectRegion({
      history: [{ year: 2025, values: base }],
      observedThrough: 2025,
      reference,
      includeTrend: false,
    });
    expect(points.at(-1)!.low!.nhWhite).toBeGreaterThan(80);
  });

  it("holds categories the trend should not extrapolate", () => {
    const path = trendPath(
      [
        { year: 2014, values: { a: 60, b: 39, c: 1 } },
        { year: 2024, values: { a: 50, b: 47, c: 3 } },
      ],
      2024,
      { hold: ["c"] },
    );
    expect(path.at(-1)!.values.c).toBeCloseTo(3, 0);
  });

  it("round-trips through the packed file format", () => {
    const { points } = projectRegion({ history, observedThrough: 2025, reference, includeTrend: true });
    const keys = race.categories.map((category) => category.id);
    const packed = packSeries(points, 2025, keys);
    const unpacked = unpackSeries(packed, race, { basis: "test", sources: [] }, "Residents of Testland");
    expect(unpacked.points).toHaveLength(points.length);
    expect(unpacked.points.at(-1)?.high?.hispanic).toBeCloseTo(points.at(-1)!.high!.hispanic, 2);
    expect(unpacked.points[0].low).toBeUndefined();
    expect(unpacked.basis).toBe("test");
    expect(packedValue(packed, "hispanic", 2050)).toBeCloseTo(points.at(-1)!.values.hispanic, 2);
    expect(packedValue(packed, "hispanic", 1990)).toBeNull();
  });

  it("unpacks only the categories a region publishes", () => {
    const religion = demographicSeries.find((series) => series.id === "religion")!;
    const packed = packSeries(
      [{ year: 2024, values: { christian: 60, unaffiliated: 30, otherReligions: 8, notReported: 2 } }],
      2024,
      ["christian", "unaffiliated", "otherReligions", "notReported"],
    );
    const unpacked = unpackSeries(packed, religion, { basis: "", sources: [] }, "Adults");
    expect(unpacked.categories.map((category) => category.id)).not.toContain("multiChristian");
  });
});
