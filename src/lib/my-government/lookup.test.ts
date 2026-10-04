import { describe, expect, it } from "vitest";
import { buildOfficeShells, mergeOfficialCoverage } from "./lookup";
import type { CensusGeography, GovernmentOfficial } from "./types";

const neGeography: CensusGeography = {
  matchedAddress: "135 WEDGEWOOD DR, GRAND ISLAND, NE, 68801",
  stateCode: "NE",
  stateName: "Nebraska",
  countyName: "Hall County",
  countyGeoid: "31079",
  placeName: "Grand Island city",
  placeGeoid: "3119595",
  longitude: -98.3378,
  latitude: 40.8985,
  congressionalDistrict: "3",
  stateUpperDistrict: "State Senate District 35",
  stateLowerDistrict: "",
  schoolDistricts: [{ kind: "Unified School District", name: "Grand Island Public Schools", geoid: "3100016" }],
  districts: [],
};

describe("government coverage", () => {
  it("does not invent a lower-chamber representative for unicameral Nebraska", () => {
    const shells = buildOfficeShells(neGeography);
    expect(shells.some((item) => item.office === "State representative")).toBe(false);
    expect(shells.some((item) => item.office === "State senator")).toBe(true);
  });

  it("keeps multiple ward members and removes their resolved office from gaps", () => {
    const resolved: GovernmentOfficial[] = ["Member One", "Member Two", "Member Three"].map((name, index) => ({
      id: `school-${index}`,
      office: "School board",
      level: "local",
      jurisdiction: "Ward B",
      name,
      status: "verified",
      sourceLabel: "Official GIS",
      sourceUrl: "https://example.com",
    }));
    const result = mergeOfficialCoverage(buildOfficeShells(neGeography), resolved);
    expect(result.officials).toHaveLength(3);
    expect(result.gaps.some((item) => item.office === "School board")).toBe(false);
  });
});
