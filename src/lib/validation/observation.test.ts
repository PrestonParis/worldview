import { describe, expect, it } from "vitest";
import { observationBatchSchema, periodEnd, periodStart } from "./observation";

const ok = { metric: "deportations", geoLevel: "state", geoid: "48", period: "2025", value: 10 };

describe("partner observations", () => {
  it("accepts a well-formed batch", () => {
    const parsed = observationBatchSchema.safeParse({
      metrics: { deportations: { label: "Deportations", unit: "people" } },
      observations: [ok, { ...ok, geoLevel: "county", geoid: "48201", period: "FY2025", value: null }],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects malformed geography codes for known levels", () => {
    const parsed = observationBatchSchema.safeParse({ observations: [{ ...ok, geoid: "TX" }] });
    expect(parsed.success).toBe(false);
  });

  it("allows partner-defined geography levels", () => {
    const parsed = observationBatchSchema.safeParse({
      observations: [{ ...ok, geoLevel: "immigration_court", geoid: "HOU" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unparseable periods and metric names", () => {
    expect(observationBatchSchema.safeParse({ observations: [{ ...ok, period: "May 2025" }] }).success).toBe(false);
    expect(observationBatchSchema.safeParse({ observations: [{ ...ok, metric: "Total Count" }] }).success).toBe(false);
  });

  it("derives the first day of each period", () => {
    expect(periodStart("2024")).toBe("2024-01-01");
    expect(periodStart("2024-07")).toBe("2024-07-01");
    expect(periodStart("2024-07-15")).toBe("2024-07-15");
    expect(periodStart("2024-Q3")).toBe("2024-07-01");
    expect(periodStart("FY2025")).toBe("2024-10-01");
  });

  it("derives the last day of each period", () => {
    expect(periodEnd("2024")).toBe("2024-12-31");
    expect(periodEnd("2024-02")).toBe("2024-02-29");
    expect(periodEnd("2024-Q2")).toBe("2024-06-30");
    expect(periodEnd("FY2025")).toBe("2025-09-30");
    expect(periodEnd("2024-07-15")).toBe("2024-07-15");
  });
});
