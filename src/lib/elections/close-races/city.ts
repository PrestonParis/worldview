// Elections a city runs itself never reach the SOS feed (Norcross hand-counts
// its own). Their results come from the city's web page, as HTML or a linked
// PDF, in no fixed format. The candidates are known in advance
// (data/elections/ga/schedule.json), so a result is read as the first vote
// count printed after each candidate's name, and taken only when every
// candidate in the contest has one.

import type { AssembledContest } from "./merge.ts";
import { normalizeName } from "./merge.ts";

export interface CityContestConfig {
  name: string;
  voteFor: number;
  candidates: string[];
}

export interface CityConfig {
  id: string;
  name: string;
  county: string;
  countySlug: string;
  resultsUrl: string;
  source?: string | null;
  pollsCloseUtc: string;
  contests: CityContestConfig[];
}

const ENTITIES: Record<string, string> = { amp: "&", nbsp: " ", quot: '"', apos: "'", lt: "<", gt: ">", ndash: "-", mdash: "-" };

/** Visible text of an HTML page, whitespace collapsed. */
export function pageText(html: string): string {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-z]+);/gi, (m, e) => ENTITIES[e.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

/** PDF and document links on the page whose text or address mentions results. */
export function resultLinks(html: string, base: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const [, href, label] = m;
    if (!/result/i.test(`${href} ${pageText(label)}`)) continue;
    try {
      out.add(new URL(href.replace(/&amp;/g, "&"), base).toString());
    } catch {
      // not a URL
    }
  }
  return [...out];
}

const MONTH = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*$/i;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function namePatterns(candidate: string): RegExp {
  const parts = candidate.trim().split(/\s+/);
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(" ");
  const forms = [parts.map(escape).join("\\s+(?:[A-Z]\\.?\\s+)?"), first ? `${escape(last)},\\s*${escape(first)}` : null].filter(Boolean);
  return new RegExp(`\\b(?:${forms.join("|")})\\b`, "gi");
}

// The first number in `after` that reads as a vote count: not a percent, a
// date, a time, a year or an ordinal.
function voteCount(after: string): number | null {
  for (const m of after.matchAll(/\d{1,3}(?:,\d{3})+|\d+/g)) {
    const raw = m[0];
    const at = m.index ?? 0;
    const next = after.slice(at + raw.length, at + raw.length + 6);
    const before = after.slice(0, at);
    if (/^\s*(%|\.\d|\/|:|-\d|st\b|nd\b|rd\b|th\b|percent)/i.test(next)) continue;
    if (MONTH.test(before)) continue;
    if (/^(19|20)\d\d$/.test(raw)) continue;
    return Number(raw.replace(/,/g, ""));
  }
  return null;
}

const WINDOW = 60;

/**
 * Votes per candidate, or null unless every candidate has exactly one
 * reading. A name followed by no number (a candidate list, a notice) is
 * skipped; two different numbers for one name is ambiguous.
 */
export function extractVotes(text: string, candidates: string[]): Map<string, number> | null {
  const spans = candidates.map((c) => [...text.matchAll(namePatterns(c))].map((m) => ({ candidate: c, start: m.index ?? 0, end: (m.index ?? 0) + m[0].length })));
  const all = spans.flat().sort((a, b) => a.start - b.start);
  const votes = new Map<string, number>();
  for (const c of candidates) {
    const found = new Set<number>();
    for (const s of all.filter((x) => x.candidate === c)) {
      const nextName = all.find((x) => x.start >= s.end)?.start ?? text.length;
      const n = voteCount(text.slice(s.end, Math.min(nextName, s.end + WINDOW)));
      if (n != null) found.add(n);
    }
    if (found.size !== 1) return null;
    votes.set(c, [...found][0]);
  }
  return votes;
}

/** A city contest as the shared evaluate/write path expects it. Votes absent: no results yet. */
export function cityContest(city: CityConfig, contest: CityContestConfig, votes: Map<string, number> | null, asOf: string | null): AssembledContest {
  const options = contest.candidates.map((name) => ({
    sourceId: `${city.id}:${normalizeName(name)}`,
    name,
    party: null,
    incumbent: false,
    isWriteIn: false,
    votes: votes?.get(name) ?? 0,
    votesByMethod: {},
  }));
  return {
    key: normalizeName(contest.name),
    scope: "county",
    sourceContestIds: [],
    name: contest.name,
    rawName: contest.name,
    voteFor: contest.voteFor,
    isReferendum: false,
    primaryParty: null,
    countySlug: city.countySlug,
    county: city.county,
    counties: [city.county],
    // A hand count posts no precinct progress: "reporting" once numbers appear.
    reportingUnits: 0,
    totalUnits: 1,
    asOf: votes ? asOf : null,
    isOfficial: false,
    options,
    areas: [{ countySlug: city.countySlug, county: city.county, reportingUnits: 0, totalUnits: 1, options: options.map((o) => ({ name: o.name, votes: o.votes })) }],
    merged: false,
    unlinkedCounties: [],
  };
}
