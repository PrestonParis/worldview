export type GovernmentLevel = "local" | "county" | "state" | "federal" | "courts";

export interface GovernmentDistrict {
  kind: string;
  name: string;
  geoid: string;
}

export interface GovernmentOfficial {
  id: string;
  office: string;
  level: GovernmentLevel;
  jurisdiction: string;
  name: string | null;
  party?: string;
  phone?: string;
  website?: string;
  bioguideId?: string;
  // Graph entity id, when the official was resolved from the graph.
  entityId?: string;
  status: "verified" | "district-only";
  sourceLabel: string;
  sourceUrl: string;
}

export interface GovernmentLookupResult {
  matchedAddress: string;
  stateCode: string;
  districts: GovernmentDistrict[];
  officials: GovernmentOfficial[];
  sources: Array<{ label: string; url: string }>;
  coverage: {
    resolved: number;
    total: number;
    localProviderConnected: boolean;
    gaps: Array<{ office: string; jurisdiction: string; level: GovernmentLevel }>;
  };
}

export interface CensusGeography {
  matchedAddress: string;
  stateCode: string;
  stateName: string;
  countyName: string;
  countyGeoid: string;
  placeName: string;
  placeGeoid: string;
  longitude: number;
  latitude: number;
  congressionalDistrict: string;
  stateUpperDistrict: string;
  stateLowerDistrict: string;
  schoolDistricts: Array<{ kind: string; name: string; geoid: string }>;
  districts: GovernmentDistrict[];
}
