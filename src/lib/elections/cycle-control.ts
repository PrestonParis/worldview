import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { elections, candidacies, raceRatings } from "../db/schema";
import {
  projectChamber,
  type Chamber,
  type ChamberProjection,
  type PartyCount,
  type Party,
  type RatedRace,
} from "./control";
import type { Rating } from "../validation/raceRating";
import context from "../../../data/elections/2026-context.json";

function officeToChamber(office: string): Chamber | null {
  if (office === "U.S. Senate") return "senate";
  if (office === "U.S. House") return "house";
  if (office === "Governor") return "governor";
  return null;
}

function partyLetter(party: string | null): Party | null {
  if (!party) return null;
  const p = party.trim().toLowerCase();
  if (p.startsWith("d")) return "D";
  if (p.startsWith("r") || p === "gop") return "R";
  if (p.startsWith("i") || p.includes("independent")) return "I";
  return null;
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
  // best rating per race: prefer a non-"inferred" source, then most recent
  const bestRating = new Map<string, Rating>();
  const bestScore = new Map<string, number>();
  for (const r of ratingRows) {
    const score =
      (r.source === "inferred" ? 0 : 1_000_000_000_000) + r.asOf.getTime();
    if (score > (bestScore.get(r.electionId) ?? -1)) {
      bestScore.set(r.electionId, score);
      bestRating.set(r.electionId, r.rating as Rating);
    }
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
