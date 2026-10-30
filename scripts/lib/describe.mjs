// One-line descriptions for people and committees, built from the records an
// importer already holds: an office in metadata, congress-legislators terms,
// candidacies, or an FEC id. Importers once wrote their own provenance here
// ("imported from MIT Election Lab"), which the profile hero showed as the
// person's description; scripts/describe-entities.mjs replaces those.

import { US_STATE_NAMES as STATE_NAMES } from "../../src/lib/money/us-states.ts";

// The importer notes describe-entities replaces.
export const PROVENANCE_DESCRIPTIONS = [
  "Member of the United States Congress — imported from the congress-legislators crosswalk.",
  "Election candidate — imported from MIT Election Lab.",
  "Political committee — imported from FEC Schedule A data.",
];
export const PROVENANCE_PATTERN = /^\d{4} candidate — imported by scaffold-cycle\.$/;

export function isProvenanceDescription(text) {
  return PROVENANCE_DESCRIPTIONS.includes(text) || PROVENANCE_PATTERN.test(text ?? "");
}

export function stateLabel(value) {
  if (!value) return "";
  return STATE_NAMES[value.toUpperCase()] ?? value;
}

/** "REPUBLICAN PARTY", "Republican", "R" -> "Republican"; "Democrat" -> "Democratic". */
export function partyAdjective(party) {
  const p = String(party ?? "").trim().toUpperCase().replace(/ PARTY$/, "");
  if (!p) return "";
  if (p === "R" || p === "REP" || p === "REPUBLICAN") return "Republican";
  if (p === "D" || p === "DEM" || p === "DEMOCRAT" || p === "DEMOCRATIC") return "Democratic";
  if (p === "I" || p === "IND" || p === "INDEPENDENT") return "independent";
  if (p === "L" || p === "LIB" || p === "LIBERTARIAN") return "Libertarian";
  if (p === "G" || p === "GRE" || p === "GREEN") return "Green";
  return "";
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function year(date) {
  return String(date ?? "").slice(0, 4);
}

function joinWords(words) {
  return words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

// Congress service from congress-legislators terms:
// "Republican U.S. senator from Ohio since 2023" or
// "Former Democratic U.S. representative and senator from South Dakota (1971–1979)".
export function describeTerms(terms, today = new Date().toISOString().slice(0, 10)) {
  if (!Array.isArray(terms) || !terms.length) return "";
  const sorted = [...terms].sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const last = sorted.at(-1);
  const current = String(last.end ?? "") > today;
  const party = partyAdjective(last.party);
  const chambers = [...new Set(sorted.map((t) => (t.type === "sen" ? "senator" : "representative")))];
  const states = [...new Set(sorted.map((t) => stateLabel(t.state)))];
  const role = `${party ? `${party} ` : ""}U.S. ${joinWords(chambers)} from ${joinWords(states)}`;
  if (current) {
    const seat = last.type === "rep" && last.district ? ` (${ordinal(Number(last.district))} district)` : "";
    const since = year(sorted.filter((t) => t.type === last.type).at(0)?.start);
    return `${role}${seat}${since ? ` since ${since}` : ""}`;
  }
  const from = year(sorted[0].start);
  const to = year(last.end);
  return `Former ${role}${from ? ` (${from === to ? from : `${from}–${to}`})` : ""}`;
}

function race(office, jurisdiction, won) {
  if (!office) return "";
  if (office === "President") return "President";
  if (won && office.startsWith("U.S. ")) office = `the ${office}`;
  const district = /^([A-Z]{2})-(\d+)$/.exec(jurisdiction ?? "");
  if (district) {
    const n = Number(district[2]);
    return `${office}, ${n === 0 ? `${stateLabel(district[1])} at-large` : `${stateLabel(district[1])}'s ${ordinal(n)} district`}`;
  }
  const place = stateLabel(jurisdiction);
  return place && place !== "US" ? `${office} in ${place}` : office;
}

// The most recent candidacy: "Republican candidate for U.S. Senate in Kansas (2020)",
// or "Elected to U.S. Senate in Ohio (2022)" when it was won.
export function describeCandidacy(c) {
  if (!c?.office) return "";
  const party = partyAdjective(c.party);
  const when = c.year ? ` (${c.year})` : "";
  if (c.won) return c.office === "President" ? `Elected President${when}` : `Elected to ${race(c.office, c.jurisdiction, true)}${when}`;
  return `${party ? `${party} candidate` : "Candidate"} for ${race(c.office, c.jurisdiction)}${when}`;
}

// A candidate id's office and state: S6ID00161 -> U.S. Senate, Idaho.
export function candidacyFromFecId(id, cycle, party) {
  const m = /^([HSP])\d([A-Z]{2})/.exec(id ?? "");
  if (!m) return null;
  const office = { H: "U.S. House", S: "U.S. Senate", P: "President" }[m[1]];
  return { office, jurisdiction: m[1] === "P" ? "US" : m[2], year: cycle, party, won: false };
}

// Presidential results are stored per state, so a candidacy's `won` means it
// carried that state. Nationally, the winner is the winning party's nominee,
// which within one year is the candidate of that party who carried a state.
const PRESIDENTIAL_WINNING_PARTY = {
  1976: "Democratic", 1980: "Republican", 1984: "Republican", 1988: "Republican", 1992: "Democratic", 1996: "Democratic",
  2000: "Republican", 2004: "Republican", 2008: "Democratic", 2012: "Democratic", 2016: "Republican", 2020: "Democratic",
  2024: "Republican",
};

function nationalCandidacies(candidacies) {
  const byYear = new Map();
  const rest = [];
  for (const c of candidacies) {
    if (c.office !== "President") {
      rest.push(c);
      continue;
    }
    const prior = byYear.get(c.year);
    byYear.set(c.year, { ...c, jurisdiction: "US", won: Boolean(prior?.won || c.won) });
  }
  const presidential = [...byYear.values()].map((c) => ({
    ...c,
    won: c.won && PRESIDENTIAL_WINNING_PARTY[c.year] === partyAdjective(c.party),
  }));
  return [...rest, ...presidential];
}

const EXECUTIVE_TITLES = { "Vice President": "Vice President of the United States", President: "President of the United States" };

/**
 * A person's description, best record first: a current office, Congress
 * service, then the latest candidacy. `candidacies` are
 * { office, jurisdiction, year, party, won }, any order.
 */
export function describePerson({ metadata = {}, candidacies = [], today } = {}) {
  const parts = [];
  const office = typeof metadata.office === "string" && metadata.branch ? metadata.office : "";
  if (office) parts.push(EXECUTIVE_TITLES[office] ?? office);
  const terms = describeTerms(metadata.terms, today);
  if (terms) parts.push(office ? terms.replace(/^Former /, "former ") : terms);
  if (!terms) {
    const latest = nationalCandidacies(candidacies).sort((a, b) => Number(b.year ?? 0) - Number(a.year ?? 0))[0];
    const fallback = latest ?? candidacyFromFecId(metadata.fecCandidateId, undefined, metadata.party);
    const text = describeCandidacy(fallback);
    if (text) parts.push(office ? text.charAt(0).toLowerCase() + text.slice(1) : text);
  }
  if (!parts.length) return "";
  const text = `${parts.join("; ")}.`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A committee or organization first seen as an FEC contributor. */
export function describeCommittee(fecCommitteeId) {
  return fecCommitteeId ? `Federal political committee (FEC ${fecCommitteeId}).` : "Organization recorded as a contributor in FEC filings.";
}
