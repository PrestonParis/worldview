import type { CensusGeography, GovernmentDistrict } from "./types";
import { matchedAddressError } from "./address";

export const CENSUS_GEOCODER_SOURCE =
  "https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html";

type CensusArea = Record<string, unknown>;

interface CensusMatch {
  matchedAddress?: string;
  coordinates?: { x?: number; y?: number };
  geographies?: Record<string, CensusArea[]>;
}

interface CensusResponse {
  result?: {
    addressMatches?: CensusMatch[];
  };
}

interface CensusCoordinatesResponse {
  result?: {
    geographies?: Record<string, CensusArea[]>;
  };
}

const GEOGRAPHY_PARAMS = {
  benchmark: "Public_AR_Current",
  vintage: "Current_Current",
  layers: "all",
  format: "json",
};

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function areasMatching(
  geographies: Record<string, CensusArea[]>,
  pattern: RegExp,
): Array<[string, CensusArea]> {
  return Object.entries(geographies).flatMap(([key, areas]) =>
    pattern.test(key) && Array.isArray(areas) ? areas.map((area) => [key, area] as [string, CensusArea]) : [],
  );
}

function firstArea(geographies: Record<string, CensusArea[]>, pattern: RegExp): CensusArea {
  return areasMatching(geographies, pattern)[0]?.[1] ?? {};
}

function areaName(area: CensusArea): string {
  return text(area.NAME) || text(area.BASENAME) || text(area.NAME_FUNC);
}

function district(kind: string, area: CensusArea): GovernmentDistrict | null {
  const name = areaName(area);
  if (!name) return null;
  return { kind, name, geoid: text(area.GEOID) || text(area.GEOIDFQ) };
}

export function parseCensusGeography(payload: CensusResponse): CensusGeography {
  return geographyFromMatch(payload.result?.addressMatches?.[0]);
}

function geographyFromMatch(match: CensusMatch | undefined): CensusGeography {
  if (!match?.matchedAddress || !match.geographies) {
    throw new Error("We could not match that address. Include the street, city, state, and ZIP code.");
  }

  const geographies = match.geographies;
  const state = firstArea(geographies, /^States$/i);
  const county = firstArea(geographies, /^Counties$/i);
  const place = firstArea(geographies, /^(Incorporated Places|Census Designated Places)$/i);
  const congress = firstArea(geographies, /Congressional Districts/i);
  const upper = firstArea(geographies, /State Legislative Districts.*Upper/i);
  const lower = firstArea(geographies, /State Legislative Districts.*Lower/i);
  const schoolAreas = areasMatching(geographies, /School Districts/i);
  const congressionalName = areaName(congress);
  const congressionalCode = text(congress.CD119) || text(congress.CD118) || text(congress.CD) || text(congress.BASENAME);

  const stateCode = text(state.STUSAB);
  if (!stateCode) throw new Error("The matched address is not in a supported U.S. state or territory.");

  const schoolDistricts = schoolAreas.map(([key, area]) => ({
    kind: key.replace(/s$/i, ""),
    name: areaName(area),
    geoid: text(area.GEOID) || text(area.GEOIDFQ),
  })).filter((item) => item.name);

  const districts = [
    district("State", state),
    district("County", county),
    district("Place", place),
    district("U.S. House", congress),
    district("State Senate", upper),
    district("State House", lower),
    ...schoolDistricts,
  ].filter((item): item is GovernmentDistrict => Boolean(item));

  return {
    matchedAddress: match.matchedAddress,
    stateCode,
    stateName: areaName(state),
    countyName: areaName(county),
    countyGeoid: text(county.GEOID),
    placeName: areaName(place),
    placeGeoid: text(place.GEOID),
    longitude: Number(match.coordinates?.x),
    latitude: Number(match.coordinates?.y),
    congressionalDistrict: /at.?large|delegate/i.test(congressionalName) || Number(congressionalCode) >= 90
      ? "0"
      : congressionalCode,
    stateUpperDistrict: areaName(upper) || text(upper.SLDU) || text(upper.BASENAME),
    stateLowerDistrict: areaName(lower) || text(lower.SLDL) || text(lower.BASENAME),
    schoolDistricts,
    districts,
  };
}

export async function geocodeAddress(address: string): Promise<CensusGeography> {
  const url = new URL("https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress");
  url.searchParams.set("address", address);
  for (const [key, value] of Object.entries(GEOGRAPHY_PARAMS)) url.searchParams.set(key, value);

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error("The Census address service is temporarily unavailable.");
  const geography = parseCensusGeography((await response.json()) as CensusResponse);
  const mismatch = matchedAddressError(address, geography.matchedAddress);
  if (mismatch) throw new Error(mismatch);
  return geography;
}

export async function geocodeCoordinates(
  matchedAddress: string,
  longitude: number,
  latitude: number,
): Promise<CensusGeography> {
  const url = new URL("https://geocoding.geo.census.gov/geocoder/geographies/coordinates");
  url.searchParams.set("x", String(longitude));
  url.searchParams.set("y", String(latitude));
  for (const [key, value] of Object.entries(GEOGRAPHY_PARAMS)) url.searchParams.set(key, value);

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error("The Census address service is temporarily unavailable.");
  const payload = (await response.json()) as CensusCoordinatesResponse;
  return geographyFromMatch({
    matchedAddress,
    coordinates: { x: longitude, y: latitude },
    geographies: payload.result?.geographies,
  });
}
