import { describe, expect, it } from "vitest";
import { districtKey, selectStateOfficials, type StateOfficialRow } from "./state";

const rows: StateOfficialRow[] = [
  { id: "g", name: "Greg Governor", govChamber: "executive", govDistrict: "", govOffice: "Governor" },
  { id: "s27", name: "Sam Senator", govChamber: "upper", govDistrict: "27", govOffice: "State senator" },
  { id: "s28", name: "Wrong Senator", govChamber: "upper", govDistrict: "28", govOffice: "State senator" },
  { id: "r30", name: "Rae Rep", govChamber: "lower", govDistrict: "30", govOffice: "State representative" },
];

describe("districtKey", () => {
  it("normalizes Census and Open States district names", () => {
    expect(districtKey("State Senate District 027")).toBe("27");
    expect(districtKey("27")).toBe("27");
    expect(districtKey("Assembly District 12")).toBe("12");
    expect(districtKey("1st Middlesex District")).toBe(districtKey("1st Middlesex"));
  });
});

describe("selectStateOfficials", () => {
  it("keeps statewide offices and only the matching legislative districts", () => {
    const officials = selectStateOfficials(rows, {
      stateCode: "TX",
      stateName: "Texas",
      stateUpperDistrict: "State Senate District 27",
      stateLowerDistrict: "State House District 30",
    });
    expect(officials.map((o) => o.name)).toEqual(["Greg Governor", "Sam Senator", "Rae Rep"]);
    expect(officials.find((o) => o.name === "Sam Senator")?.office).toBe("State senator");
  });
});
