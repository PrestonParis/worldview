import { describe, expect, it } from "vitest";
import { parseHallCountyLayers } from "./local";

describe("parseHallCountyLayers", () => {
  it("turns address-intersecting public GIS layers into the exact local officials", () => {
    const officials = parseHallCountyLayers({
      0: { DISTRICT: "Dist 5", NAME: "Jane Richardson" },
      2: { NAME: "Grand Island", Mayor: "Roger Steele", MayorWebpage: "https://example.com/mayor" },
      5: { NAME: "City Council Ward 3", REP1NAME: "Jason Conley", REP2NAME: "Ryan O'Neill" },
      13: {
        HC_Sheriff: "Josh Berlie",
        HC_Attorney: "Martin Klein",
        NE_DistrictCrt_D9_1: "Andrew C. Butler",
        NE_SupremeCrt_D5: "Jeffrey J. Funke",
      },
      14: { WARD: "B", REP1: "Lisa M. Albers", REP2: "Tracy Goodman", REP3: "Hank McFarland" },
    });

    expect(officials.map((item) => item.name)).toEqual(expect.arrayContaining([
      "Roger Steele",
      "Jason Conley",
      "Ryan O'Neill",
      "Lisa M. Albers",
      "Tracy Goodman",
      "Hank McFarland",
      "Jane Richardson",
      "Josh Berlie",
      "Martin Klein",
      "Andrew C. Butler",
      "Jeffrey J. Funke",
    ]));
    expect(officials.find((item) => item.name === "Jane Richardson")?.jurisdiction).toBe("Dist 5");
    expect(officials.every((item) => item.status === "verified")).toBe(true);
  });
});
