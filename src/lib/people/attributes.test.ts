import { describe, expect, it } from "vitest";
import { buildAttributes, stateAbbrOf } from "./attributes";
import type { Entity } from "../validation/entity";

const entity = (id: string, type: Entity["type"], metadata: Record<string, unknown> = {}): Entity => ({
  id,
  type,
  name: id,
  metadata: JSON.stringify(metadata),
  createdAt: "",
  updatedAt: "",
});

describe("people attributes", () => {
  it("normalises full state names and abbreviations", () => {
    expect(stateAbbrOf(entity("a", "politician", { state: "Texas" }))).toBe("TX");
    expect(stateAbbrOf(entity("b", "politician", { state: "tx" }))).toBe("TX");
    expect(stateAbbrOf(entity("c", "politician", { state: "Guam" }))).toBeNull();
  });

  it("counts each facet against the other active filters only", () => {
    const entities = [
      entity("d-tx", "politician", { party: "Democratic", state: "TX" }),
      entity("r-tx", "politician", { party: "Republican", state: "Texas" }),
      entity("r-ca", "politician", { party: "Republican", state: "CA" }),
      entity("org", "organization"),
    ];
    const degree = new Map([["d-tx", 3], ["r-tx", 30]]);
    const { rows, facets } = buildAttributes(entities, degree, { state: "TX", side: "conservative" });

    expect(rows.map((row) => row.id)).toEqual(["r-tx"]);
    // Side ignores its own filter but respects state = TX.
    expect(facets.side).toEqual({ liberal: 1, conservative: 1 });
    // State ignores its own filter but respects side = conservative.
    expect(facets.state).toEqual({ TX: 1, CA: 1 });
    expect(facets.ties).toEqual({ "10+": 1 });
  });

  it("filters by multi-valued traits and counts people without a record", () => {
    const entities = [
      entity("a", "politician", { party: "Democratic", state: "TX" }),
      entity("b", "politician", { party: "Republican", state: "TX" }),
      entity("c", "pundit"),
      entity("org", "organization"),
    ];
    const traits = new Map([
      ["a", { sex: "female", birthYear: 1970, birthCountry: "Mexico", race: ["hispanic"], ancestry: ["Mexican"], religion: ["catholic"] }],
      ["b", { sex: "male", birthYear: 1950, birthCountry: "United States", race: [], ancestry: ["Irish", "German"], religion: ["catholic"] }],
    ]);
    const { rows, facets } = buildAttributes(entities, new Map(), { religion: "catholic", ancestry: "Irish" }, traits);

    expect(rows.map((row) => row.id)).toEqual(["b"]);
    // Ancestry ignores its own filter: both Catholics, every ancestry each holds.
    expect(facets.ancestry).toEqual({ Mexican: 1, Irish: 1, German: 1 });
    // Religion respects ancestry = Irish; the organization never counts.
    expect(facets.religion).toEqual({ catholic: 1 });
    expect(facets.born).toEqual({ us: 1 });
    expect(facets.gen).toEqual({ boomer: 1 });
    const all = buildAttributes(entities, new Map(), {}, traits);
    expect(all.facets.sex).toEqual({ female: 1, male: 1, none: 1 });
    expect(all.facets.race).toEqual({ hispanic: 1, none: 2 });
    expect(all.facetTotals.sex).toBe(3);
    expect(all.facetTotals.race).toBe(3);
    // Ordinary organizations do not inflate personal-detail coverage or get
    // described as politically unclassified.
    expect(all.facets.side).toEqual({ liberal: 1, conservative: 1, uncharacterized: 1 });
    expect(all.facetTotals.side).toBe(3);
  });
});
