import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "../db/client";
import { elections, candidacies, raceRatings } from "../db/schema";
import {
  projectChamber,
  tallyChamber,
  type Chamber,
  type ChamberProjection,
  type ChamberResult,
  type ResultRace,
  type PartyCount,
  type Party,
  type RatedRace,
} from "./control";
import type { Rating } from "../validation/raceRating";
import context from "../../../data/elections/2026-context.json";
import { consensusRating, partyLetter, type RatingRow } from "./overview";

function officeToChamber(office: string): Chamber | null {
  if (office === "U.S. Senate") return "senate";
  if (office === "U.S. House") return "house";
  if (office === "Governor") return "governor";
  return null;
}


/**
 * Seats won in a cycle being counted: called races plus the seats not up, from
 * data/elections/2026-context.json. Empty for a cycle with no calls recorded,
 * so past cycles keep their own results view.
 */
export async function chamberResults(cycle: number): Promise<ChamberResult[]> {
  const races = await db
    .select({ id: elections.id, office: elections.office, callStatus: elections.callStatus, flipped: elections.flipped, asOf: elections.resultsAsOf })
    .from(elections)
    .where(and(eq(elections.cycle, cycle), isNotNull(elections.callStatus)));
  if (races.length === 0) return [];

  const winners = await db
    .select({ electionId: candidacies.electionId, party: candidacies.party })
    .from(candidacies)
    .where(and(inArray(candidacies.electionId, races.map((race) => race.id)), eq(candidacies.won, true)));
  const winnerParty = new Map(winners.map((row) => [row.electionId, partyLetter(row.party)]));

  const byChamber = new Map<Chamber, ResultRace[]>();
  let latest: Date | null = null;
  for (const race of races) {
    const chamber = officeToChamber(race.office);
    if (!chamber) continue;
    if (race.asOf && (!latest || race.asOf > latest)) latest = race.asOf;
    byChamber.set(chamber, [
      ...(byChamber.get(chamber) ?? []),
      { winnerParty: winnerParty.get(race.id) ?? null, called: race.callStatus === "called" && winnerParty.has(race.id), flipped: race.flipped },
    ]);
  }

  const baseline: Record<Chamber, PartyCount> = {
    senate: { D: context.senateBaseline.D, R: context.senateBaseline.R, I: context.senateBaseline.I },
    house: context.houseBaseline,
    governor: { D: context.governorBaseline.D, R: context.governorBaseline.R, I: context.governorBaseline.I },
  };
  const order: Chamber[] = ["senate", "house", "governor"];
  const asOf = (latest as Date | null)?.toISOString() ?? null;
  return order
    .filter((chamber) => byChamber.has(chamber))
    .map((chamber) =>
      tallyChamber(chamber, byChamber.get(chamber)!, baseline[chamber], context.majorities[chamber], {
        caucusing: chamber === "senate" ? context.independentsCaucusingWithDemocrats : 0,
        asOf,
      }),
    );
}

/**
 * Chamber-control projections for a cycle: pulls every scaffolded race, its
 * incumbent party, and its best available rating (a real handicapper source
 * beats the "inferred" fallback), then runs the pure `projectChamber` with
 * the hand-maintained baselines in data/elections/2026-context.json.
 */
export async function chamberProjections(
  cycle: number,
): Promise<ChamberProjection[]> {
  const races = await db
    .select({
      id: elections.id,
      office: elections.office,
      openSeat: elections.openSeat,
    })
    .from(elections)
    .where(eq(elections.cycle, cycle));

  if (races.length === 0) return [];
  const ids = races.map((r) => r.id);

  const incRows = await db
    .select({ electionId: candidacies.electionId, party: candidacies.party })
    .from(candidacies)
    .where(and(inArray(candidacies.electionId, ids), eq(candidacies.incumbent, true)));
  const heldParty = new Map<string, Party | null>();
  for (const r of incRows) heldParty.set(r.electionId, partyLetter(r.party));

  const ratingRows = await db
    .select({
      electionId: raceRatings.electionId,
      source: raceRatings.source,
      rating: raceRatings.rating,
      asOf: raceRatings.asOf,
    })
    .from(raceRatings)
    .where(inArray(raceRatings.electionId, ids));
  // One rating per race: the handicapper consensus (overview.ts).
  const rowsByRace = new Map<string, RatingRow[]>();
  for (const r of ratingRows) {
    const list = rowsByRace.get(r.electionId) ?? [];
    list.push({ source: r.source, rating: r.rating as Rating, asOf: r.asOf });
    rowsByRace.set(r.electionId, list);
  }
  const bestRating = new Map<string, Rating>();
  for (const [id, rows] of rowsByRace) {
    const consensus = consensusRating(rows);
    if (consensus) bestRating.set(id, consensus.rating);
  }

  const byChamber = new Map<Chamber, RatedRace[]>();
  for (const race of races) {
    const chamber = officeToChamber(race.office);
    if (!chamber) continue;
    const list = byChamber.get(chamber) ?? [];
    list.push({
      heldParty: heldParty.get(race.id) ?? null,
      openSeat: race.openSeat,
      rating: bestRating.get(race.id) ?? null,
    });
    byChamber.set(chamber, list);
  }

  const baseline: Record<Chamber, PartyCount> = {
    senate: context.senateBaseline,
    house: context.houseBaseline,
    governor: {
      D: context.governorBaseline.D,
      R: context.governorBaseline.R,
      I: context.governorBaseline.I,
    },
  };
  const majority: Record<Chamber, number> = {
    senate: context.majorities.senate,
    house: context.majorities.house,
    governor: context.majorities.governor,
  };

  const order: Chamber[] = ["senate", "house", "governor"];
  return order
    .filter((c) => byChamber.has(c))
    .map((c) => projectChamber(c, byChamber.get(c)!, baseline[c], majority[c]));
}
