import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "./client";
import { aisVesselPositions } from "./schema";

export interface VesselPositionQuery {
  bbox: [number, number, number, number];
  updatedWithinMinutes: number;
  minimumSpeed: number;
  shipType?: number;
  limit: number;
}

export async function queryVesselPositions(query: VesselPositionQuery) {
  const [west, south, east, north] = query.bbox;
  const cutoff = new Date(Date.now() - query.updatedWithinMinutes * 60_000);
  return db
    .select()
    .from(aisVesselPositions)
    .where(and(
      gte(aisVesselPositions.latitude, south),
      lte(aisVesselPositions.latitude, north),
      west <= east
        ? and(gte(aisVesselPositions.longitude, west), lte(aisVesselPositions.longitude, east))
        : sql`(${aisVesselPositions.longitude} >= ${west} or ${aisVesselPositions.longitude} <= ${east})`,
      gte(aisVesselPositions.observedAt, cutoff),
      gte(aisVesselPositions.speedKnots, query.minimumSpeed),
      query.shipType === undefined ? undefined : eq(aisVesselPositions.shipType, query.shipType),
    ))
    .orderBy(sql`${aisVesselPositions.observedAt} desc`)
    .limit(query.limit);
}

export async function getAisIngestHealth() {
  const cutoff = new Date(Date.now() - 15 * 60_000);
  const [row] = await db.select({
    activeCount: sql<number>`count(*) filter (where ${aisVesselPositions.observedAt} >= ${cutoff})::int`,
    lastReceivedAt: sql<Date | null>`max(${aisVesselPositions.receivedAt})`,
  }).from(aisVesselPositions);
  const lastReceivedAt = row?.lastReceivedAt ?? null;
  const ageSeconds = lastReceivedAt ? Math.max(0, Math.round((Date.now() - lastReceivedAt.getTime()) / 1000)) : null;
  return {
    state: !lastReceivedAt ? "empty" : ageSeconds! <= 300 ? "healthy" : "stale",
    activeVessels: Number(row?.activeCount ?? 0),
    lastReceivedAt: lastReceivedAt?.toISOString() ?? null,
    ageSeconds,
  } as const;
}
