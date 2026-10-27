// The SOS media export (`/cdn/results/Georgia/export-{id}.json`) is the
// fallback when the JSON API fails. Its shape differs: plain-string names,
// numeric voteFor, short numeric contest ids shared between the state item
// and each county's slice of it, and precinct counts instead of the API's
// reporting units. This adapter rebuilds API-shaped payloads so the rest of
// the pipeline is unchanged; contest keys are names (see merge.ts), so rows
// written from either source line up.

import { parseFeed } from "./parse.ts";
import type { CountyFeed } from "./merge.ts";
import type { ParsedFeed } from "./types.ts";

/* eslint-disable @typescript-eslint/no-explicit-any -- untyped vendor JSON */
type Raw = any;

const lang = (text: string) => [{ languageId: "en", text }];

function slugFor(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-ga`;
}

function item(raw: Raw, { parentIds, idPrefix, units }: { parentIds: Set<string>; idPrefix: string; units?: { reporting: number; total: number } }) {
  const id = String(raw.id);
  return {
    id: `${idPrefix}${id}`,
    parentId: parentIds.has(id) ? `state:${id}` : null,
    name: lang(String(raw.name ?? "")),
    voteFor: lang(`Vote for ${Number(raw.voteFor) || 1}`),
    contestType: raw.contestType,
    reportingStatus: {
      reportingUnits: units?.reporting ?? (Number(raw.precinctsReporting) || 0),
      totalUnits: units?.total ?? (Number(raw.precinctsParticipating) || 0),
      asOf: null,
    },
    summaryResults: {
      ballotOptions: (raw.ballotOptions ?? []).map((o: Raw) => ({
        id: String(o.id),
        name: lang(String(o.name ?? "")),
        voteCount: Number(o.voteCount) || 0,
        party: o.politicalParty ? { abbreviation: o.politicalParty } : null,
        isWriteIn: /write-?in/i.test(String(o.name ?? "")),
        groupResults: (o.groupResults ?? []).map((g: Raw) => ({ groupName: lang(String(g.groupName)), voteCount: g.voteCount })),
      })),
    },
  };
}

export function parseMediaExport(raw: Raw, { isOfficial = false, isPrimary = false } = {}): { state: ParsedFeed; counties: CountyFeed[] } {
  const stateItems: Raw[] = raw.results?.ballotItems ?? [];
  const stateIds = new Set(stateItems.map((b) => String(b.id)));
  const localResults: Raw[] = raw.localResults ?? [];

  // State units = counties carrying the contest / counties fully reported, the same unit the API uses.
  const units = new Map<string, { reporting: number; total: number }>();
  for (const county of localResults) {
    for (const b of county.ballotItems ?? []) {
      const id = String(b.id);
      if (!stateIds.has(id)) continue;
      const u = units.get(id) ?? { reporting: 0, total: 0 };
      u.total += 1;
      if (Number(b.precinctsParticipating) > 0 && Number(b.precinctsReporting) >= Number(b.precinctsParticipating)) u.reporting += 1;
      units.set(id, u);
    }
  }

  const header = (name: string) => ({ name: lang(name), electionDate: raw.electionDate, isOfficialResults: isOfficial, isPrimary, asOf: raw.createdAt, lastUpdated: raw.createdAt });
  const state = parseFeed({
    jurisdiction: { shortName: "Georgia", name: lang("Georgia"), childLocalities: localResults.map((c) => ({ id: c.id, shortName: slugFor(c.name), name: lang(c.name) })) },
    election: { ...header(raw.electionName), id: "media-export", jurisdictionId: raw.results?.id },
    localityElections: [],
    ballotItems: stateItems.map((b) => item(b, { parentIds: new Set(), idPrefix: "state:", units: units.get(String(b.id)) })),
  });
  const counties = localResults.map((county) => ({
    slug: slugFor(county.name),
    name: String(county.name),
    feed: parseFeed({
      jurisdiction: { shortName: slugFor(county.name), name: lang(county.name) },
      election: { ...header(raw.electionName), id: `media-export:${county.id}`, jurisdictionId: county.id },
      ballotItems: (county.ballotItems ?? []).map((b: Raw) => item(b, { parentIds: stateIds, idPrefix: `${county.id}:` })),
    }),
  }));
  return { state, counties };
}
