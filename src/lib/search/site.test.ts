import { describe, expect, it } from "vitest";
import { findState, normalizeQuery, searchSite, significantWords } from "./site";

describe("searchSite", () => {
  it("links a group + state query to the filtered demographics view", () => {
    const [first] = searchSite("Hispanic population in Texas");
    expect(first.label).toBe("Hispanic or Latino population in Texas");
    expect(first.href).toBe("/demographics?state=48&dim=race&group=hispanic");
  });

  it("reads an election year and office", () => {
    const [first] = searchSite("2024 presidential election");
    expect(first.label).toBe("2024 presidential election");
    expect(first.href).toBe("/elections?cycle=2024&office=president");
  });

  it("sends immigration terms to the immigration page", () => {
    expect(searchSite("H-1B immigration").map((r) => r.href)).toContain("/immigration");
  });

  it("returns a state's population for a bare state name", () => {
    expect(searchSite("Ohio")[0].href).toBe("/demographics?state=39");
  });

  it("returns nothing for a person's name", () => {
    expect(searchSite("Nancy Mace")).toEqual([]);
  });

  it("does not read the White House as a race group", () => {
    expect(searchSite("white house").some((r) => r.href.includes("dim=race"))).toBe(false);
  });
});

describe("findState", () => {
  it("prefers the longer name", () => {
    expect(findState(normalizeQuery("crime in west virginia"))?.name).toBe("West Virginia");
  });

  it("ignores short words that look like postal codes", () => {
    expect(findState(normalizeQuery("crime in me"))).toBeNull();
    expect(findState(normalizeQuery("TX"))?.fips).toBe("48");
  });
});

describe("significantWords", () => {
  it("drops filler words", () => {
    expect(significantWords("Hispanic population in Texas")).toEqual(["hispanic", "population", "texas"]);
  });
});
