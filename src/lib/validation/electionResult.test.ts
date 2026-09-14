import { describe, expect, it } from "vitest";
import {
  areaBreakdowns,
  type ResultRow,
} from "./electionResult";

function row(over: Partial<ResultRow>): ResultRow {
  return {
    areaKind: "county",
    areaId: "00000",
    areaName: "Test County",
    candidacyId: "c",
    candidateEntityId: "e",
    party: "",
    votes: 0,
    ...over,
  };
}

describe("areaBreakdowns", () => {
  it("rolls each area up to a winner, margin, and share", () => {
    const rows = [
      row({ areaId: "01001", areaName: "Autauga", party: "Republican", candidacyId: "r", votes: 60 }),
      row({ areaId: "01001", areaName: "Autauga", party: "Democrat", candidacyId: "d", votes: 40 }),
      row({ areaId: "01003", areaName: "Baldwin", party: "Republican", candidacyId: "r", votes: 30 }),
      row({ areaId: "01003", areaName: "Baldwin", party: "Democrat", candidacyId: "d", votes: 70 }),
    ];
    const out = areaBreakdowns(rows).sort((a, b) => a.areaId.localeCompare(b.areaId));

    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      areaId: "01001",
      areaName: "Autauga",
      total: 100,
      leaderParty: "Republican",
      leaderCandidacyId: "r",
      leaderVotes: 60,
      runnerUpVotes: 40,
      margin: 20,
    });
    expect(out[0].marginPct).toBeCloseTo(20);
    expect(out[1]).toMatchObject({ leaderParty: "Democrat", margin: 40 });
  });

  it("handles a single-candidate area without dividing by zero", () => {
    const [b] = areaBreakdowns([row({ areaId: "x", party: "Democrat", votes: 10 })]);
    expect(b.margin).toBe(10);
    expect(b.runnerUpVotes).toBe(0);
    expect(b.marginPct).toBeCloseTo(100);
  });

  it("returns nothing for no rows", () => {
    expect(areaBreakdowns([])).toEqual([]);
  });
});
