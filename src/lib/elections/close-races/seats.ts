// Seats and who holds them: chamber totals and seat changes for the results
// hub. Prior holders come from data/elections/ga/seat-holders-2026.json, built
// by scripts/build-ga-seat-holders.mjs.

import { contestOutcome, seatIsDecided, type OutcomeInput } from "./outcome.ts";

export type ChamberId = "ga_house" | "ga_senate" | "us_house";

export const CHAMBERS: { id: ChamberId; label: string; seats: number; majority: number | null }[] = [
  { id: "ga_house", label: "Georgia House", seats: 180, majority: 91 },
  { id: "ga_senate", label: "Georgia Senate", seats: 56, majority: 29 },
  // A delegation, not a chamber: no majority line to reach.
  { id: "us_house", label: "U.S. House delegation", seats: 14, majority: null },
];

export interface SeatHolder {
  party: string;
  name: string;
  /** The SOS election this holder won, or the source of an override. */
  source: string;
}

export type SeatHolders = Record<string, SeatHolder>;

/** "State House of Representatives - District 103" → "ga_house:103"; statewide offices by name. */
export function seatKey(name: string): string | null {
  // Specials sometimes lead with the word: "Special State Senate - District 21".
  const clean = name.replace(/\s+/g, " ").trim().replace(/^spec(ial)?\.? /i, "");
  const district = (re: RegExp) => clean.match(re)?.[1]?.replace(/^0+/, "") ?? null;
  const house = district(/^State House of Rep\w*\b.*?\bDistrict (\d+)/i);
  if (house) return `ga_house:${house}`;
  const senate = district(/^State Senate?\b.*?\bDistrict (\d+)/i);
  if (senate) return `ga_senate:${senate}`;
  const usHouse = district(/^US House of Rep\w*\b.*?\bDistrict (\d+)/i);
  if (usHouse) return `us_house:${usHouse}`;
  const psc = district(/^(?:PSC|Public Service Commission)\b.*?\bDistrict (\d+)/i);
  if (psc) return `statewide:psc-${psc}`;
  if (/^US Senate\b/i.test(clean)) return "statewide:us-senate";
  for (const [re, key] of STATEWIDE) if (re.test(clean)) return `statewide:${key}`;
  return null;
}

const STATEWIDE: [RegExp, string][] = [
  [/^Governor\b/i, "governor"],
  [/^Lieutenant Governor\b/i, "lieutenant-governor"],
  [/^Secretary of State\b/i, "secretary-of-state"],
  [/^Attorney General\b/i, "attorney-general"],
  [/^Commissioner of Agriculture\b/i, "agriculture"],
  [/^Commissioner of Insurance\b/i, "insurance"],
  [/^State School Superintendent\b/i, "school-superintendent"],
  [/^Commissioner of Labor\b/i, "labor"],
];

export const chamberOf = (key: string | null): ChamberId | null => {
  const prefix = key?.split(":")[0];
  return prefix === "ga_house" || prefix === "ga_senate" || prefix === "us_house" ? prefix : null;
};

export type SeatChange = "held" | "gained" | "unknown";

export interface SeatChangeRow {
  /** The party that won the seat, or null until it is decided. */
  party: string | null;
  priorParty: string | null;
  change: SeatChange | null;
}

export function seatChange(winnerParty: string | null, holder: SeatHolder | undefined): SeatChangeRow {
  if (!winnerParty) return { party: null, priorParty: holder?.party ?? null, change: null };
  if (!holder) return { party: winnerParty, priorParty: null, change: "unknown" };
  return { party: winnerParty, priorParty: holder.party, change: holder.party === winnerParty ? "held" : "gained" };
}

export interface ChamberRowInput extends OutcomeInput {
  name: string;
  leaderParty: string | null;
}

export interface ChamberSummary {
  id: ChamberId;
  label: string;
  seats: number;
  majority: number | null;
  /** Decided seats by party, largest first. */
  parties: { party: string; seats: number; recountRange: number; net: number | null }[];
  undecided: number;
  runoffs: number;
  /** Seats with no contest in this feed: a coverage gap, kept visible. */
  missing: number;
}

/**
 * Seats by party. A seat counts only once decided, so a runoff or a tie stays
 * out of both columns. Later rounds (the Dec 1 runoff) pass their winners in
 * `settled`, by seat key. Net change needs a prior holder for every decided
 * seat, or it would be a guess.
 */
export function chamberSummaries(rows: ChamberRowInput[], holders: SeatHolders, settled: Map<string, string> = new Map()): ChamberSummary[] {
  return CHAMBERS.map((chamber) => {
    const tally = new Map<string, { seats: number; recountRange: number }>();
    const net = new Map<string, number>();
    let undecided = 0;
    let runoffs = 0;
    let found = 0;
    let unknownPrior = false;
    for (const row of rows) {
      const key = seatKey(row.name);
      if (chamberOf(key) !== chamber.id) continue;
      found++;
      const outcome = contestOutcome(row);
      const party = settled.get(key!) ?? (seatIsDecided(outcome.kind) ? row.leaderParty : null);
      if (!party) {
        undecided++;
        if (outcome.kind === "advancing_to_runoff") runoffs++;
        continue;
      }
      const entry = tally.get(party) ?? { seats: 0, recountRange: 0 };
      entry.seats++;
      if (!settled.has(key!) && row.flags.includes("recount_request_range")) entry.recountRange++;
      tally.set(party, entry);
      const holder = holders[key!];
      if (!holder) unknownPrior = true;
      else if (holder.party !== party) {
        net.set(party, (net.get(party) ?? 0) + 1);
        net.set(holder.party, (net.get(holder.party) ?? 0) - 1);
      }
    }
    const parties = [...tally.entries()]
      .map(([party, t]) => ({ party, ...t, net: unknownPrior ? null : (net.get(party) ?? 0) }))
      .sort((a, b) => b.seats - a.seats || a.party.localeCompare(b.party));
    return { ...chamber, parties, undecided, runoffs, missing: Math.max(0, chamber.seats - found) };
  });
}
