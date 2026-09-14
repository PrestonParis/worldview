import { describe, it, expect } from "vitest";
import {
  normalizeParty,
  partyMajorityPosition,
  brokeWithParty,
  agreementRate,
  type MinimalVote,
} from "./votingRecord";

const v = (voterEntityId: string, position: MinimalVote["position"], party: string | null): MinimalVote => ({
  voterEntityId,
  position,
  party,
});

describe("normalizeParty", () => {
  it("folds spellings to a letter", () => {
    expect(normalizeParty("Republican")).toBe("R");
    expect(normalizeParty("R")).toBe("R");
    expect(normalizeParty("democrat")).toBe("D");
    expect(normalizeParty("Independent")).toBe("I");
    expect(normalizeParty("")).toBe("");
    expect(normalizeParty(null)).toBe("");
  });
});

describe("partyMajorityPosition", () => {
  const votes = [
    v("a", "yea", "D"),
    v("b", "yea", "D"),
    v("c", "nay", "D"),
    v("d", "nay", "R"),
    v("e", "nay", "R"),
    v("f", "present", "R"),
  ];
  it("returns the decisive majority per party", () => {
    expect(partyMajorityPosition(votes, "D")).toBe("yea");
    expect(partyMajorityPosition(votes, "Republican")).toBe("nay");
  });
  it("is null when a party is split evenly", () => {
    expect(partyMajorityPosition([v("a", "yea", "D"), v("b", "nay", "D")], "D")).toBeNull();
  });
  it("is null when a party cast no yea/nay", () => {
    expect(partyMajorityPosition([v("a", "present", "I")], "I")).toBeNull();
  });
});

describe("brokeWithParty", () => {
  const rollCall = [
    v("x", "yea", "R"),
    v("y", "yea", "R"),
    v("z", "yea", "R"),
    v("rebel", "nay", "R"),
    v("d1", "nay", "D"),
  ];
  it("flags a member voting against their party majority", () => {
    expect(brokeWithParty(v("rebel", "nay", "R"), rollCall)).toBe(true);
  });
  it("does not flag a member voting with their party", () => {
    expect(brokeWithParty(v("x", "yea", "R"), rollCall)).toBe(false);
  });
  it("does not flag present/absent", () => {
    expect(brokeWithParty(v("q", "present", "R"), rollCall)).toBe(false);
  });
});

describe("agreementRate", () => {
  it("scores only shared decisive roll calls", () => {
    const m = new Map<string, ["yea" | "nay" | "present" | "absent", "yea" | "nay" | "present" | "absent"]>([
      ["1", ["yea", "yea"]],
      ["2", ["yea", "nay"]],
      ["3", ["nay", "nay"]],
      ["4", ["yea", "absent"]], // ignored
      ["5", ["present", "yea"]], // ignored
    ]);
    expect(agreementRate(m)).toEqual({ shared: 3, agreed: 2, rate: 2 / 3 });
  });
  it("is zero-safe with no shared votes", () => {
    expect(agreementRate(new Map())).toEqual({ shared: 0, agreed: 0, rate: 0 });
  });
});
