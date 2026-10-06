import { describe, expect, it } from "vitest";
import { shiftMonth, trailingSum, yearlyTotals } from "./series";

const months = (from: string, values: number[]) =>
  values.map((value, i) => ({ period: shiftMonth(from, i), periodStart: null, value }));

describe("series helpers", () => {
  it("shifts months across year boundaries", () => {
    expect(shiftMonth("2026-08", -11)).toBe("2025-09");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2025-12", 1)).toBe("2026-01");
  });

  it("sums a trailing window and refuses a short one", () => {
    const pts = months("2025-01", [1, 2, 3, 4]);
    expect(trailingSum(pts, 2)).toBe(7);
    expect(trailingSum(pts, 2, 1)).toBe(3);
    expect(trailingSum(pts, 5)).toBeNull();
  });

  it("keeps only complete calendar years by default", () => {
    const pts = months("2024-01", Array.from({ length: 15 }, () => 1));
    expect(yearlyTotals(pts)).toEqual([{ period: "2024", periodStart: "2024-01-01", value: 12 }]);
    expect(yearlyTotals(pts, { partial: true }).map((p) => p.value)).toEqual([12, 3]);
  });
});
