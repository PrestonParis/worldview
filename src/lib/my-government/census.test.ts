import { describe, expect, it } from "vitest";
import { parseCensusGeography } from "./census";

describe("parseCensusGeography", () => {
  it("extracts each level of government without relying on layer ordering", () => {
    const result = parseCensusGeography({
      result: {
        addressMatches: [{
          matchedAddress: "1600 PENNSYLVANIA AVE NW, WASHINGTON, DC, 20500",
          coordinates: { x: -77.0365, y: 38.8977 },
          geographies: {
            "State Legislative Districts - Lower": [{ NAME: "Ward 2", SLDL: "02", GEOID: "11002" }],
            Counties: [{ NAME: "District of Columbia", GEOID: "11001" }],
            "Congressional Districts": [{ NAME: "Delegate District (at Large)", BASENAME: "00", GEOID: "1198" }],
            States: [{ NAME: "District of Columbia", STUSAB: "DC", GEOID: "11" }],
            "Unified School Districts": [{ NAME: "District of Columbia Public Schools", GEOID: "1100030" }],
            "Incorporated Places": [{ NAME: "Washington city", GEOID: "1150000" }],
          },
        }],
      },
    });

    expect(result.stateCode).toBe("DC");
    expect(result.longitude).toBe(-77.0365);
    expect(result.congressionalDistrict).toBe("0");
    expect(result.stateLowerDistrict).toBe("Ward 2");
    expect(result.schoolDistricts[0].name).toBe("District of Columbia Public Schools");
    expect(result.districts.map((item) => item.kind)).toContain("U.S. House");
  });

  it("rejects an unmatched address", () => {
    expect(() => parseCensusGeography({ result: { addressMatches: [] } })).toThrow(
      "could not match",
    );
  });
});
