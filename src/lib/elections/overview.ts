import { US_STATE_GRID } from "../money/us-states";
import { ratingLean, type Rating } from "../validation/raceRating";

// Shapes and pure helpers for the /elections overview. The server loader is
// src/lib/db/election-overview.ts; everything here is safe on the client.

export type OfficeKey = "senate" | "house" | "governor" | "president";

export const OFFICES: Array<{ key: OfficeKey; office: string; label: string }> = [
  { key: "senate", office: "U.S. Senate", label: "Senate" },
  { key: "house", office: "U.S. House", label: "House" },
  { key: "governor", office: "Governor", label: "Governor" },
  { key: "president", office: "President", label: "President" },
];

export function officeKeyFor(office: string): OfficeKey | null {
  return OFFICES.find((item) => item.office === office)?.key ?? null;
}

export type PartyLetter = "D" | "R" | "I";

// Free-text party -> D / R / I. Fusion tickets ("Working Families /
// Democrat") count as the major party on the line. Names are matched whole,
// so minor parties sharing a first letter ("Reform", "Independence") stay
// unassigned.
export function partyLetter(party: string | null | undefined): PartyLetter | null {
  if (!party) return null;
  const parts = party.toLowerCase().split("/").map((part) => part.trim().replace(/\s+party$/, ""));
  if (parts.some((part) => /^(democrat|democratic)\b/.test(part) || part === "dfl")) return "D";
  if (parts.some((part) => /^republican\b/.test(part) || part === "gop")) return "R";
  if (parts.some((part) => /^independent$/.test(part))) return "I";
  return null;
}

export interface RaceSummary {
  id: string;
  name: string;
  // elections.office: "U.S. Senate", "Governor"…
  office: string;
  // "MI", "MI-03", or "US" for a national presidential row.
  code: string;
  stateAbbr: string | null;
  special: boolean;
  openSeat: boolean;
  status: string;
  date: string;
  // Consensus of the latest handicapper ratings (see consensusRating).
  rating: Rating | null;
  // false when the rating is the "safe for the holding party" fallback.
  ratingPublished: boolean;
  // The individual handicapper ratings behind `rating`.
  ratings: Array<{ source: string; rating: Rating; asOf: string }>;
  // Whoever holds the seat now, running or not.
  incumbent: { name: string; party: PartyLetter | null } | null;
  // General-election candidates; empty for past cycles and unsynced races.
  nominees: Array<{ name: string; party: PartyLetter | null; partyLabel: string; incumbent: boolean }>;
  result: {
    winnerName: string;
    winnerParty: PartyLetter | null;
    // Winner minus runner-up, percent of the total vote.
    marginPct: number | null;
  } | null;
}

export interface CycleSummary {
  cycle: number;
  upcoming: boolean;
  offices: Partial<Record<OfficeKey, number>>;
}

export interface SearchEntry {
  id: string;
  name: string;
  cycle: number;
  office: string;
  jurisdiction: string;
}

const STATE_ABBR = Object.fromEntries(US_STATE_GRID.map((cell) => [cell.name.toLowerCase(), cell.abbr]));

// "MA-03" stays a district code; state names become their postal code.
export function raceCode(jurisdiction: string): { code: string; stateAbbr: string | null } {
  if (/^[A-Z]{2}-(\d{2}|AL)$/.test(jurisdiction)) {
    return { code: jurisdiction, stateAbbr: jurisdiction.slice(0, 2) };
  }
  if (jurisdiction === "United States") return { code: "US", stateAbbr: null };
  // Imported names vary in case ("District Of Columbia").
  const abbr = STATE_ABBR[jurisdiction.toLowerCase()] ?? null;
  return { code: abbr ?? jurisdiction, stateAbbr: abbr };
}

// ---------------------------------------------------------------- ratings

// The long-running handicappers, in display order.
export const HANDICAPPERS: Array<{ id: string; label: string }> = [
  { id: "cook", label: "Cook" },
  { id: "inside-elections", label: "Inside Elections" },
  { id: "sabato", label: "Sabato" },
];

