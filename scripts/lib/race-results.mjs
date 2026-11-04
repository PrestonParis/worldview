// Parsers and rules for scripts/sync-race-results.mjs: the New York Times
// results feed (AP data plus some NYT calls), the call rule that cross-checks
// it against Wikipedia, and name matching. Pure; unit-tested in
// race-results.test.mjs.

const OFFICE_PREFIX = { S: "senate", G: "governor", H: "house" };
// One-seat states; the feed calls their seat "District 1".
const AT_LARGE = new Set(["AK", "DE", "ND", "SD", "VT", "WY"]);

// "GA-G-S-2026-11-03" -> { prefix: "senate", key: "GA" }
// "FL-S_W-S-2026-11-03" -> { prefix: "senate", key: "FL:special" }
// "LA-L-H-5-2026-11-03" -> { prefix: "house", key: "LA-05" }
// null for rows that are not one race (the national "US-G-H" House total).
export function raceKeyFromNytId(nytId, type = "") {
  const match = String(nytId).match(/^([A-Z]{2})-([A-Z_]+)-([SGH])(?:-(\d+))?-\d{4}-\d{2}-\d{2}$/);
  if (!match || match[1] === "US") return null;
  const [, state, , officeCode, district] = match;
  const prefix = OFFICE_PREFIX[officeCode];
  if (officeCode === "H") {
    if (!district) return null;
    return { prefix, key: `${state}-${AT_LARGE.has(state) ? "AL" : district.padStart(2, "0")}` };
  }
  return { prefix, key: /special/i.test(type) ? `${state}:special` : state };
}

// Ballot lines that are not a person, or not one worth a row.
const isWriteIn = (id, last) => /writein|write-in|total_writeins|none of these/i.test(`${id} ${last}`);

// One feed race -> what the sync needs. Votes come from the statewide (or, for
// a district, whole-race) reporting unit, always the first listed.
export function parseNytRace(race) {
  const place = raceKeyFromNytId(race.nyt_id, race.type);
  if (!place) return null;
  const unit = race.reporting_units?.find((item) => item.level === "state") ?? race.reporting_units?.[0];
  if (!unit) return null;
  const candidates = (unit.candidates ?? []).map((candidate) => {
    const meta = race.candidate_metadata?.[candidate.nyt_id] ?? {};
    const last = String(meta.last_name ?? "").replace(/\s*\(write-in\)\s*$/i, "");
    return {
      id: candidate.nyt_id,
      name: [meta.first_name, last].filter(Boolean).join(" "),
      first: meta.first_name ?? "",
      last,
      party: meta.party?.nyt_id ?? "",
      partyName: meta.party?.name ?? "",
      incumbent: meta.incumbent === true,
      votes: candidate.votes?.total ?? 0,
      writeIn: isWriteIn(candidate.nyt_id, String(meta.last_name ?? "")),
    };
  });
  const won = race.outcome?.won ?? [];
  const callStatus = race.race_call_status === "called" && won.length ? "called" : race.race_call_status === "runoff" ? "runoff" : "counting";
  return {
    ...place,
    nytId: race.nyt_id,
    callStatus,
    winnerId: callStatus === "called" ? won[0] : null,
    runoffIds: race.outcome?.advanced_to_runoff ?? [],
    calledBy: race.outcome?.called_by ?? [],
    // null when the feed does not say, as for Louisiana's open primaries.
    gained: race.outcome?.gained ?? null,
    certified: race.certified === true,
    uncontested: race.uncontested === true,
    rankedChoice: race.tabulation_method === "ranked-choice",
    reportingPct: unit.eevp ?? null,
    totalVotes: unit.total_votes ?? null,
    asOf: unit.provider_updated_at ?? race.updated_at ?? null,
    candidates,
  };
}

// --------------------------------------------------------------- names

// "Dan J. Sullivan Jr." -> { first: "dan", last: "sullivan", full: "dan j sullivan" }
export function nameParts(name) {
  const tokens = String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z\s'-]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !/^(jr|sr|ii|iii|iv)$/.test(token));
  // FEC-style "LAST, FIRST" was already flipped on import, so first/last are
  // the outer tokens. `full` keeps middle names and initials: a match across
  // the whole graph must not merge namesakes (Dan J. vs Dan S. Sullivan);
  // within one race, `first`/`last` are enough.
  return { first: tokens[0] ?? "", last: tokens.at(-1) ?? "", full: tokens.join(" ") };
}

