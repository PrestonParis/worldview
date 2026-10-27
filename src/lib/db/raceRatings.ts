import { eq } from "drizzle-orm";
import { db } from "./client";
import { raceRatings } from "./schema";
import type { RaceRating, RaceRatingInput } from "../validation/raceRating";

function toRaceRating(row: typeof raceRatings.$inferSelect): RaceRating {
  return {
    id: row.id,
    electionId: row.electionId,
    source: row.source,
    rating: row.rating,
    asOf: row.asOf.toISOString(),
    url: row.url ?? "",
    notes: row.notes ?? "",
    externalId: row.externalId ?? "",
    createdAt: row.createdAt.toISOString(),
  };
}

function toRow(input: RaceRatingInput) {
  return {
    electionId: input.electionId,
    source: input.source,
    rating: input.rating,
    asOf: new Date(input.asOf),
    url: input.url || null,
    notes: input.notes || null,
  };
}

// Every rating for one race, newest first — the detail-page history strip.
export async function ratingHistory(electionId: string): Promise<RaceRating[]> {
  const rows = await db.query.raceRatings.findMany({
    where: eq(raceRatings.electionId, electionId),
    orderBy: (r, { desc: d }) => [d(r.asOf)],
  });
  return rows.map(toRaceRating);
}

export async function createRaceRating(input: RaceRatingInput): Promise<RaceRating> {
  const [row] = await db.insert(raceRatings).values(toRow(input)).returning();
  return toRaceRating(row);
}

// Import path — one dated row per (election, source, asOf); re-running the
// same snapshot is a no-op, a new snapshot appends to the history.
export async function upsertRaceRatingByExternalId(
  externalId: string,
  input: RaceRatingInput,
): Promise<RaceRating> {
  const [row] = await db
    .insert(raceRatings)
    .values({ ...toRow(input), externalId })
    .onConflictDoUpdate({
      target: raceRatings.externalId,
      set: { rating: input.rating, url: input.url || null, notes: input.notes || null },
    })
    .returning();
  return toRaceRating(row);
}
