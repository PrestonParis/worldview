import { describe, expect, it } from "vitest";
import { selectFederalOfficials, type Legislator } from "./federal";

const roster: Legislator[] = [
  {
    id: { bioguide: "S000001" },
    name: { official_full: "Alex Senator" },
    terms: [{ type: "sen", state: "VA", party: "Independent", end: "2031-01-03" }],
  },
  {
    id: { bioguide: "R000001" },
    name: { official_full: "Riley Representative" },
    terms: [{ type: "rep", state: "VA", district: 11, party: "Republican", end: "2027-01-03" }],
  },
  {
    id: { bioguide: "R000002" },
    name: { official_full: "Wrong District" },
    terms: [{ type: "rep", state: "VA", district: 10, party: "Democrat", end: "2027-01-03" }],
  },
];

describe("selectFederalOfficials", () => {
  it("returns both senators and only the matching House district", () => {
    const officials = selectFederalOfficials(roster, {
      stateCode: "VA",
      stateName: "Virginia",
      congressionalDistrict: "11",
    });

    expect(officials.map((item) => item.name)).toEqual([
      "Alex Senator",
      "Riley Representative",
    ]);
    expect(officials.every((item) => item.status === "verified")).toBe(true);
  });
});
