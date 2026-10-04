const STREET_SUFFIXES: Record<string, string> = {
  ALLEY: "ALY", ALY: "ALY", AVE: "AVE", AVENUE: "AVE", BOULEVARD: "BLVD", BLVD: "BLVD",
  CIRCLE: "CIR", CIR: "CIR", COURT: "CT", CT: "CT", DRIVE: "DR", DR: "DR",
  HIGHWAY: "HWY", HWY: "HWY", LANE: "LN", LN: "LN", PARKWAY: "PKWY", PKWY: "PKWY",
  PLACE: "PL", PL: "PL", ROAD: "RD", RD: "RD", STREET: "ST", ST: "ST",
  TERRACE: "TER", TER: "TER", TRAIL: "TRL", TRL: "TRL", WAY: "WAY",
};

const DIRECTIONS: Record<string, string> = {
  N: "N", NORTH: "N", S: "S", SOUTH: "S", E: "E", EAST: "E", W: "W", WEST: "W",
  NE: "NE", NORTHEAST: "NE", NW: "NW", NORTHWEST: "NW",
  SE: "SE", SOUTHEAST: "SE", SW: "SW", SOUTHWEST: "SW",
};

const ORDINALS: Record<string, string> = {
  FIRST: "1ST", SECOND: "2ND", THIRD: "3RD", FOURTH: "4TH", FIFTH: "5TH",
  SIXTH: "6TH", SEVENTH: "7TH", EIGHTH: "8TH", NINTH: "9TH", TENTH: "10TH",
};

function tokens(value: string): string[] {
  return value
    .toUpperCase()
    .replace(/[.#]/g, " ")
    .split(/\s+/)
    .map((token) => ORDINALS[token] ?? token)
    .filter(Boolean);
}

interface StreetParts {
  number: string;
  name: string;
  suffix: string;
  direction: string;
}

function streetParts(address: string): StreetParts | null {
  const firstLine = address.split(",")[0];
  const parts = tokens(firstLine);
  const numberIndex = parts.findIndex((part) => /^\d+[A-Z]?$/.test(part));
  if (numberIndex < 0) return null;
  const suffixIndex = parts.findIndex((part, index) => index > numberIndex && Boolean(STREET_SUFFIXES[part]));
  if (suffixIndex < 0) return null;
  const direction = DIRECTIONS[parts[suffixIndex + 1]] ?? "";
  return {
    number: parts[numberIndex],
    name: parts.slice(numberIndex + 1, suffixIndex).map((part) => DIRECTIONS[part] ?? part).join(" "),
    suffix: STREET_SUFFIXES[parts[suffixIndex]],
    direction,
  };
}

export function addressInputError(address: string): string | null {
  const trimmed = address.trim();
  if (!/^\d/.test(trimmed)) return "Start with the street number.";
  if (!/\b[A-Z]{2},?\s+\d{5}(?:-\d{4})?\b/i.test(trimmed)) {
    return "Add the city, two-letter state, and ZIP code so the address cannot be matched to the wrong place.";
  }
  if (!streetParts(trimmed)) return "Include a complete street name and type, such as Ave, Dr, Rd, or St.";
  return null;
}

export function matchedAddressError(input: string, matched: string): string | null {
  const requested = streetParts(input);
  const returned = streetParts(matched);
  if (!requested || !returned) return "The address service returned an incomplete street match.";
  if (
    requested.number !== returned.number
    || requested.name !== returned.name
    || requested.suffix !== returned.suffix
    || (requested.direction && requested.direction !== returned.direction)
  ) {
    return `The address service suggested ${matched}, but that is a different street. Check the city, state, ZIP code, and spelling.`;
  }

  const inputZip = input.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1];
  const matchedZip = matched.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1];
  if (inputZip && matchedZip && inputZip !== matchedZip) {
    return `The address service suggested ZIP code ${matchedZip}, not ${inputZip}. Check the address and try again.`;
  }
  return null;
}
