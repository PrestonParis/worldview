import { describe, expect, it } from "vitest";
import { directionFrom, gapSize, pointsApart, positionLabel, strengthOf, value100 } from "./axis-language";
import { parseYearSpan } from "./years";
import { compareTraditions } from "./compare";
import { explainResult } from "./explain";
import { ideologies } from "../quiz/ideologies";
import { computeResult } from "../quiz/results";

const byId = (id: string) => ideologies.find((i) => i.id === id)!;

describe("axis language", () => {
  it("names positions by strength and pole", () => {
    expect(positionLabel("immigration", 0.9)).toBe("Strongly restrictive");
    expect(positionLabel("immigration", -0.5)).toBe("Moderately open");
    expect(positionLabel("federalism", 0.3)).toBe("Leans federal");
    expect(positionLabel("engagement", 0.8)).toBe("Strongly America First");
    expect(positionLabel("social", 0.1)).toBe("Balanced");
    expect(strengthOf(-0.7)).toBe("strong");
  });

  it("reports distance on a 0–100 scale", () => {
    expect(value100(-1)).toBe(0);
    expect(value100(0)).toBe(50);
    expect(pointsApart(1.24)).toBe(62);
    expect(gapSize(0.2)).toBe("close");
    expect(gapSize(1.2)).toBe("wide");
    expect(directionFrom("immigration", -0.5, 0.8)).toBe("more restrictive");
    expect(directionFrom("immigration", 0.5, 0.52)).toBeNull();
  });
});

describe("parseYearSpan", () => {
  it("reads ranges, single years, decades and open spans", () => {
    expect(parseYearSpan("1939–1975")).toEqual({ start: 1939, end: 1975 });
    expect(parseYearSpan("c. 1474")).toEqual({ start: 1474, end: 1474 });
    expect(parseYearSpan("1920s")).toEqual({ start: 1920, end: 1929 });
    expect(parseYearSpan("2019–present", 2026)).toEqual({ start: 2019, end: 2026 });
    expect(parseYearSpan("5th century BCE")).toBeNull();
    expect(parseYearSpan("Ancient times")).toBeNull();
  });
});

describe("compareTraditions", () => {
  it("finds pair distances, shared ground and splits", () => {
    const c = compareTraditions([byId("groyper"), byId("clerical-fascism"), byId("social-democracy")]);
    expect(c.rows).toHaveLength(20);
    expect(c.pairs).toHaveLength(3);
    for (const p of c.pairs) expect(p.points).toBeGreaterThanOrEqual(0);
    expect(c.splits.length).toBeGreaterThan(0);
    expect(c.splits[0].spread).toBeGreaterThanOrEqual(c.splits.at(-1)!.spread);
    expect(c.distinctive).toHaveLength(3);
  });

  it("skips distinctive axes for a pair", () => {
    expect(compareTraditions([byId("groyper"), byId("clerical-fascism")]).distinctive).toEqual([]);
  });
});

describe("explainResult", () => {
  it("returns shared axes that agree in direction", () => {
    const result = computeResult([], {});
    const e = explainResult(result);
    for (const c of e.shared) expect(Math.sign(c.you)).toBe(Math.sign(c.them));
    expect(e.shared.length).toBeLessThanOrEqual(3);
  });
});
