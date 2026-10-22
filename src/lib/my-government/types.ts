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
  // "Ann Arbor, MI" — what a saved result shows in place of the address.
  place: string;
  stateCode: string;
  stateName: string;
  // The U.S. House race code elections use ("MI-06", "AK-AL"); null when
  // the Census returned no congressional district.
  houseCode: string | null;
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

// What Worldview holds on one official (records.ts), fetched alongside a
// lookup or saved result so saved results never go stale.
export interface OfficialRecord {
  entityId: string;
  bioguideId: string | null;
  profilePath: string;
  // The newest FEC cycle with receipts; federal candidates only.
  finance: { cycle: number; receipts: number; cashOnHand: number | null } | null;
  billsSponsored: number;
  rollCallVotes: number;
  // Voteview DW-NOMINATE first dimension, -1 (left) to +1 (right).
  nominate: number | null;
  nextRace: { id: string; name: string; date: string } | null;
}
