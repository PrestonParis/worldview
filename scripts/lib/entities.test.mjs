import { describe, it, expect } from "vitest";
import { IDENTIFIER_PROPS, PROP_FOR_SCHEME, identifierRows } from "./entities.mjs";

describe("identifierRows", () => {
  const id = "00000000-0000-4000-8000-000000000001";

  it("maps Neo4j-style id properties to crosswalk schemes", () => {
    expect(identifierRows(id, { bioguideId: "P000197", icpsrId: 15448, committeeId: "HSAG" })).toEqual([
      { entityId: id, scheme: "bioguide", value: "P000197" },
      { entityId: id, scheme: "icpsr", value: "15448" },
      { entityId: id, scheme: "congress_committee", value: "HSAG" },
    ]);
  });

  it("gives each FEC candidate id its own row", () => {
    expect(identifierRows(id, { fecCandidateIds: ["H8CA05035", "S0CA00199"] })).toEqual([
      { entityId: id, scheme: "fec_candidate", value: "H8CA05035" },
      { entityId: id, scheme: "fec_candidate", value: "S0CA00199" },
    ]);
  });

  it("skips blank and unknown properties", () => {
    expect(identifierRows(id, { bioguideId: "", wikidataId: null, name: "Nancy Pelosi" })).toEqual([]);
  });
});

describe("PROP_FOR_SCHEME", () => {
  it("inverts IDENTIFIER_PROPS one to one", () => {
    expect(Object.keys(PROP_FOR_SCHEME)).toHaveLength(Object.keys(IDENTIFIER_PROPS).length);
    for (const [prop, scheme] of Object.entries(IDENTIFIER_PROPS)) expect(PROP_FOR_SCHEME[scheme]).toBe(prop);
  });
});
