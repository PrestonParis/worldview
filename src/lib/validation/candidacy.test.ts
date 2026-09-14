import { describe, expect, it } from "vitest";
import { summarizeCandidacies, type Candidacy } from "./candidacy";

function candidacy(overrides: Partial<Candidacy> = {}): Candidacy {
  return {
    id: crypto.randomUUID(),
    electionId: "00000000-0000-0000-0000-000000000000",
    candidateEntityId: crypto.randomUUID(),
    party: "",
    incumbent: false,
    withdrew: false,
    votes: null,
    won: false,
    status: "",
    fecCandidateId: "",
    externalId: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("summarizeCandidacies", () => {
  it("returns a non-reporting summary when no candidacy has a vote count", () => {
    const s = summarizeCandidacies([
      candidacy({ party: "Republican" }),
      candidacy({ party: "Democratic" }),
    ]);
    expect(s.reporting).toBe(false);
    expect(s.candidateCount).toBe(2);
    expect(s.totalVotes).toBe(0);
    expect(s.leaderEntityId).toBeNull();
    expect(s.margin).toBeNull();
    expect(s.marginPct).toBeNull();
  });

  it("picks the vote leader and computes the margin over the runner-up", () => {
    const winner = candidacy({ candidateEntityId: "w", party: "Republican", votes: 60 });
    const second = candidacy({ candidateEntityId: "r", party: "Democratic", votes: 40 });
    const third = candidacy({ candidateEntityId: "t", party: "Green", votes: 10 });
    const s = summarizeCandidacies([second, third, winner]);

    expect(s.reporting).toBe(true);
    expect(s.totalVotes).toBe(110);
    expect(s.leaderEntityId).toBe("w");
    expect(s.leaderParty).toBe("Republican");
    expect(s.margin).toBe(20);
    expect(s.marginPct).toBeCloseTo((20 / 110) * 100);
  });

  it("reports the flagged winner separately from the vote leader", () => {
    // Popular-vote leader loses; another candidacy carries the `won` flag.
    const popularLeader = candidacy({ candidateEntityId: "pop", party: "Democratic", votes: 51 });
    const declaredWinner = candidacy({
      candidateEntityId: "ec",
      party: "Republican",
      votes: 49,
      won: true,
    });
    const s = summarizeCandidacies([popularLeader, declaredWinner]);

    expect(s.leaderEntityId).toBe("pop");
    expect(s.winnerEntityId).toBe("ec");
    expect(s.winnerParty).toBe("Republican");
    expect(s.margin).toBe(2);
  });

  it("ignores candidacies with no vote count when ranking", () => {
    const counted = candidacy({ candidateEntityId: "a", votes: 100 });
    const uncounted = candidacy({ candidateEntityId: "b", votes: null });
    const s = summarizeCandidacies([uncounted, counted]);

    expect(s.leaderEntityId).toBe("a");
    expect(s.margin).toBeNull(); // only one candidacy reports a count
    expect(s.totalVotes).toBe(100);
  });
});
