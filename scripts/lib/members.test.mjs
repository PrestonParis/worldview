import { describe, it, expect } from "vitest";
import {
  congressWindow,
  termOverlapsWindow,
  servedInCongresses,
  latestRelevantTerm,
  chamberOf,
  displayName,
  normalizeNameTokens,
  nameLooksLikeMember,
  buildMemberMetadata,
} from "./members.mjs";

describe("congressWindow", () => {
  it("maps modern Congresses to their Jan 3 two-year window", () => {
    expect(congressWindow(118)).toEqual({ start: "2023-01-03", end: "2025-01-03" });
    expect(congressWindow(119)).toEqual({ start: "2025-01-03", end: "2027-01-03" });
  });
});

describe("termOverlapsWindow", () => {
  const w = congressWindow(118);
  it("includes a term that spans the window exactly", () => {
    expect(termOverlapsWindow({ start: "2023-01-03", end: "2025-01-03" }, w)).toBe(true);
  });
  it("excludes the prior term that ends when the window opens", () => {
    expect(termOverlapsWindow({ start: "2021-01-03", end: "2023-01-03" }, w)).toBe(false);
  });
  it("includes a six-year Senate term covering the window", () => {
    expect(termOverlapsWindow({ start: "2019-01-03", end: "2025-01-03" }, w)).toBe(true);
  });
  it("excludes a wholly future term", () => {
    expect(termOverlapsWindow({ start: "2025-01-03", end: "2027-01-03" }, w)).toBe(false);
  });
});

describe("servedInCongresses", () => {
  const terms = [
    { type: "rep", start: "2019-01-03", end: "2021-01-03" },
    { type: "rep", start: "2021-01-03", end: "2023-01-03" },
    { type: "rep", start: "2023-01-03", end: "2025-01-03" },
  ];
  it("is true when a term overlaps any requested Congress", () => {
    expect(servedInCongresses(terms, [118, 119])).toBe(true);
  });
  it("is false when no term overlaps", () => {
    expect(servedInCongresses(terms, [119])).toBe(false);
  });
  it("tolerates a missing terms array", () => {
    expect(servedInCongresses(undefined, [118])).toBe(false);
  });
});

describe("latestRelevantTerm", () => {
  const terms = [
    { type: "sen", start: "2013-01-03", end: "2019-01-03", party: "Republican" },
    { type: "sen", start: "2019-01-03", end: "2025-01-03", party: "Republican" },
  ];
  it("picks the most recent term overlapping the range", () => {
    expect(latestRelevantTerm(terms, [118]).start).toBe("2019-01-03");
  });
  it("falls back to the latest term overall when none overlap", () => {
    expect(latestRelevantTerm(terms, [105]).start).toBe("2019-01-03");
  });
  it("returns null for no terms", () => {
    expect(latestRelevantTerm([], [118])).toBeNull();
  });
});

describe("chamberOf", () => {
  it("maps term types to chamber names", () => {
    expect(chamberOf("sen")).toBe("Senate");
    expect(chamberOf("rep")).toBe("House");
    expect(chamberOf("prez")).toBe("");
  });
});

describe("displayName", () => {
  it("prefers official_full", () => {
    expect(
      displayName({ name: { official_full: "Alexandria Ocasio-Cortez", first: "Alexandria" } }),
    ).toBe("Alexandria Ocasio-Cortez");
  });
  it("assembles from parts when official_full is absent", () => {
    expect(displayName({ name: { first: "Bernard", last: "Sanders" } })).toBe("Bernard Sanders");
  });
});

describe("normalizeNameTokens", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeNameTokens("Robert P. Casey, Jr.")).toEqual(["robert", "p", "casey", "jr"]);
  });
});

describe("nameLooksLikeMember", () => {
  it("matches on shared first and last tokens", () => {
    expect(nameLooksLikeMember("Sen. Bernard Sanders", "Bernard Sanders")).toBe(true);
  });
  it("does not match on last name alone", () => {
    expect(nameLooksLikeMember("Jane Sanders", "Bernard Sanders")).toBe(false);
  });
  it("is false when a name is empty", () => {
    expect(nameLooksLikeMember("", "Bernard Sanders")).toBe(false);
  });
});

describe("buildMemberMetadata", () => {
  const legislator = {
    name: { official_full: "Maria Cantwell" },
    terms: [{ type: "sen", start: "2019-01-03", end: "2025-01-03", party: "Democrat", state: "WA" }],
  };
  it("stamps a source marker and the current party/state/chamber", () => {
    const md = buildMemberMetadata(legislator, [118, 119]);
    expect(md.source).toBe("unitedstates/congress-legislators");
    expect(md.party).toBe("Democrat");
    expect(md.state).toBe("WA");
    expect(md.chamber).toBe("Senate");
    expect(md.district).toBe("");
    expect(md.terms).toHaveLength(1);
  });
  it("records a House district as a string", () => {
    const rep = {
      name: { official_full: "Test Rep" },
      terms: [{ type: "rep", start: "2023-01-03", end: "2025-01-03", district: 3 }],
    };
    expect(buildMemberMetadata(rep, [118]).district).toBe("3");
  });
});
