import { CENSUS_GEOCODER_SOURCE, geocodeAddress, geocodeCoordinates } from "./census";
import { CONGRESS_ROSTER_SOURCE, getFederalOfficials } from "./federal";
import { getLocalOfficials, HALL_COUNTY_GIS_SOURCE } from "./local";
import { OPEN_STATES_SOURCE, getStateOfficials } from "./state";
import { resolveSuggestion } from "./suggestions";
import type { CensusGeography, GovernmentLevel, GovernmentLookupResult, GovernmentOfficial } from "./types";

interface ProviderOfficial {
  id?: string;
  office?: string;
  level?: GovernmentLevel;
  jurisdiction?: string;
  name?: string;
  party?: string;
  phone?: string;
  website?: string;
  sourceLabel?: string;
  sourceUrl?: string;
}

function shell(
  id: string,
  office: string,
  level: GovernmentLevel,
  jurisdiction: string,
  sourceUrl: string,
): GovernmentOfficial {
  return {
    id,
    office,
    level,
    jurisdiction: jurisdiction || "District not returned",
    name: null,
    status: "district-only",
    sourceLabel: "U.S. Census Bureau district match",
    sourceUrl,
  };
}

export function buildOfficeShells(geo: CensusGeography): GovernmentOfficial[] {
  const schoolShells = geo.schoolDistricts.map((district, index) =>
    shell(`school-board-${index}`, "School board", "local", district.name, CENSUS_GEOCODER_SOURCE),
  );

  return [
    ...schoolShells,
    shell("mayor", "Mayor", "local", geo.placeName, CENSUS_GEOCODER_SOURCE),
    shell("city-council", "City council", "local", geo.placeName, CENSUS_GEOCODER_SOURCE),
    shell("county-commission", "County commission", "county", geo.countyName, CENSUS_GEOCODER_SOURCE),
    shell("sheriff", "Sheriff", "county", geo.countyName, CENSUS_GEOCODER_SOURCE),
    shell("district-attorney", "District attorney / prosecutor", "county", geo.countyName, CENSUS_GEOCODER_SOURCE),
    ...(geo.stateLowerDistrict
      ? [shell("state-representative", "State representative", "state", geo.stateLowerDistrict, CENSUS_GEOCODER_SOURCE)]
      : []),
    ...(geo.stateUpperDistrict
      ? [shell("state-senator", "State senator", "state", geo.stateUpperDistrict, CENSUS_GEOCODER_SOURCE)]
      : []),
    shell("governor", "Governor", "state", geo.stateName, CENSUS_GEOCODER_SOURCE),
    shell("local-judges", "Local trial court judges", "courts", geo.countyName, CENSUS_GEOCODER_SOURCE),
    shell("state-judges", "State appellate and supreme court judges", "courts", geo.stateName, CENSUS_GEOCODER_SOURCE),
  ];
}

async function getProviderOfficials(address: string): Promise<GovernmentOfficial[]> {
  const baseUrl = process.env.CIVIC_OFFICIALS_API_URL;
  if (!baseUrl) return [];

  try {
    const url = new URL(baseUrl);
    url.searchParams.set("address", address);
    const response = await fetch(url, {
      headers: process.env.CIVIC_OFFICIALS_API_KEY
        ? { Authorization: `Bearer ${process.env.CIVIC_OFFICIALS_API_KEY}` }
        : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { officials?: ProviderOfficial[] };
    return (body.officials ?? []).flatMap((item, index) => {
      if (!item.name || !item.office || !item.level || !item.jurisdiction) return [];
      return [{
        id: item.id || `provider-${index}`,
        office: item.office,
        level: item.level,
        jurisdiction: item.jurisdiction,
        name: item.name,
        party: item.party,
        phone: item.phone,
        website: item.website,
        status: "verified" as const,
        sourceLabel: item.sourceLabel || "Civic officials provider",
        sourceUrl: item.sourceUrl || baseUrl,
      }];
    });
  } catch {
    return [];
  }
}

function officeFamily(office: string): string {
  const name = office.toLowerCase();
  if (name.includes("school board")) return "school-board";
  if (name.includes("city council")) return "city-council";
  if (name.includes("mayor")) return "mayor";
  if (name.includes("county commission")) return "county-commission";
  if (name.includes("sheriff")) return "sheriff";
  if (name.includes("attorney") || name.includes("prosecutor")) return "prosecutor";
  if (name.includes("state representative")) return "state-representative";
  if (name.includes("state senator") || name.includes("state legislator")) return "state-senator";
  if (name === "governor") return "governor";
  if (name.includes("local trial") || name.includes("district court") || name.includes("county court")) return "local-judges";
  if (name.includes("supreme court") || name.includes("appellate")) return "state-judges";
  return name;
}

export function mergeOfficialCoverage(
  shells: GovernmentOfficial[],
  resolved: GovernmentOfficial[],
): { officials: GovernmentOfficial[]; gaps: GovernmentOfficial[] } {
  const seen = new Set<string>();
  const officials = resolved.filter((item) => {
    const key = `${item.name?.toLowerCase()}|${item.office.toLowerCase()}|${item.jurisdiction.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const families = new Set(officials.map((item) => `${item.level}:${officeFamily(item.office)}`));
  const gaps = shells.filter((item) => !families.has(`${item.level}:${officeFamily(item.office)}`));
  return { officials, gaps };
}

export async function lookupGovernment(address: string, magicKey?: string): Promise<GovernmentLookupResult> {
  let geography: CensusGeography;
  if (magicKey) {
    const point = await resolveSuggestion(address, magicKey);
    geography = await geocodeCoordinates(point.address, point.longitude, point.latitude);
  } else {
    geography = await geocodeAddress(address);
  }
  const [federal, state, local, provider] = await Promise.all([
    getFederalOfficials(geography).catch(() => []),
    getStateOfficials(geography).catch(() => []),
    getLocalOfficials(geography).catch(() => []),
    getProviderOfficials(address),
  ]);
  const { officials, gaps } = mergeOfficialCoverage(
    buildOfficeShells(geography),
    [...provider, ...local, ...state, ...federal],
  );
  const resolved = officials.length;

  return {
    matchedAddress: geography.matchedAddress,
    stateCode: geography.stateCode,
    districts: geography.districts,
    officials,
    sources: [
      { label: "U.S. Census Bureau Geocoder", url: CENSUS_GEOCODER_SOURCE },
      { label: "Congress Legislators (CC0)", url: CONGRESS_ROSTER_SOURCE },
      { label: "Open States (CC0)", url: OPEN_STATES_SOURCE },
      ...(local.length ? [{ label: "Hall County public GIS", url: HALL_COUNTY_GIS_SOURCE }] : []),
    ],
    coverage: {
      resolved,
      total: officials.length + gaps.length,
      localProviderConnected: Boolean(process.env.CIVIC_OFFICIALS_API_URL) || local.length > 0,
      gaps: gaps.map(({ office, jurisdiction, level }) => ({ office, jurisdiction, level })),
    },
  };
}