const BY_LEAN: Record<number, Rating> = {
  3: "safe_d", 2: "likely_d", 1: "lean_d", 0: "tossup", [-1]: "lean_r", [-2]: "likely_r", [-3]: "safe_r",
};

export interface RatingRow {
  source: string;
  rating: Rating;
  asOf: Date | string;
}

// One rating per race: the median of each handicapper's latest call (an even
// count averages the middle two and rounds toward toss-up). Without any
// handicapper, the latest other published rating; failing that, the
// "inferred" safe-for-the-holder fallback.
export function consensusRating(rows: RatingRow[]): {
  rating: Rating;
  published: boolean;
  ratings: Array<{ source: string; rating: Rating; asOf: string }>;
} | null {
  if (rows.length === 0) return null;
  const time = (row: RatingRow) => new Date(row.asOf).getTime();
  const latest = new Map<string, RatingRow>();
  for (const row of rows) {
    const seen = latest.get(row.source);
    if (!seen || time(row) > time(seen)) latest.set(row.source, row);
  }
  const handicapped = HANDICAPPERS.map((item) => latest.get(item.id)).filter((row): row is RatingRow => Boolean(row));
  const ratings = handicapped.map((row) => ({
    source: row.source,
    rating: row.rating,
    asOf: new Date(row.asOf).toISOString().slice(0, 10),
  }));
  if (handicapped.length) {
    if (handicapped.every((row) => row.rating === "safe_i")) return { rating: "safe_i", published: true, ratings };
    const leans = handicapped.map((row) => ratingLean(row.rating)).sort((a, b) => a - b);
    const middle = leans.length / 2;
    const median = leans.length % 2 ? leans[Math.floor(middle)] : (leans[middle - 1] + leans[middle]) / 2;
    return { rating: BY_LEAN[Math.trunc(median)], published: true, ratings };
  }
  const newest = [...latest.values()].sort((a, b) => time(b) - time(a));
  const other = newest.find((row) => row.source !== "inferred");
  if (other) return { rating: other.rating, published: true, ratings };
  return { rating: newest[0].rating, published: false, ratings };
}

// Diverging RdBu ramp (ColorBrewer, the party-colors endpoints) with a
// neutral toss-up midpoint. `text` is the ink that reads on that fill.
export const RATING_ORDER: Rating[] = [
  "safe_i", "safe_d", "likely_d", "lean_d", "tossup", "lean_r", "likely_r", "safe_r",
];

export const RATING_STYLE: Record<Rating, { fill: string; text: string }> = {
  safe_d: { fill: "#2166AC", text: "#ffffff" },
  likely_d: { fill: "#67A9CF", text: "#0f172a" },
  lean_d: { fill: "#D1E5F0", text: "#0f172a" },
  tossup: { fill: "#E2E8F0", text: "#0f172a" },
  lean_r: { fill: "#FDDBC7", text: "#0f172a" },
  likely_r: { fill: "#EF8A62", text: "#0f172a" },
  safe_r: { fill: "#B2182B", text: "#ffffff" },
  safe_i: { fill: "#64748B", text: "#ffffff" },
};

// Result fill by winner and margin: three steps per party, deeper = wider.
export const MARGIN_STEPS = [5, 15] as const;

export function resultStyle(
  party: PartyLetter | null,
  marginPct: number | null,
): { fill: string; text: string } {
  if (!party) return { fill: "#CBD5E1", text: "#0f172a" };
  if (party === "I") return RATING_STYLE.safe_i;
  const step = marginPct == null ? 2 : marginPct < MARGIN_STEPS[0] ? 0 : marginPct < MARGIN_STEPS[1] ? 1 : 2;
  const ramp: Record<"D" | "R", Rating[]> = {
    D: ["lean_d", "likely_d", "safe_d"],
    R: ["lean_r", "likely_r", "safe_r"],
  };
  return RATING_STYLE[ramp[party][step]];
}

export function partyName(party: PartyLetter | null): string {
  return party === "D" ? "Democrat" : party === "R" ? "Republican" : party === "I" ? "Independent" : "Other";
}
