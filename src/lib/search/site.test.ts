import { describe, expect, it } from "vitest";
import { findState, normalizeQuery, resultOrder, searchSite, significantWords } from "./site";

describe("searchSite", () => {
  it("links a group + state query to the filtered demographics view", () => {
    const [first] = searchSite("Hispanic population in Texas");
    expect(first.label).toBe("Hispanic or Latino population in Texas");
    expect(first.href).toBe("/demographics?state=48&dim=race&group=hispanic");
  });

  it("opens religion views on the religion page", () => {
    const [first] = searchSite("Christians in Texas");
    expect(first.href).toBe("/religion?state=48&group=christian");
    expect(first.meta).toBe("Religion");
  });

  it("sends marriage and fertility terms to the family page", () => {
    expect(searchSite("divorce rate").map((r) => r.href)).toContain("/family");
  });

  it("sends budget terms to the spending page", () => {
    expect(searchSite("national debt").map((r) => r.href)).toContain("/spending");
  });

  it("sends diplomacy and sanctions terms to foreign policy", () => {
    expect(searchSite("diplomacy and sanctions").map((r) => r.href)).toContain("/foreign-policy");
  });

  it("reads an election year and office", () => {
    const [first] = searchSite("2024 presidential election");
    expect(first.label).toBe("2024 presidential election");
    expect(first.href).toBe("/elections?cycle=2024&office=president");
  });

  it("sends immigration terms to the immigration page", () => {
    expect(searchSite("H-1B immigration").map((r) => r.href)).toContain("/immigration");
  });

  it("returns a state's profile for a bare state name", () => {
    expect(searchSite("Ohio")[0].href).toBe("/states/ohio");
  });

  it("offers the state profile alongside a topic", () => {
    const hrefs = searchSite("crime in west virginia").map((r) => r.href);
    expect(hrefs[0]).toBe("/crime");
    expect(hrefs).toContain("/states/west-virginia");
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

describe("resultOrder", () => {
  it("puts people first for a bare name", () => {
    expect(resultOrder("nick", searchSite("nick"), ["Nick Fuentes"])[0]).toBe("entities");
  });

  it("puts people first for an exact name even when a topic matches", () => {
    expect(resultOrder("Ice Cube", searchSite("Ice Cube"), ["Ice Cube"])[0]).toBe("entities");
  });

  it("keeps pages first for topic queries", () => {
    expect(resultOrder("immigration", searchSite("immigration"), ["Immigration Reform Law Institute"])[0]).toBe("pages");
  });

  it("keeps pages first when nothing matched", () => {
    expect(resultOrder("zzz", [], [])[0]).toBe("pages");
  });
});
