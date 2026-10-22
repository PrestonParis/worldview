// Georgia SOS results payloads (results.sos.ga.gov, Enhanced Voting) →
// normalized contests. The payload shape is documented in
// docs/elections/ga-close-races.md, "Source"; fixtures live in ./fixtures.

import type { ElectionKind, ParsedContest, ParsedElectionHeader, ParsedFeed, ParsedLocality, ParsedOption } from "./types.ts";

type LangText = { languageId?: string; text?: string }[] | string | null | undefined;

/* eslint-disable @typescript-eslint/no-explicit-any -- untyped vendor JSON */
type Raw = any;

export function text(value: LangText): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return (value.find((v) => v.languageId === "en") ?? value[0])?.text ?? "";
}

const PARTY_CODES: Record<string, string> = {
  REP: "R",
  REPUBLICAN: "R",
  DEM: "D",
  DEMOCRAT: "D",
  DEMOCRATIC: "D",
  LIB: "L",
  LIBERTARIAN: "L",
  IND: "I",
  INDEPENDENT: "I",
  GRN: "G",
  GREEN: "G",
  NP: "NP",
  NONPARTISAN: "NP",
};

export function partyCode(value: string | null | undefined): string | null {
  const key = (value ?? "").trim().toUpperCase();
  if (!key) return null;
  return PARTY_CODES[key] ?? key;
}

/** "State House … - District 106/ Para Representante …" → the English half. */
export function englishName(raw: string): string {
  const cut = raw.indexOf("/ ");
  return (cut > 0 ? raw.slice(0, cut) : raw).replace(/\s+/g, " ").trim();
}

/** `Mack Jackson (I) (Dem)` → name, incumbent, party. */
export function parseCandidateName(raw: string): { name: string; incumbent: boolean; party: string | null } {
  let name = raw.replace(/\s+/g, " ").trim();
  let incumbent = false;
  let party: string | null = null;
  for (;;) {
    const match = name.match(/\s*\(([^()]+)\)\s*$/);
    if (!match) break;
    const tag = match[1].trim();
    if (/^I$/i.test(tag)) incumbent = true;
    else if (PARTY_CODES[tag.toUpperCase()]) party = partyCode(tag);
    else break;
    name = name.slice(0, match.index).trim();
  }
  return { name, incumbent, party };
}

export function parseVoteFor(value: LangText): number {
  const n = Number(text(value).match(/\d+/)?.[0]);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

const YES_NO = /^(yes|no|si|sí)\b/i;

export function looksLikeReferendum(optionNames: string[]): boolean {
  return optionNames.length === 2 && optionNames.every((n) => YES_NO.test(n.trim()));
}

/** "US Senate - Rep" → "R" when the election is a primary. */
export function primaryPartyFromName(name: string): string | null {
  const match = name.match(/\s-\s(Rep|Dem|Lib|Grn|NP)$/i);
  return match ? partyCode(match[1]) : null;
}

export function electionKind(name: string): ElectionKind {
  if (/recount/i.test(name)) return "recount";
  if (/runoff/i.test(name)) return "runoff";
  if (/primary/i.test(name)) return "primary";
  if (/general/i.test(name)) return "general";
  if (/special/i.test(name)) return "special";
  return "general";
}

function parseOption(raw: Raw): ParsedOption {
  const { name, incumbent, party } = parseCandidateName(text(raw.name));
  const votesByMethod: Record<string, number> = {};
  for (const group of raw.groupResults ?? []) {
    const label = text(group.groupName);
    if (label) votesByMethod[label] = Number(group.voteCount) || 0;
  }
  return {
    sourceId: String(raw.id),
    name,
    party: partyCode(raw.party?.abbreviation) ?? party,
    incumbent,
    isWriteIn: Boolean(raw.isWriteIn),
    votes: Number(raw.voteCount) || 0,
    votesByMethod,
  };
}

export function parseContest(raw: Raw, isPrimary = false): ParsedContest {
  const rawName = text(raw.name);
  const name = englishName(rawName);
  const options = (raw.summaryResults?.ballotOptions ?? []).map(parseOption);
  const primaryParty = isPrimary ? (partyCode(raw.partyName) ?? primaryPartyFromName(name)) : null;
  if (primaryParty) for (const option of options) option.party ??= primaryParty;
  return {
    sourceId: String(raw.id),
    parentId: raw.parentId ? String(raw.parentId) : null,
    name,
    rawName,
    voteFor: parseVoteFor(raw.voteFor),
    isReferendum: looksLikeReferendum(options.filter((o: ParsedOption) => !o.isWriteIn).map((o: ParsedOption) => o.name)),
    primaryParty: primaryParty === "NP" ? null : primaryParty,
    reportingUnits: Number(raw.reportingStatus?.reportingUnits) || 0,
    totalUnits: Number(raw.reportingStatus?.totalUnits) || 0,
    asOf: raw.reportingStatus?.asOf ?? null,
    options,
  };
}

export function parseElectionHeader(raw: Raw): ParsedElectionHeader {
  return {
    id: String(raw?.id ?? ""),
    jurisdictionId: String(raw?.jurisdictionId ?? "").toLowerCase(),
    name: text(raw?.name),
    electionDate: String(raw?.electionDate ?? ""),
    isOfficialResults: Boolean(raw?.isOfficialResults),
    isPrimary: Boolean(raw?.isPrimary),
    asOf: raw?.asOf ?? null,
    lastUpdated: raw?.lastUpdated ?? null,
  };
}

export function parseFeed(raw: Raw): ParsedFeed {
  const election = parseElectionHeader(raw.election);
  const localities: ParsedLocality[] = (raw.jurisdiction?.childLocalities ?? []).map((c: Raw) => ({
    id: String(c.id).toLowerCase(),
    shortName: String(c.shortName),
    name: text(c.name),
    percentReporting: c.percentReporting == null ? null : Number(c.percentReporting),
  }));
  return {
    jurisdiction: String(raw.jurisdiction?.shortName ?? ""),
    jurisdictionName: text(raw.jurisdiction?.name),
    election,
    localities,
    localityElections: (raw.localityElections ?? []).map(parseElectionHeader),
    contests: (raw.ballotItems ?? []).map((item: Raw) => parseContest(item, election.isPrimary)),
  };
}

/** The election list on /jurisdictions/Georgia. */
export function parseElectionList(raw: Raw): { id: string; date: string; name: string; kind: ElectionKind }[] {
  return (raw?.elections ?? []).map((e: Raw) => {
    const name = text(e.name).trim();
    return { id: String(e.publicElectionId), date: String(e.electionDate), name, kind: electionKind(name) };
  });
}
