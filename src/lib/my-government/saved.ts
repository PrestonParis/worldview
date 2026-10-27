import { z } from "zod";
import type { GovernmentLookupResult } from "./types";

// A My Government result the visitor chose to keep, so the rest of the site
// can point out their races and officials. Everything but the street
// address: `place` stands in for it. Kept in the browser and, for signed-in
// accounts, in saved_governments. Safe on the client.

const levelSchema = z.enum(["local", "county", "state", "federal", "courts"]);
const short = z.string().max(300);

const officialSchema = z.object({
  id: short,
  office: short,
  level: levelSchema,
  jurisdiction: short,
  name: short.nullable(),
  party: short.optional(),
  phone: short.optional(),
  website: z.string().max(1000).optional(),
  bioguideId: short.optional(),
  entityId: short.optional(),
  status: z.enum(["verified", "district-only"]),
  sourceLabel: short,
  sourceUrl: z.string().max(1000),
});

export const savedGovernmentSchema = z.object({
  place: short,
  stateCode: z.string().regex(/^[A-Z]{2}$/),
  stateName: short,
  houseCode: z.string().regex(/^[A-Z]{2}-(\d{2}|AL)$/).nullable(),
  districts: z.array(z.object({ kind: short, name: short, geoid: short })).max(60),
  officials: z.array(officialSchema).max(120),
  sources: z.array(z.object({ label: short, url: z.string().max(1000) })).max(20),
  coverage: z.object({
    resolved: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    localProviderConnected: z.boolean(),
    gaps: z.array(z.object({ office: short, jurisdiction: short, level: levelSchema })).max(120),
  }),
  savedAt: z.string().max(40),
});

export type SavedGovernment = z.infer<typeof savedGovernmentSchema>;

export function toSavedGovernment(result: GovernmentLookupResult): SavedGovernment {
  // Picked field by field so matchedAddress can't ride along.
  return {
    place: result.place,
    stateCode: result.stateCode,
    stateName: result.stateName,
    houseCode: result.houseCode,
    districts: result.districts,
    officials: result.officials,
    sources: result.sources,
    coverage: result.coverage,
    savedAt: new Date().toISOString(),
  };
}

// The saved result in the lookup page's shape, the place shown as the address.
export function savedAsLookup(saved: SavedGovernment): GovernmentLookupResult {
  return { ...saved, matchedAddress: saved.place };
}

export function parseSavedGovernment(value: unknown): SavedGovernment | null {
  const parsed = savedGovernmentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// Whether a race (by elections race code: "US", "MI", "MI-06") is on the
// saved address's ballot. Statewide races match the state; House races the
// district; the national presidential row matches everyone.
export function isMyRace(code: string, saved: SavedGovernment | null): boolean {
  if (!saved) return false;
  if (code === "US") return true;
  if (code.includes("-")) return code === saved.houseCode;
  return code === saved.stateCode;
}

// The saved official a person is, matched by graph id or bioguide id.
export function myOfficialFor(
  person: { id?: string | null; bioguideId?: string | null },
  saved: SavedGovernment | null,
) {
  if (!saved) return null;
  return (
    saved.officials.find(
      (official) =>
        (person.id && official.entityId === person.id) || (person.bioguideId && official.bioguideId === person.bioguideId),
    ) ?? null
  );
}
