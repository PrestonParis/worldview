import { describe, expect, it } from "vitest";
import { demographicSeries, nationalPopulation } from "./forecast";

describe("demographic forecasts", () => {
  it("covers every year through 2050", () => {
    for (const series of demographicSeries) {
      expect(series.points.at(-1)?.year).toBe(2050);
      for (let index = 1; index < series.points.length; index += 1) {
        expect(series.points[index].year).toBe(series.points[index - 1].year + 1);
      }
    }
  });

  it("starts each series at its first comparable observation", () => {
    const starts = Object.fromEntries(
      demographicSeries.map((series) => [series.id, series.points[0].year]),
    );

    expect(starts).toEqual({ age: 2010, sex: 1820, race: 2000, orientation: 2012, religion: 2007 });
  });

  it("keeps every annual composition at 100 percent", () => {
    for (const series of demographicSeries) {
      for (const point of series.points) {
        const total = Object.values(point.values).reduce((sum, value) => sum + value, 0);
        expect(total).toBeCloseTo(100, 5);
        expect(Object.values(point.values).every((value) => value >= 0 && value <= 100)).toBe(true);
      }
    }
  });

  it("keeps multiracial identity separate", () => {
    const race = demographicSeries.find((series) => series.id === "race");
    expect(race?.categories.some((category) => category.id === "nhMultiracial")).toBe(true);
  });

  it("uses the latest mutually exclusive Census race and ethnicity baseline", () => {
    const race = demographicSeries.find((series) => series.id === "race");
    const baseline = race?.points.find((point) => point.year === 2025);

    expect(race?.observedThrough).toBe(2025);
    expect(baseline?.values.nhWhite).toBeCloseTo(56.11, 1);
    expect(baseline?.values.hispanic).toBeCloseTo(20.52, 1);
    expect(race?.categories.some((category) => category.id === "white")).toBe(false);
  });
});

describe("projection ranges", () => {
  it("brackets every projected value between its lowest and highest scenario", () => {
    for (const series of demographicSeries) {
      for (const point of series.points) {
        if (point.year < series.observedThrough) {
          expect(point.low).toBeUndefined();
          continue;
        }
        for (const category of series.categories) {
          const value = point.values[category.id];
          expect(point.low?.[category.id]).toBeLessThanOrEqual(value + 0.01);
          expect(point.high?.[category.id]).toBeGreaterThanOrEqual(value - 0.01);
        }
      }
    }
  });

  it("fans out from a single point in the last observed year", () => {
    for (const series of demographicSeries) {
      const start = series.points.find((point) => point.year === series.observedThrough);
      expect(start?.low).toEqual(start?.values);
      expect(start?.high).toEqual(start?.values);
    }
  });

  it("spans the Census immigration scenarios for race", () => {
    const race = demographicSeries.find((series) => series.id === "race");
    const end = race?.points.at(-1);
    // High immigration lowers the White non-Hispanic share; zero immigration
    // raises it — the 2050 range must be several points wide.
    expect((end?.high?.nhWhite ?? 0) - (end?.low?.nhWhite ?? 0)).toBeGreaterThan(3);
    expect(race?.scenarios).toHaveLength(3);
  });
});

describe("age", () => {
  it("matches the Census 2025 estimate for adults", () => {
    expect(nationalPopulation("adults", 2025)).toBe(269764000);
    expect(nationalPopulation("residents", 2050)).toBe(360639000);
    expect(nationalPopulation("adults", 1990)).toBeNull();
  });

  it("ages the population in the middle path", () => {
    const age = demographicSeries.find((series) => series.id === "age")!;
    const now = age.points.find((point) => point.year === 2025)!;
    const end = age.points.at(-1)!;
    expect(end.values.age65plus).toBeGreaterThan(now.values.age65plus);
    expect(end.values.under18).toBeLessThan(now.values.under18);
  });
});

describe("geography availability", () => {
  it("publishes survey measures for states only", () => {
    for (const series of demographicSeries) {
      expect(series.geographies.includes("city")).toBe(series.measure === "census");
      expect(series.geographies).toContain("state");
    }
  });
});
