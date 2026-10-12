import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import { candidacies, elections, raceRatings } from "./schema";
import { getEntityNames } from "../neo4j/entities";
import {
  consensusRating,
  OFFICES,
  officeKeyFor,
  partyLetter,
  raceCode,
  type CycleSummary,
  type OfficeKey,
  type RaceSummary,
  type RatingRow,
  type SearchEntry,
} from "../elections/overview";
import { summarizeCandidacies, type Candidacy } from "../validation/candidacy";
import type { Rating } from "../validation/raceRating";
import { candidateIdentityKey, normalizeCandidateName, normalizePartyName } from "../elections/display";

// Server loaders for the /elections overview: which cycles and offices
// exist, and one cycle × office worth of races with rating, incumbent and
// result already resolved — so the page ships tens of rows, not 1,300.

// Major parties first (D, R, I), then everyone else.
const NOMINEE_ORDER = (party: string | null) => (party === "D" ? 0 : party === "R" ? 1 : party === "I" ? 2 : 3);

export async function listCycles(): Promise<CycleSummary[]> {
  const rows = await db
    .select({
      cycle: elections.cycle,
      office: elections.office,
      count: sql<number>`count(*)::int`,
      scheduled: sql<number>`count(*) filter (where ${elections.status} = 'scheduled')::int`,
    })
    .from(elections)
    .groupBy(elections.cycle, elections.office)
    .orderBy(desc(elections.cycle));

  const byCycle = new Map<number, CycleSummary>();
  for (const row of rows) {
    const key = officeKeyFor(row.office);
    if (row.cycle == null || !key) continue;
    const entry = byCycle.get(row.cycle) ?? { cycle: row.cycle, upcoming: false, offices: {} };
    entry.offices[key] = (entry.offices[key] ?? 0) + row.count;
    if (row.scheduled > 0) entry.upcoming = true;
    byCycle.set(row.cycle, entry);
  }
  return [...byCycle.values()].sort((a, b) => b.cycle - a.cycle);
}

export async function listSearchEntries(): Promise<SearchEntry[]> {
  const rows = await db
    .select({
      id: elections.id,
      name: elections.name,
      cycle: elections.cycle,
      office: elections.office,
      jurisdiction: elections.jurisdiction,
    })
    .from(elections)
    .orderBy(desc(elections.electionDate));
  return rows.map((row) => ({ ...row, cycle: row.cycle ?? 0 }));
}

export async function listRaces(cycle: number, officeKey: OfficeKey): Promise<RaceSummary[]> {
  const office = OFFICES.find((item) => item.key === officeKey)!.office;
  const races = await db
    .select()
    .from(elections)
    .where(and(eq(elections.cycle, cycle), eq(elections.office, office)));
  if (races.length === 0) return [];
  const ids = races.map((race) => race.id);

  const [candidacyRows, ratingRows] = await Promise.all([
    db.select().from(candidacies).where(inArray(candidacies.electionId, ids)),
    db
      .select({
        electionId: raceRatings.electionId,
        source: raceRatings.source,
        rating: raceRatings.rating,
        asOf: raceRatings.asOf,
      })
      .from(raceRatings)
      .where(inArray(raceRatings.electionId, ids)),
  ]);

  const ratingsByRace = new Map<string, RatingRow[]>();
  for (const row of ratingRows) {
    const list = ratingsByRace.get(row.electionId) ?? [];
    list.push({ source: row.source, rating: row.rating as Rating, asOf: row.asOf });
    ratingsByRace.set(row.electionId, list);
  }

  const byRace = new Map<string, Candidacy[]>();
  for (const row of candidacyRows) {
    const list = byRace.get(row.electionId) ?? [];
    list.push({
      id: row.id,
      electionId: row.electionId,
      candidateEntityId: row.candidateEntityId,
      party: row.party ?? "",
      incumbent: row.incumbent,
      withdrew: row.withdrew,
      votes: row.votes,
      won: row.won,
      status: row.status ?? "",
    } as Candidacy);
    byRace.set(row.electionId, list);
  }

  const names = await getEntityNames([...new Set(candidacyRows.map((row) => row.candidateEntityId))]);

  return races
    .map((race): RaceSummary => {
      const list = byRace.get(race.id) ?? [];
      // A race can carry more than one incumbent row (scaffold + FEC
      // filing); prefer the one on the ballot.
      const incumbent =
        list.find((c) => c.incumbent && c.status === "nominee") ?? list.find((c) => c.incumbent);
      const summary = list.length ? summarizeCandidacies(list) : null;
      const winnerId = summary?.winnerEntityId ?? (summary?.reporting ? summary.leaderEntityId : null);
      const winnerParty = summary?.winnerEntityId ? summary.winnerParty : summary?.leaderParty;
      const rating = consensusRating(ratingsByRace.get(race.id) ?? []);
      const nomineeMap = new Map<string, { name: string; party: ReturnType<typeof partyLetter>; partyLabel: string; incumbent: boolean }>();
      for (const candidacy of list.filter((item) => item.status === "nominee" && !item.withdrew)) {
        const name = normalizeCandidateName(names.get(candidacy.candidateEntityId) ?? "Unknown");
        const key = candidateIdentityKey(name);
        const existing = nomineeMap.get(key);
        if (!existing || candidacy.incumbent) {
          nomineeMap.set(key, {
            name,
            party: partyLetter(candidacy.party),
            partyLabel: normalizePartyName(candidacy.party),
            incumbent: candidacy.incumbent,
          });
        }
      }
      return {
        id: race.id,
        name: race.name,
        ...raceCode(race.jurisdiction),
        special: race.electionType === "special",
        openSeat: race.openSeat,
        status: race.status,
        date: race.electionDate.toISOString(),
        rating: rating?.rating ?? null,
        ratingPublished: rating?.published ?? false,
        ratings: rating?.ratings ?? [],
        incumbent: incumbent
          ? { name: normalizeCandidateName(names.get(incumbent.candidateEntityId) ?? "Unknown"), party: partyLetter(incumbent.party) }
          : null,
        nominees: [...nomineeMap.values()]
          .sort((a, b) => NOMINEE_ORDER(a.party) - NOMINEE_ORDER(b.party) || a.name.localeCompare(b.name)),
        result:
          winnerId && race.status !== "scheduled"
            ? {
                winnerName: normalizeCandidateName(names.get(winnerId) ?? "Unknown"),
                winnerParty: partyLetter(winnerParty ?? null),
                marginPct: summary?.marginPct ?? null,
              }
            : null,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code) || Number(a.special) - Number(b.special));
}
