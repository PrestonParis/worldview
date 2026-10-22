import { describe, expect, it } from "vitest";
import { parseAddressSuggestions, parseResolvedSuggestion } from "./suggestions";

describe("parseAddressSuggestions", () => {
  it("returns unique address candidates and excludes collections", () => {
    expect(parseAddressSuggestions({
      suggestions: [
        { text: "135 Edgewood Ave NE, Atlanta, GA, 30303", magicKey: "first", isCollection: false },
        { text: "135 Edgewood Ave NE, Atlanta, GA, 30303", magicKey: "duplicate", isCollection: false },
        { text: "Edgewood Ave NE", magicKey: "collection", isCollection: true },
        { text: "135 Edgewood Ave NE, Canton, OH, 44702", magicKey: "second", isCollection: false },
      ],
    }, "135 Edgewood Ave NE")).toEqual([
      { text: "135 Edgewood Ave NE, Atlanta, GA, 30303", magicKey: "first" },
      { text: "135 Edgewood Ave NE, Canton, OH, 44702", magicKey: "second" },
    ]);
  });

  it("returns no candidates for malformed or error responses", () => {
    expect(parseAddressSuggestions({ nope: true })).toEqual([]);
    expect(parseAddressSuggestions({ error: { message: "Unavailable" } })).toEqual([]);
  });

  it("removes street-only suggestions when the user entered a house number", () => {
    expect(parseAddressSuggestions({
      suggestions: [
        { text: "Edgewood Ave NE, Atlanta, GA, 30303", magicKey: "street", isCollection: false },
        { text: "135 Edgewood Ave NE, Atlanta, GA, 30303", magicKey: "address", isCollection: false },
      ],
    }, "135 Edgewood Ave NE")).toEqual([
      { text: "135 Edgewood Ave NE, Atlanta, GA, 30303", magicKey: "address" },
    ]);
  });
});

describe("parseResolvedSuggestion", () => {
  const selected = "141 Piedmont Ave NE, Atlanta, GA, 30303, USA";

  it("keeps the selected address and uses the provider's address point", () => {
    expect(parseResolvedSuggestion({
      candidates: [{
        address: "141 Piedmont Ave NE, Atlanta, Georgia, 30303",
        location: { x: -84.3804, y: 33.7577 },
        score: 100,
        attributes: { Addr_type: "PointAddress" },
      }],
    }, selected)).toEqual({ address: "141 Piedmont Ave NE, Atlanta, GA, 30303", longitude: -84.3804, latitude: 33.7577 });
  });

  it("rejects coarse or mismatched candidates", () => {
    const candidate = { address: "141 Piedmont Ave NE, Atlanta, Georgia, 30303", location: { x: 0, y: 0 }, score: 100 };
    expect(parseResolvedSuggestion({ candidates: [{ ...candidate, attributes: { Addr_type: "StreetName" } }] }, selected)).toBeNull();
    expect(parseResolvedSuggestion({ candidates: [{ ...candidate, address: "143 Piedmont Ave NE", attributes: { Addr_type: "PointAddress" } }] }, selected)).toBeNull();
    expect(parseResolvedSuggestion({ candidates: [{ ...candidate, address: "141 Piedmont Ave SE, Atlanta, Georgia, 30303", attributes: { Addr_type: "PointAddress" } }] }, selected)).toBeNull();
    expect(parseResolvedSuggestion({ candidates: [] }, selected)).toBeNull();
  });

  it("keeps a precise NE address point available when Census suggests SE", () => {
    expect(parseResolvedSuggestion({
      candidates: [{
        address: "141 Piedmont Ave NE, Atlanta, Georgia, 30303",
        location: { x: -84.3804, y: 33.7577 },
        score: 100,
        attributes: { Addr_type: "PointAddress" },
      }],
    }, selected)).toEqual({
      address: "141 Piedmont Ave NE, Atlanta, GA, 30303",
      longitude: -84.3804,
      latitude: 33.7577,
    });
  });
});
