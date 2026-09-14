import { ratingWinner, type Rating } from "../validation/raceRating";

export type Chamber = "senate" | "house" | "governor";
export type Party = "D" | "R" | "I";

export interface RatedRace {
  // Party that currently holds the seat (even for an open seat).
  heldParty: Party | null;
  openSeat: boolean;
  // Latest handicapper rating; null falls back to "safe for the held party".
  rating: Rating | null;
}

export interface PartyCount {
  D: number;
  R: number;
  I: number;
}

export interface ChamberProjection {
  chamber: Chamber;
  seatsUp: number;
  majority: number;
  // Held going into the election (seats not up + current holders of seats up).
  current: PartyCount;
  // Rating-implied outcome; `tossup` holds the still-uncalled seats.
  projected: PartyCount & { tossup: number };
  // Who reaches `majority` in the projection, or null if tossups leave it open.
  projectedControl: Party | null;
  currentControl: Party | null;
}

function empty(): PartyCount & { tossup: number } {
  return { D: 0, R: 0, I: 0, tossup: 0 };
}

function control(c: PartyCount, majority: number): Party | null {
  if (c.D >= majority) return "D";
  if (c.R >= majority) return "R";
  if (c.I >= majority) return "I";
  return null;
}

const impliedSafe: Record<Party, Rating> = {
  D: "safe_d",
  R: "safe_r",
  I: "safe_i",
};

/**
 * Project a chamber from its rated races plus the seats not on the ballot.
 * Pure: no I/O, deterministic. `baseline` is the party split of seats NOT up
 * this cycle; `majority` is the number of seats needed to control (51 Senate,
 * 218 House; for governors pass a nominal half+1 for the control label).
 */
export function projectChamber(
  chamber: Chamber,
  races: RatedRace[],
  baseline: PartyCount,
  majority: number,
): ChamberProjection {
  const current: PartyCount = { ...baseline };
  const projected = { ...empty(), D: baseline.D, R: baseline.R, I: baseline.I };

  for (const race of races) {
    if (race.heldParty) current[race.heldParty] += 1;

    const rating = race.rating ?? (race.heldParty ? impliedSafe[race.heldParty] : null);
    const winner = rating ? ratingWinner(rating) : "tossup";
    if (winner === "tossup") projected.tossup += 1;
    else projected[winner] += 1;
  }

  return {
    chamber,
    seatsUp: races.length,
    majority,
    current,
    projected,
    projectedControl: control(projected, majority),
    currentControl: control(current, majority),
  };
}
