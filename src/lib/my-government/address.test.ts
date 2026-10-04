import { describe, expect, it } from "vitest";
import { addressInputError, matchedAddressError } from "./address";

describe("address validation", () => {
  it("accepts a provider-formatted state and ZIP separated by a comma", () => {
    expect(addressInputError("1600 Pennsylvania Ave NW, Washington, DC, 20500, USA")).toBeNull();
  });

  it("rejects an ambiguous street-only query before geocoding", () => {
    expect(addressInputError("135 Edgewood Ave NE")).toContain("city");
  });

  it("accepts a complete U.S. address", () => {
    expect(addressInputError("135 Wedgewood Dr, Grand Island, NE 68801")).toBeNull();
  });

  it("rejects a fuzzy substitution on a different street", () => {
    expect(matchedAddressError(
      "135 Edgewood Ave NE, Atlanta, GA 30303",
      "135 WEDGEWOOD DR, GRAND ISLAND, NE, 68801",
    )).toContain("different street");
  });

  it("normalizes common street and ordinal abbreviations", () => {
    expect(matchedAddressError(
      "1000 Fifth Avenue, New York, NY 10028",
      "1000 5TH AVE, NEW YORK, NY, 10028",
    )).toBeNull();
  });

  it("rejects a ZIP-code substitution", () => {
    expect(matchedAddressError(
      "135 Wedgewood Dr, Grand Island, NE 68802",
      "135 WEDGEWOOD DR, GRAND ISLAND, NE, 68801",
    )).toContain("ZIP code");
  });
});
