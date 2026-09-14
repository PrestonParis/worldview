import { describe, expect, it } from "vitest";
import { projectChamber, type RatedRace } from "./control";

const race = (over: Partial<RatedRace> = {}): RatedRace => ({
  heldParty: "R",
  openSeat: false,
  rating: null,
  ...over,
});

describe("projectChamber (Senate 2026 shape)", () => {
  // 33 class-2 seats up: 13 D-held, 20 R-held. Not up: 34 D+I, 33 R.
  const baseline = { D: 32, R: 33, I: 2 };

  it("with everything rated safe-for-incumbent, projection = current", () => {
    const races: RatedRace[] = [
      ...Array.from({ length: 13 }, () => race({ heldParty: "D" })),
      ...Array.from({ length: 20 }, () => race({ heldParty: "R" })),
    ];
    const p = projectChamber("senate", races, baseline, 51);
    expect(p.current).toEqual({ D: 45, R: 53, I: 2 });
    expect(p.projected).toEqual({ D: 45, R: 53, I: 2, tossup: 0 });
    expect(p.projectedControl).toBe("R");
  });

  it("counts rating-implied flips and leaves tossups uncalled", () => {
    const races: RatedRace[] = [
      ...Array.from({ length: 12 }, () => race({ heldParty: "D", rating: "safe_d" })),
      race({ heldParty: "D", rating: "tossup" }), // a D-held tossup
      ...Array.from({ length: 17 }, () => race({ heldParty: "R", rating: "safe_r" })),
      race({ heldParty: "R", rating: "lean_d" }), // R-held seat leaning D → flip
      race({ heldParty: "R", rating: "tossup" }),
      race({ heldParty: "R", rating: "tossup" }),
    ];
    const p = projectChamber("senate", races, baseline, 51);
    // D: 32 base + 12 safe_d + 1 flip = 45 ; R: 33 base + 17 = 50 ; tossup 3
    expect(p.projected).toEqual({ D: 45, R: 50, I: 2, tossup: 3 });
    // neither side has 51 with 3 tossups out
    expect(p.projectedControl).toBeNull();
    expect(p.currentControl).toBe("R");
  });

  it("safe_i seats go to the independent bucket", () => {
    const p = projectChamber(
      "senate",
      [race({ heldParty: "I", rating: "safe_i" })],
      { D: 0, R: 0, I: 0 },
      51,
    );
    expect(p.projected.I).toBe(1);
    expect(p.current.I).toBe(1);
  });

  it("an open seat with no rating is a tossup, not a giveaway", () => {
    const p = projectChamber(
      "senate",
      [race({ heldParty: "R", openSeat: true, rating: null })],
      { D: 0, R: 0, I: 0 },
      51,
    );
    // 'null' rating falls back to safe-for-held-party, so R keeps it —
    // an open seat only becomes a tossup when a rating says so.
    expect(p.projected.R).toBe(1);
    expect(p.current.R).toBe(1);
  });
});
