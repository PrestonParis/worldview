import { describe, expect, it } from "vitest";
import { buildDirectory, stateAbbrOf } from "./directory";
import type { Entity } from "../validation/entity";

const entity = (id: string, type: Entity["type"], metadata: Record<string, unknown> = {}): Entity => ({
  id,
  type,
  name: id,
  metadata: JSON.stringify(metadata),
  createdAt: "",
  updatedAt: "",
});

describe("people directory", () => {
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
    const { rows, facets } = buildDirectory(entities, degree, { state: "TX", side: "conservative" });

    expect(rows.map((row) => row.id)).toEqual(["r-tx"]);
    // Side ignores its own filter but respects state = TX.
    expect(facets.side).toEqual({ liberal: 1, conservative: 1 });
    // State ignores its own filter but respects side = conservative.
    expect(facets.state).toEqual({ TX: 1, CA: 1 });
    expect(facets.ties).toEqual({ "10+": 1 });
  });
});
