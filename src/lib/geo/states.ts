// State FIPS codes (area_stats keys every state row by 2-digit FIPS, the same
// geoid ACS and the county maps use) plus lookups to the tile-grid layout in
// src/lib/money/us-states.ts.

import { US_STATE_GRID } from "@/lib/money/us-states";

export const STATE_FIPS: Record<string, string> = {
  AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09", DE: "10",
  DC: "11", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17", IN: "18", IA: "19",
  KS: "20", KY: "21", LA: "22", ME: "23", MD: "24", MA: "25", MI: "26", MN: "27",
  MS: "28", MO: "29", MT: "30", NE: "31", NV: "32", NH: "33", NJ: "34", NM: "35",
  NY: "36", NC: "37", ND: "38", OH: "39", OK: "40", OR: "41", PA: "42", RI: "44",
  SC: "45", SD: "46", TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53",
  WV: "54", WI: "55", WY: "56", PR: "72",
};

export const FIPS_TO_ABBR: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_FIPS).map(([abbr, fips]) => [fips, abbr]),
);

const NAMES: Record<string, string> = { ...Object.fromEntries(US_STATE_GRID.map((c) => [c.abbr, c.name])), PR: "Puerto Rico" };

export function stateName(fips: string): string {
  return NAMES[FIPS_TO_ABBR[fips]] ?? fips;
}

// The 50 states + DC, in name order — the rows of every state table.
export const STATES_51 = US_STATE_GRID.map((c) => ({ abbr: c.abbr, name: c.name, fips: STATE_FIPS[c.abbr] })).sort((a, b) =>
  a.name.localeCompare(b.name),
);
