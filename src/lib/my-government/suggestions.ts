import { z } from "zod";
import { matchedAddressError } from "./address";

const ARCGIS_SUGGEST_URL =
  "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest";
const ARCGIS_CANDIDATES_URL =
  "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";

// Rooftop / parcel-level and interpolated street matches. Anything coarser
// (street centroid, postal code, locality) cannot place a home in a district.
const ADDRESS_MATCH_TYPES = new Set(["PointAddress", "Subaddress", "StreetAddress", "StreetAddressExt"]);

const arcGisResponseSchema = z.object({
  suggestions: z.array(z.object({
    text: z.string(),
    magicKey: z.string(),
    isCollection: z.boolean().optional(),
  })).optional(),
  error: z.object({ message: z.string().optional() }).optional(),
});

const arcGisCandidatesSchema = z.object({
  candidates: z.array(z.object({
    address: z.string(),
    location: z.object({ x: z.number(), y: z.number() }),
    score: z.number(),
    attributes: z.object({ Addr_type: z.string().optional() }).optional(),
  })).optional(),
  error: z.object({ message: z.string().optional() }).optional(),
});

export interface ResolvedAddress {
  address: string;
  longitude: number;
  latitude: number;
}

export interface AddressSuggestion {
  text: string;
  magicKey: string;
}

export function parseAddressSuggestions(payload: unknown, query = ""): AddressSuggestion[] {
  const parsed = arcGisResponseSchema.safeParse(payload);
  if (!parsed.success || parsed.data.error) return [];

  const requestedNumber = query.trim().match(/^(\d+[A-Z]?)(?:\s|$)/i)?.[1]?.toUpperCase();
  const seen = new Set<string>();
  const suggestions: AddressSuggestion[] = [];
  for (const suggestion of parsed.data.suggestions ?? []) {
    const text = suggestion.text.trim();
    const key = text.toUpperCase();
    const suggestedNumber = text.match(/^(\d+[A-Z]?)(?:\s|$)/i)?.[1]?.toUpperCase();
    if (!text || suggestion.isCollection || seen.has(key)) continue;
    if (requestedNumber && suggestedNumber !== requestedNumber) continue;
    seen.add(key);
    suggestions.push({ text, magicKey: suggestion.magicKey });
  }
  return suggestions.slice(0, 6);
}

export async function suggestAddresses(query: string): Promise<AddressSuggestion[]> {
  const parameters = new URLSearchParams({
    text: query,
    countryCode: "USA",
    category: "Address",
    returnCollections: "false",
    maxSuggestions: "6",
    f: "json",
  });

  const response = await fetch(ARCGIS_SUGGEST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: parameters,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Address suggestions are temporarily unavailable.");

  const payload: unknown = await response.json();
  return parseAddressSuggestions(payload, query);
}

export function parseResolvedSuggestion(payload: unknown, selected: string): ResolvedAddress | null {
  const parsed = arcGisCandidatesSchema.safeParse(payload);
  if (!parsed.success || parsed.data.error) return null;

  const selectedNumber = selected.trim().match(/^(\d+[A-Z]?)(?:\s|$)/i)?.[1]?.toUpperCase();
  const candidate = parsed.data.candidates?.find((item) =>
    item.score >= 90
    && ADDRESS_MATCH_TYPES.has(item.attributes?.Addr_type ?? "")
    && item.address.trim().match(/^(\d+[A-Z]?)(?:\s|$)/i)?.[1]?.toUpperCase() === selectedNumber
    && !matchedAddressError(selected, item.address),
  );
  if (!candidate) return null;
  return { address: selected.replace(/,\s*USA$/i, ""), longitude: candidate.location.x, latitude: candidate.location.y };
}

// A selected suggestion already identifies one address point, so resolve it
// directly instead of re-geocoding its text, which can land on a different
// address range (e.g. ArcGIS "Piedmont Ave NE" vs. Census "Piedmont Ave SE").
// Complete free-typed addresses use the same resolver as a fallback when the
// Census address matcher changes a meaningful part of the street address.
export async function resolveSuggestion(text: string, magicKey?: string): Promise<ResolvedAddress> {
  const parameters = new URLSearchParams({
    SingleLine: text,
    outFields: "Addr_type",
    maxLocations: "1",
    f: "json",
  });
  if (magicKey) parameters.set("magicKey", magicKey);

  const response = await fetch(ARCGIS_CANDIDATES_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: parameters,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("The address service is temporarily unavailable.");

  const resolved = parseResolvedSuggestion(await response.json(), text);
  if (!resolved) throw new Error("That address could not be located precisely. Enter the full street address, city, state, and ZIP code.");
  return resolved;
}
