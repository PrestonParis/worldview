import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CensusGeography } from "./types";

const geocoders = vi.hoisted(() => ({
  geocodeAddress: vi.fn(),
  geocodeCoordinates: vi.fn(),
  resolveSuggestion: vi.fn(),
}));

vi.mock("./census", () => ({
  CENSUS_GEOCODER_SOURCE: "https://example.test/census",
  geocodeAddress: geocoders.geocodeAddress,
  geocodeCoordinates: geocoders.geocodeCoordinates,
}));
vi.mock("./suggestions", () => ({ resolveSuggestion: geocoders.resolveSuggestion }));
vi.mock("./federal", () => ({
  CONGRESS_ROSTER_SOURCE: "https://example.test/congress",
  getFederalOfficials: vi.fn().mockResolvedValue([]),
}));
vi.mock("./state", () => ({
  OPEN_STATES_SOURCE: "https://example.test/states",
  getStateOfficials: vi.fn().mockResolvedValue([]),
}));
vi.mock("./local", () => ({
  HALL_COUNTY_GIS_SOURCE: "https://example.test/local",
  getLocalOfficials: vi.fn().mockResolvedValue([]),
}));

import { lookupGovernment } from "./lookup";

const piedmontGeography: CensusGeography = {
  matchedAddress: "141 Piedmont Ave NE, Atlanta, GA, 30303",
  stateCode: "GA",
  stateName: "Georgia",
  countyName: "Fulton County",
  countyGeoid: "13121",
  placeName: "Atlanta city",
  placeGeoid: "1304000",
  longitude: -84.3804,
  latitude: 33.7577,
  congressionalDistrict: "5",
  stateUpperDistrict: "State Senate District 36",
  stateLowerDistrict: "State House District 59",
  schoolDistricts: [],
  districts: [],
};

describe("typed-address geocoding fallback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses a precise address point when Census changes NE to SE", async () => {
    const address = "141 Piedmont Ave NE, Atlanta, GA, 30303, USA";
    const censusMismatch = new Error(
      "The address service suggested 141 PIEDMONT AVE SE, ATLANTA, GA, 30303, but that is a different street.",
    );
    geocoders.geocodeAddress.mockRejectedValue(censusMismatch);
    geocoders.resolveSuggestion.mockResolvedValue({
      address: "141 Piedmont Ave NE, Atlanta, GA, 30303",
      longitude: -84.3804,
      latitude: 33.7577,
    });
    geocoders.geocodeCoordinates.mockResolvedValue(piedmontGeography);

    const result = await lookupGovernment(address);

    expect(geocoders.resolveSuggestion).toHaveBeenCalledWith(address);
    expect(geocoders.geocodeCoordinates).toHaveBeenCalledWith(
      "141 Piedmont Ave NE, Atlanta, GA, 30303",
      -84.3804,
      33.7577,
    );
    expect(result.matchedAddress).toBe("141 Piedmont Ave NE, Atlanta, GA, 30303");
    expect(result.houseCode).toBe("GA-05");
  });
});
