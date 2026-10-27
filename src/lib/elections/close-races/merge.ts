// State feed + 159 county feeds → one list of contests.
//
// - A county contest whose parentId is a state contest is that county's
//   slice of it: it becomes an area row, never its own contest.
// - Any other county contest is local. A local contest that crosses county
//   lines (Atlanta is in Fulton and DeKalb) appears once per county, often
//   under different names ("Atlanta City Council P1 At Large" vs "… Member
//   Post 1 At Large"), so candidate contests merge on their identical set of
//   qualified candidates, never on a name alone. Ballot questions have no
//   candidates; they merge only on an identical name that names a city
//   ("City of College Park …", "Sunday Package Sales - Social Circle"), or
//   when overrides list the name under `merge`. Any other ballot question
//   whose exact name appears in several counties is left separate and
//   reported, so an operator can decide.

import { municipalityOf, placeSuffix } from "./level.ts";
import type { ParsedContest, ParsedFeed, ParsedOption } from "./types.ts";

export interface CountyFeed {
  slug: string;
  name: string;
  feed: ParsedFeed;
}

export interface AreaRow {
  countySlug: string;
  county: string;
  reportingUnits: number;
  totalUnits: number;
  options: { name: string; votes: number }[];
  /**
   * False for a county's copy of a state contest that the county feed
   * doesn't link to it (parentId null). SOS may leave it out of the state
   * total, so its votes are shown but never added to the contest.
   */
  linked?: boolean;
}

