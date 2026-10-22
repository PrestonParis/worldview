import { describe, expect, it } from "vitest";
import { houseCode, placeLabel } from "./lookup";
import { isMyRace, myOfficialFor, parseSavedGovernment, toSavedGovernment, type SavedGovernment } from "./saved";
import type { GovernmentLookupResult } from "./types";

const result: GovernmentLookupResult = {
  matchedAddress: "123 MAIN ST, ANN ARBOR, MI, 48104",
  place: "Ann Arbor, MI",
  stateCode: "MI",
  stateName: "Michigan",
  houseCode: "MI-06",
  districts: [{ kind: "U.S. House", name: "Congressional District 6", geoid: "2606" }],
  officials: [
    {
      id: "federal-D000624",
      office: "U.S. Representative",
      level: "federal",
      jurisdiction: "MI-6",
      name: "Debbie Dingell",
      bioguideId: "D000624",
      status: "verified",
      sourceLabel: "Congress Legislators",
      sourceUrl: "https://example.org",
    },
    {
      id: "state-abc",
      office: "State senator",
      level: "state",
      jurisdiction: "District 15",
      name: "Jeff Irwin",
      entityId: "abc",
      status: "verified",
      sourceLabel: "Open States",
      sourceUrl: "https://example.org",
    },
  ],
  sources: [{ label: "Census", url: "https://example.org" }],
  coverage: { resolved: 2, total: 2, localProviderConnected: false, gaps: [] },
};

describe("toSavedGovernment", () => {
  it("keeps districts and officials but never the street address", () => {
    const saved = toSavedGovernment(result);
    expect(JSON.stringify(saved)).not.toContain("MAIN ST");
    expect(saved.place).toBe("Ann Arbor, MI");
    expect(parseSavedGovernment(saved)).toEqual(saved);
  });

  it("rejects malformed stored values", () => {
    expect(parseSavedGovernment(null)).toBeNull();
    expect(parseSavedGovernment({ ...toSavedGovernment(result), houseCode: "Michigan 6" })).toBeNull();
  });
});

describe("isMyRace", () => {
  const saved: SavedGovernment = toSavedGovernment(result);
  it("matches the state, the House district, and the national race", () => {
    expect(isMyRace("MI", saved)).toBe(true);
    expect(isMyRace("MI-06", saved)).toBe(true);
    expect(isMyRace("US", saved)).toBe(true);
  });
  it("skips other districts and states", () => {
    expect(isMyRace("MI-07", saved)).toBe(false);
    expect(isMyRace("OH", saved)).toBe(false);
    expect(isMyRace("MI", null)).toBe(false);
  });
});

describe("myOfficialFor", () => {
  const saved = toSavedGovernment(result);
  it("matches by bioguide id or graph id", () => {
    expect(myOfficialFor({ id: "zzz", bioguideId: "D000624" }, saved)?.name).toBe("Debbie Dingell");
    expect(myOfficialFor({ id: "abc" }, saved)?.office).toBe("State senator");
    expect(myOfficialFor({ id: "zzz", bioguideId: "" }, saved)).toBeNull();
  });
});

describe("houseCode / placeLabel", () => {
  it("formats Census districts as election race codes", () => {
    expect(houseCode({ stateCode: "MI", congressionalDistrict: "06" })).toBe("MI-06");
    expect(houseCode({ stateCode: "AK", congressionalDistrict: "0" })).toBe("AK-AL");
    expect(houseCode({ stateCode: "MI", congressionalDistrict: "" })).toBeNull();
  });
  it("drops the Census place type and falls back from place to county to state", () => {
    expect(placeLabel({ placeName: "Ann Arbor city", countyName: "Washtenaw County", stateCode: "MI" })).toBe("Ann Arbor, MI");
    expect(placeLabel({ placeName: "", countyName: "Hall County", stateCode: "GA" })).toBe("Hall County, GA");
    expect(placeLabel({ placeName: "", countyName: "", stateCode: "GA" })).toBe("GA");
  });
});
