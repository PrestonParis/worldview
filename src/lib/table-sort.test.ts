import { describe, expect, it } from "vitest";
import { compareKeys, defaultDir, sortKey, sortRows } from "./table-sort";

describe("sortKey", () => {
  it("reads formatted numbers", () => {
    expect(sortKey("1,234")).toBe(1234);
    expect(sortKey("$1.2M")).toBe(1_200_000);
    expect(sortKey("34.5%")).toBe(34.5);
    expect(sortKey("−3.4")).toBe(-3.4);
    expect(sortKey("+12K")).toBe(12_000);
    expect(sortKey(42)).toBe(42);
  });

  it("reads periods as positions in time", () => {
    expect(sortKey("FY 2024")).toBe(2024);
    expect(sortKey("2025")).toBe(2025);
    expect(sortKey("Aug 2026")).toBeGreaterThan(sortKey("Sep 2025") as number);
    expect(sortKey("Q3 2025")).toBeGreaterThan(sortKey("Q1 2025") as number);
    expect(sortKey("Jan 5, 2026")).toBeLessThan(sortKey("Jan 20, 2026") as number);
  });

  it("treats blanks as null and the rest as text", () => {
    expect(sortKey("—")).toBeNull();
    expect(sortKey("")).toBeNull();
    expect(sortKey(null)).toBeNull();
    expect(sortKey("Texas")).toBe("texas");
    expect(sortKey("California → Texas")).toBe("california → texas");
  });
});

describe("sorting", () => {
  it("keeps nulls last in both directions", () => {
    const keys = [3, null, 1, 2];
    expect([...keys].sort((a, b) => compareKeys(a, b, 1))).toEqual([1, 2, 3, null]);
    expect([...keys].sort((a, b) => compareKeys(a, b, -1))).toEqual([3, 2, 1, null]);
  });

  it("is stable and picks a natural first direction", () => {
    const rows = [{ n: "b", v: 1 }, { n: "a", v: 1 }, { n: "c", v: 2 }];
    expect(sortRows(rows, (r) => r.v, -1).map((r) => r.n)).toEqual(["c", "b", "a"]);
    expect(defaultDir([1, 2, null])).toBe(-1);
    expect(defaultDir(["a", "b"])).toBe(1);
  });
});
