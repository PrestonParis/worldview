import { describe, expect, it } from "vitest";
import { describeCommittee, describePerson, describeTerms, isProvenanceDescription, partyAdjective } from "./describe.mjs";

const TODAY = "2026-10-30";

describe("describeTerms", () => {
  it("describes a former member across both chambers", () => {
    const terms = [
      { type: "rep", start: "1971-01-21", end: "1973-01-03", party: "Democrat", state: "SD", district: 2 },
      { type: "sen", start: "1973-01-03", end: "1979-01-03", party: "Democrat", state: "SD", district: null },
    ];
    expect(describeTerms(terms, TODAY)).toBe("Former Democratic U.S. representative and senator from South Dakota (1971–1979)");
  });

  it("describes a sitting House member with the district and first year", () => {
    const terms = [
      { type: "rep", start: "2013-01-03", end: "2015-01-03", party: "Republican", state: "KY", district: 4 },
      { type: "rep", start: "2025-01-03", end: "2027-01-03", party: "Republican", state: "KY", district: 4 },
    ];
    expect(describeTerms(terms, TODAY)).toBe("Republican U.S. representative from Kentucky (4th district) since 2013");
  });
});

describe("describePerson", () => {
  it("leads with an executive office and adds the latest race", () => {
    const text = describePerson({
      metadata: { branch: "executive", office: "Vice President", party: "Republican" },
      candidacies: [{ office: "U.S. Senate", jurisdiction: "Ohio", year: 2022, party: "Republican", won: true }],
      today: TODAY,
    });
    expect(text).toBe("Vice President of the United States; elected to the U.S. Senate in Ohio (2022).");
  });

  it("describes a losing candidate", () => {
    const text = describePerson({ candidacies: [{ office: "U.S. Senate", jurisdiction: "Kansas", year: 2020, party: "Democrat", won: false }] });
    expect(text).toBe("Democratic candidate for U.S. Senate in Kansas (2020).");
  });

  it("names a House district", () => {
    const text = describePerson({ candidacies: [{ office: "U.S. House", jurisdiction: "KY-04", year: 2026, party: "Republican" }] });
    expect(text).toBe("Republican candidate for U.S. House, Kentucky's 4th district (2026).");
  });

  it("reads presidential wins nationally, not per state", () => {
    const state = (jurisdiction, won, party, year) => ({ office: "President", jurisdiction, won, party, year });
    expect(describePerson({ candidacies: [state("Hawaii", true, "Democrat", 2012), state("Alabama", false, "Democrat", 2012)] })).toBe(
      "Elected President (2012).",
    );
    expect(describePerson({ candidacies: [state("California", true, "Democrat", 2024)] })).toBe("Democratic candidate for President (2024).");
  });

  it("falls back to the FEC candidate id", () => {
    const text = describePerson({ metadata: { fecCandidateId: "S6ID00161", party: "REPUBLICAN PARTY" } });
    expect(text).toBe("Republican candidate for U.S. Senate in Idaho.");
  });

  it("returns empty when nothing is known", () => {
    expect(describePerson({ metadata: { source: "medsl" } })).toBe("");
  });
});

describe("helpers", () => {
  it("normalizes parties", () => {
    expect(partyAdjective("REPUBLICAN PARTY")).toBe("Republican");
    expect(partyAdjective("Democrat")).toBe("Democratic");
    expect(partyAdjective("Constitution")).toBe("");
  });

  it("recognizes importer notes", () => {
    expect(isProvenanceDescription("2026 candidate — imported by scaffold-cycle.")).toBe(true);
    expect(isProvenanceDescription("Election candidate — imported from MIT Election Lab.")).toBe(true);
    expect(isProvenanceDescription("Secretary of Defense")).toBe(false);
  });

  it("describes committees", () => {
    expect(describeCommittee("C00004036")).toBe("Federal political committee (FEC C00004036).");
    expect(describeCommittee(null)).toBe("Organization recorded as a contributor in FEC filings.");
  });
});