export function samePerson(a, b) {
  const x = nameParts(a);
  const y = nameParts(b);
  if (!x.last || x.last !== y.last) return false;
  return x.first.startsWith(y.first.slice(0, 3)) || y.first.startsWith(x.first.slice(0, 3));
}

const PARTY_GROUP = { DEM: "D", GOP: "R" };
const letterOf = (party) => {
  const text = String(party ?? "").toLowerCase();
  if (/^(democrat|democratic|dfl)\b/.test(text)) return "D";
  if (/^republican\b/.test(text)) return "R";
  return null;
};

// True when two strings differ by at most one inserted, dropped or swapped-out
// character ("Rodriguez" / "Rodriquez").
function oneEditApart(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i += 1;
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i) || a.slice(i) === b.slice(i + 1);
}

// A feed candidate -> one of the race's nominee rows ({ name, party, incumbent }).
// Surname first, since nicknames defeat first-name checks (Mike / Michael);
// when several rows share it, the incumbent flag, first name, then party must
// settle it. A surname one letter off counts only with the same first name
// and party, for spelling differences between sources. Returns null rather
// than guess.
export function matchNominee(candidate, nominees) {
  const last = nameParts(candidate.last || candidate.name).last;
  if (!last) return null;
  const letter = PARTY_GROUP[candidate.party];
  const sameLast = nominees.filter((row) => nameParts(row.name).last === last);
  if (sameLast.length === 1) return sameLast[0];
  if (sameLast.length === 0) {
    const first = nameParts(candidate.name).first;
    const near = nominees.filter((row) => {
      const parts = nameParts(row.name);
      return parts.first === first && letter && letterOf(row.party) === letter && oneEditApart(parts.last, last);
    });
    return near.length === 1 ? near[0] : null;
  }
  if (candidate.incumbent) {
    const sitting = sameLast.filter((row) => row.incumbent);
    if (sitting.length === 1) return sitting[0];
  }
  const byFirst = sameLast.filter((row) => samePerson(row.name, candidate.name));
  if (byFirst.length === 1) return byFirst[0];
  // One person imported twice (an FEC row and a Wikipedia row).
  if (byFirst.length > 1 && new Set(byFirst.map((row) => nameParts(row.name).full)).size === 1) return byFirst[0];
  const byParty = (byFirst.length ? byFirst : sameLast).filter((row) => letter && letterOf(row.party) === letter);
  return byParty.length === 1 ? byParty[0] : null;
}

// --------------------------------------------------------------- calls

// The call rule. Only the feed can call a race. Wikipedia can block a call by
// naming someone else; its own calls are reported, not shown, so one bad edit
// can't publish a winner. `wikiWinner` is a name or null.
export function decideCall(race, wikiWinner) {
  const winner = race.winnerId ? race.candidates.find((candidate) => candidate.id === race.winnerId) : null;
  if (race.callStatus !== "called") {
    return { callStatus: race.callStatus, winnerId: null, issue: wikiWinner ? "wiki-only" : null };
  }
  if (!winner) return { callStatus: "counting", winnerId: null, issue: "winner-not-in-feed" };
  if (wikiWinner && nameParts(wikiWinner).last !== nameParts(winner.last || winner.name).last) {
    return { callStatus: "counting", winnerId: null, issue: "conflict" };
  }
  return { callStatus: "called", winnerId: winner.id, issue: wikiWinner ? null : "feed-only" };
}

// A truncated or failed feed must not rewrite results: refuses unless each
// office returned nearly all its scaffolded races.
export function assertFeedComplete(prefix, parsedCount, expected) {
  if (expected > 0 && parsedCount < expected * 0.95) {
    throw new Error(`${prefix}: feed returned ${parsedCount} races, expected about ${expected}; nothing written`);
  }
}

// Feed flip flag, else Wikipedia's "Republican gain." wording. Null until a
// race is called, or when neither source says.
export function decideFlip(callStatus, gained, wikiStatus) {
  if (callStatus !== "called") return null;
  if (gained != null) return gained;
  if (/\bgain\b/i.test(wikiStatus ?? "")) return true;
  if (/\bhold\b|re-elected/i.test(wikiStatus ?? "")) return false;
  return null;
}

// Seats the feed credits to a party without a call: every candidate with real
// support is in one party, as in California's same-party general elections.
export function onePartyLeft(race) {
  const real = race.candidates.filter((candidate) => !candidate.writeIn && candidate.votes > 0);
  const parties = new Set(real.map((candidate) => candidate.party));
  return real.length > 1 && parties.size === 1 ? [...parties][0] : null;
}
