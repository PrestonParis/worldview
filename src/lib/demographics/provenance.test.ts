import { describe, expect, it } from "vitest";
import { getDemographicSeries } from "./forecast";
import { publishedYears, yearProvenance } from "./provenance";

const places = { state: "Georgia", city: "Atlanta" };

describe("year provenance", () => {
  it("labels Census figures as estimates and later years as Census projections", () => {
    const race = getDemographicSeries("race");
    expect(yearProvenance(race, "national", 2025)).toMatchObject({ status: "estimated", by: "Census" });
    expect(yearProvenance(race, "national", 2040)).toMatchObject({ status: "projected", by: "Census" });
  });

  it("credits Worldview for every state and city projection", () => {
    for (const id of ["age", "sex", "race", "religion", "orientation"] as const) {
      expect(yearProvenance(getDemographicSeries(id), "state", 2040, places).by).toBe("Worldview");
    }
    const city = yearProvenance({ ...getDemographicSeries("race"), observedThrough: 2024 }, "city", 2025, places);
    expect(city).toMatchObject({ status: "projected", by: "Worldview" });
    expect(city.detail).toContain("Atlanta");
  });

  it("treats city figures through 2024 as ACS estimates", () => {
    expect(yearProvenance({ ...getDemographicSeries("race"), observedThrough: 2024 }, "city", 2024, places)).toMatchObject({
      status: "estimated",
      by: "ACS",
    });
  });

  it("marks interpolated survey years and modeled state orientation", () => {
    const religion = getDemographicSeries("religion");
    expect(yearProvenance(religion, "national", 2014).status).toBe("estimated");
    expect(yearProvenance(religion, "national", 2019).status).toBe("modeled");
    expect(yearProvenance(getDemographicSeries("orientation"), "state", 2024, places).status).toBe("modeled");
    expect(publishedYears(getDemographicSeries("orientation"), "state")).toEqual([]);
  });

  it("separates decennial counts from interpolated years for historical sex ratios", () => {
    const sex = getDemographicSeries("sex");
    expect(yearProvenance(sex, "national", 1900).status).toBe("reported");
    expect(yearProvenance(sex, "national", 1905).status).toBe("modeled");
  });
});