export interface AssembledContest {
  /**
   * Stable suffix of the external id: `ga-sos:{electionId}:{key}`. Keyed by
   * normalized name, not the feed's contest GUID, so the JSON API and the
   * media export (different ids, identical names) land on the same rows.
   */
  key: string;
  scope: "state" | "county" | "multi_county";
  sourceContestIds: string[];
  name: string;
  rawName: string;
  voteFor: number;
  isReferendum: boolean;
  primaryParty: string | null;
  countySlug: string | null;
  county: string | null;
  counties: string[];
  reportingUnits: number;
  totalUnits: number;
  asOf: string | null;
  isOfficial: boolean;
  options: ParsedOption[];
  areas: AreaRow[];
  merged: boolean;
  /** Counties whose copy of this state contest isn't linked to it. */
  unlinkedCounties: string[];
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[“”"]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(name: string): string {
  return normalizeName(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Small stable string hash (FNV-1a, 2×32 bit) for merged-contest keys. */
export function stableHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

/** The merge key for a local contest, or null when it must never merge. */
export function localGroupKey(contest: ParsedContest, forceMerge: Set<string> = new Set()): string | null {
  if (contest.isReferendum) {
    const named = forceMerge.has(normalizeName(contest.name)) || municipalityOf(contest.name) || placeSuffix(contest.name);
    return named ? `q:${normalizeName(contest.name)}` : null;
  }
  const names = contest.options.filter((o) => !o.isWriteIn).map((o) => normalizeName(o.name));
  if (names.length === 0) return null;
  return `c:${contest.voteFor}:${names.sort().join("|")}`;
}

function sumOptions(groups: ParsedOption[][]): ParsedOption[] {
  const byName = new Map<string, ParsedOption>();
  for (const options of groups) {
    for (const option of options) {
      const key = normalizeName(option.name);
      const existing = byName.get(key);
      if (!existing) {
        byName.set(key, { ...option, votesByMethod: { ...option.votesByMethod } });
        continue;
      }
      existing.votes += option.votes;
      existing.incumbent ||= option.incumbent;
      existing.party ??= option.party;
      for (const [method, votes] of Object.entries(option.votesByMethod)) {
        existing.votesByMethod[method] = (existing.votesByMethod[method] ?? 0) + votes;
      }
    }
  }
  return [...byName.values()];
}

const candidateSet = (contest: ParsedContest) =>
  contest.options
    .filter((o) => !o.isWriteIn)
    .map((o) => normalizeName(o.name))
    .sort()
    .join("|");

const total = (options: ParsedOption[]) => options.reduce((s, o) => s + o.votes, 0);

function areaRow(county: CountyFeed, contest: ParsedContest): AreaRow {
  return {
    countySlug: county.slug,
    county: county.name,
    reportingUnits: contest.reportingUnits,
    totalUnits: contest.totalUnits,
    options: contest.options.map((o) => ({ name: o.name, votes: o.votes })),
  };
}

function latest(values: (string | null)[]): string | null {
  return values.filter((v): v is string => Boolean(v)).sort().at(-1) ?? null;
}

export function assembleContests(
  state: ParsedFeed,
  counties: CountyFeed[],
  { split = [], merge = [] }: { split?: string[]; merge?: string[] } = {},
): { contests: AssembledContest[]; warnings: string[] } {
  const warnings: string[] = [];
  const stateIds = new Set(state.contests.map((c) => c.sourceId));
  const areasByState = new Map<string, AreaRow[]>();
  const locals: { county: CountyFeed; contest: ParsedContest }[] = [];
  const addArea = (parentId: string, row: AreaRow) => areasByState.set(parentId, [...(areasByState.get(parentId) ?? []), row]);

  // A county contest with no parentId that has a state contest's exact name
  // and exactly its candidates is that state contest, unlinked by the county
  // feed (Carroll, Madison and Stewart's US Senate and Governor on the
  // Nov 3 2026 ballot definition). Name alone isn't enough.
  const stateByName = new Map<string, ParsedContest[]>();
  for (const c of state.contests) stateByName.set(normalizeName(c.name), [...(stateByName.get(normalizeName(c.name)) ?? []), c]);
  const unlinkedParent = (contest: ParsedContest): ParsedContest | null => {
    const matches = (stateByName.get(normalizeName(contest.name)) ?? []).filter((s) => candidateSet(s) === candidateSet(contest));
    return matches.length === 1 && !contest.isReferendum ? matches[0] : null;
  };

  for (const county of counties) {
    for (const contest of county.feed.contests) {
      if (contest.parentId && stateIds.has(contest.parentId)) {
        addArea(contest.parentId, areaRow(county, contest));
        continue;
      }
      const parent = contest.parentId ? null : unlinkedParent(contest);
      if (parent) {
        addArea(parent.sourceId, { ...areaRow(county, contest), linked: false });
        warnings.push(`unlinked: "${parent.name}" in ${county.slug} isn't linked to the state contest; the SOS statewide total may leave it out`);
        continue;
      }
      if (contest.parentId) warnings.push(`${county.slug}: "${contest.name}" points at a state contest not in the state feed; kept as local`);
      locals.push({ county, contest });
    }
  }

  const contests: AssembledContest[] = state.contests.map((contest) => {
    const areas = (areasByState.get(contest.sourceId) ?? []).sort((a, b) => a.county.localeCompare(b.county));
    return {
      key: slugify(contest.name),
      scope: "state",
      sourceContestIds: [contest.sourceId],
      name: contest.name,
      rawName: contest.rawName,
      voteFor: contest.voteFor,
      isReferendum: contest.isReferendum,
      primaryParty: contest.primaryParty,
      countySlug: null,
      county: null,
      counties: areas.map((a) => a.countySlug),
      reportingUnits: contest.reportingUnits,
      totalUnits: contest.totalUnits,
      asOf: contest.asOf,
      isOfficial: state.election.isOfficialResults,
      options: contest.options,
      areas,
      merged: false,
      unlinkedCounties: areas.filter((a) => a.linked === false).map((a) => a.countySlug),
    };
  });

  const splitSet = new Set(split.map(normalizeName));
  const mergeSet = new Set(merge.map(normalizeName));
  const groups = new Map<string, { county: CountyFeed; contest: ParsedContest }[]>();
  const singles: { county: CountyFeed; contest: ParsedContest }[] = [];
  for (const entry of locals) {
    const key = splitSet.has(normalizeName(entry.contest.name)) ? null : localGroupKey(entry.contest, mergeSet);
    if (!key) {
      singles.push(entry);
      continue;
    }
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }

  for (const [key, members] of groups) {
    const countySlugs = members.map((m) => m.county.slug);
    if (members.length === 1 || new Set(countySlugs).size !== members.length) {
      if (members.length > 1) warnings.push(`same candidates in one county twice, not merged: "${members[0].contest.name}"`);
      singles.push(...members);
      continue;
    }
    const ordered = [...members].sort((a, b) => a.county.slug.localeCompare(b.county.slug));
    // Name from the county casting the most votes; key from the candidates,
    // so it doesn't move as counts change.
    const named = [...ordered].sort((a, b) => total(b.contest.options) - total(a.contest.options))[0];
    const names = [...new Set(ordered.map((m) => m.contest.name))];
    if (names.length > 1) warnings.push(`merged across counties under different names: ${names.map((n) => `"${n}"`).join(" / ")}`);
    contests.push({
      key: `local:${stableHash(key)}`,
      scope: "multi_county",
      sourceContestIds: ordered.map((m) => m.contest.sourceId),
      name: named.contest.name,
      rawName: named.contest.rawName,
      voteFor: named.contest.voteFor,
      isReferendum: named.contest.isReferendum,
      primaryParty: named.contest.primaryParty,
      countySlug: null,
      county: null,
      counties: ordered.map((m) => m.county.slug),
      reportingUnits: ordered.reduce((s, m) => s + m.contest.reportingUnits, 0),
      totalUnits: ordered.reduce((s, m) => s + m.contest.totalUnits, 0),
      asOf: latest(ordered.map((m) => m.contest.asOf)),
      isOfficial: ordered.every((m) => m.county.feed.election.isOfficialResults),
      options: sumOptions(ordered.map((m) => m.contest.options)),
      areas: ordered.map((m) => areaRow(m.county, m.contest)),
      merged: true,
      unlinkedCounties: [],
    });
  }

  const questionCounties = new Map<string, string[]>();
  for (const { county, contest } of singles) {
    if (!contest.isReferendum) continue;
    const name = normalizeName(contest.name);
    questionCounties.set(name, [...(questionCounties.get(name) ?? []), county.slug]);
  }
  for (const [name, slugs] of questionCounties) {
    if (slugs.length > 1 && !splitSet.has(name)) {
      warnings.push(`ballot question "${name}" appears in ${slugs.length} counties and was not merged (${slugs.join(", ")}); add it to overrides.merge if it is one question`);
    }
  }

  for (const { county, contest } of singles) {
    contests.push({
      key: `${county.slug}:${slugify(contest.name)}`,
      scope: "county",
      sourceContestIds: [contest.sourceId],
      name: contest.name,
      rawName: contest.rawName,
      voteFor: contest.voteFor,
      isReferendum: contest.isReferendum,
      primaryParty: contest.primaryParty,
      countySlug: county.slug,
      county: county.name,
      counties: [county.slug],
      reportingUnits: contest.reportingUnits,
      totalUnits: contest.totalUnits,
      asOf: contest.asOf,
      isOfficial: county.feed.election.isOfficialResults,
      options: contest.options,
      areas: [],
      merged: false,
      unlinkedCounties: [],
    });
  }

  resolveKeyCollisions(contests, warnings);
  return { contests, warnings };
}

/**
 * Contests that share a name share a base key: a party's primary for the same
 * seat ("State Senate - District 7" once per party), or a regular and a
 * special election for one office. Every member of a colliding group gets a
 * suffix taken from its content, so the key never depends on feed order and
 * the JSON API and media export (different contest ids) agree: the primary
 * party when each member has a different one, else the candidate set. Only
 * when both tie does the source id decide, which the media export can't
 * reproduce, so that case is reported.
 */
export function resolveKeyCollisions(contests: AssembledContest[], warnings: string[]): void {
  const byKey = new Map<string, AssembledContest[]>();
  for (const c of contests) byKey.set(c.key, [...(byKey.get(c.key) ?? []), c]);
  for (const [key, group] of byKey) {
    if (group.length < 2) continue;
    const parties = group.map((c) => (c.primaryParty ? slugify(c.primaryParty) : ""));
    const candidates = group.map((c) =>
      stableHash(
        c.options
          .filter((o) => !o.isWriteIn)
          .map((o) => normalizeName(o.name))
          .sort()
          .join("|"),
      ).slice(0, 8),
    );
    const distinct = (tags: string[]) => tags.every(Boolean) && new Set(tags).size === tags.length;
    if (distinct(parties)) group.forEach((c, i) => (c.key = `${key}-${parties[i]}`));
    else if (distinct(candidates)) group.forEach((c, i) => (c.key = `${key}~c${candidates[i]}`));
    else {
      group.forEach((c) => (c.key = `${key}~${c.sourceContestIds[0]}`));
      warnings.push(`contests named alike with the same candidates: ${key}; keyed by source id, so the media-export fallback can't match them`);
    }
  }
}
