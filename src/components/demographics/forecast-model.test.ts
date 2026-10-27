import { describe, expect, it } from "vitest";
import type { DemographicSeries } from "@/lib/demographics/forecast";
import { fitRange, rangeAround, seriesBounds } from "./forecast-model";

const series = {
  points: [{ year: 2000 }, { year: 2010 }, { year: 2020 }],
} as DemographicSeries;

describe("demographic forecast ranges", () => {
  it("reads the bounds from the available series", () => {
    expect(seriesBounds(series)).toEqual([2000, 2020]);
  });

  it("keeps a centered range inside the available years", () => {
    expect(rangeAround(series, 2002, 10)).toEqual({ start: 2000, end: 2010 });
    expect(rangeAround(series, 2019, 10)).toEqual({ start: 2010, end: 2020 });
  });

  it("fits a stored range to a shorter geography", () => {
    expect(fitRange({ start: 1990, end: 2030 }, series)).toEqual({ start: 2000, end: 2020 });
  });
});
