import { describe, expect, it } from "vitest";
import { logDomain, otherOf, placeLabels, valueOf, type FlowCandidate } from "./money-flow-model";

const candidate: FlowCandidate = {
  id: "candidate-1",
  name: "Example Candidate",
  party: "REP",
  state: "VA",
  office: "S",
  district: "",
  receipts: 100,
  disbursements: 40,
  cashOnHand: 60,
  individual: 50,
  pac: 20,
  party_: 10,
};

describe("money flow model", () => {
  it("assigns unclassified receipts to other", () => {
    expect(otherOf(candidate)).toBe(20);
  });

  it("splits receipts across the four sources", () => {
    const sum = (["individual", "pac", "party_", "other"] as const).reduce((s, k) => s + valueOf(candidate, k), 0);
    expect(sum).toBe(candidate.receipts);
  });
});

describe("scatter helpers", () => {
  it("starts at a power of ten and ends just past the max", () => {
    expect(logDomain(4_200, 128_000_000)).toEqual({
      lo: 1_000,
      hi: 160_000_000,
      ticks: [1e3, 1e4, 1e5, 1e6, 1e7, 1e8],
    });
  });

  it("skips overlapping labels and flips at the right edge", () => {
    const labels = placeLabels(
      [
        { id: "a", x: 100, y: 50, text: "Alpha" },
        { id: "b", x: 102, y: 54, text: "Beta" },
        { id: "c", x: 490, y: 200, text: "Gamma" },
      ],
      { left: 0, right: 500 },
      5,
    );
    expect(labels.map((l) => l.id)).toEqual(["a", "c"]);
    expect(labels[1].anchor).toBe("end");
  });
});
