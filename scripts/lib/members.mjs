// Pure helpers for scripts/backfill-members.mjs — Congress date math and
// name matching, with no I/O so scripts/lib/members.test.mjs can cover them.
// If Phase 1's shared import modules land, this is the logic they'd absorb.

// The Nth modern Congress convenes on Jan 3 of the odd year (2*N + 1787)
// and runs two years. 118th: 2023-01-03 .. 2025-01-03. (Congresses before
// the 20th Amendment convened in March/December; this project only targets
// modern ones, so the simple formula is fine.)
export function congressWindow(congress) {
  const startYear = 2 * congress + 1787;
  return { start: `${startYear}-01-03`, end: `${startYear + 2}-01-03` };
}

// A congress-legislators term carries ISO `start` / `end` strings. It
// overlaps a window when it starts before the window ends and ends strictly
// after the window opens — so the prior term, whose `end` equals the next
// window's `start`, is not counted.
export function termOverlapsWindow(term, window) {
  return term.start < window.end && term.end > window.start;
}

export function servedInCongresses(terms, congresses) {
  const windows = congresses.map(congressWindow);
  return (terms ?? []).some((term) =>
    windows.some((w) => termOverlapsWindow(term, w)),
  );
}

// The most recent term overlapping the target range — the source of the
// member's party/state/chamber. Falls back to the latest term overall when
// none overlap (e.g. a member who left before the range).
export function latestRelevantTerm(terms, congresses) {
  const windows = congresses.map(congressWindow);
  const list = terms ?? [];
  const inRange = list.filter((term) =>
    windows.some((w) => termOverlapsWindow(term, w)),
  );
  const pool = inRange.length > 0 ? inRange : list;
  return pool.reduce(
    (latest, term) => (!latest || term.start > latest.start ? term : latest),
    null,
  );
}

export function chamberOf(termType) {
  if (termType === "sen") return "Senate";
  if (termType === "rep") return "House";
  return "";
}

export function displayName(legislator) {
  const n = legislator?.name ?? {};
  if (n.official_full) return n.official_full;
  return [n.first, n.middle, n.last, n.suffix].filter(Boolean).join(" ");
}

// Lowercased, punctuation-stripped tokens — the same normalization
// scripts/import-fec-donors.mjs uses, defined once here so it's tested.
export function normalizeNameTokens(name) {
  return (name ?? "")
    .toLowerCase()
    .replace(/[.,'’]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

// Conservative name match for linking an existing hand-added politician to
// a legislator: the entity name must contain both the legislator's first
// and last name tokens. The caller still refuses to link when more than
// one entity matches, so a false positive here can't silently mislink.
export function nameLooksLikeMember(entityName, legislatorName) {
  const entityTokens = new Set(normalizeNameTokens(entityName));
  const legTokens = normalizeNameTokens(legislatorName);
  const first = legTokens[0];
  const last = legTokens[legTokens.length - 1];
  if (!first || !last) return false;
  return entityTokens.has(first) && entityTokens.has(last);
}

// The metadata JSON this script stamps onto member entities. Marked with
// `source` so a re-run can tell its own writes apart from hand-curated
// metadata and leave the latter untouched.
export function buildMemberMetadata(legislator, congresses) {
  const term = latestRelevantTerm(legislator.terms, congresses) ?? {};
  return {
    source: "unitedstates/congress-legislators",
    party: term.party ?? "",
    state: term.state ?? "",
    chamber: chamberOf(term.type),
    district:
      term.type === "rep" && term.district != null ? String(term.district) : "",
    congresses: [...congresses],
    terms: (legislator.terms ?? []).map((t) => ({
      type: t.type,
      start: t.start,
      end: t.end,
      party: t.party ?? "",
      state: t.state ?? "",
      district: t.district ?? null,
    })),
  };
}

// `--congresses=` accepts a comma list and/or inclusive ranges: "95-119",
// "118,119", "100-105,118".
export function parseCongressList(spec) {
  return [
    ...new Set(
      String(spec ?? "")
        .split(",")
        .flatMap((part) => {
          const [a, b] = part.trim().split("-").map((s) => Number(s.trim()));
          if (!Number.isInteger(a) || a <= 0) return [];
          if (b === undefined) return [a];
          if (!Number.isInteger(b) || b < a) return [];
          return Array.from({ length: b - a + 1 }, (_, i) => a + i);
        }),
    ),
  ].sort((x, y) => x - y);
}

// Every external id the crosswalk carries, as first-class entity properties
// — the join keys the Voteview / FEC / Wikidata / Open States importers use
// instead of name matching. Empty ids are omitted (never written as "").
export function crosswalkIds(legislator) {
  const id = legislator?.id ?? {};
  const str = (v) => (v === undefined || v === null || v === "" ? undefined : String(v));
  const out = {
    icpsrId: str(id.icpsr),
    wikidataId: str(id.wikidata),
    govtrackId: str(id.govtrack),
    opensecretsId: str(id.opensecrets),
    votesmartId: str(id.votesmart),
    ballotpediaId: str(id.ballotpedia),
    thomasId: str(id.thomas),
    lisId: str(id.lis),
    fecCandidateIds: Array.isArray(id.fec) && id.fec.length ? id.fec.map(String) : undefined,
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
}

// Profile URLs from the social-media file + latest term + the public-domain
// unitedstates/images portrait. The caller only fills fields that are blank,
// so hand-curated values always win.
export function profileUrls(legislator, social) {
  const s = social?.social ?? {};
  const term = (legislator?.terms ?? []).at(-1) ?? {};
  const bioguide = legislator?.id?.bioguide;
  return {
    websiteUrl: term.url ?? "",
    xUrl: s.twitter ? `https://x.com/${s.twitter}` : "",
    facebookUrl: s.facebook ? `https://www.facebook.com/${s.facebook}` : "",
    instagramUrl: s.instagram ? `https://www.instagram.com/${s.instagram}` : "",
    youtubeUrl: s.youtube_id
      ? `https://www.youtube.com/channel/${s.youtube_id}`
      : s.youtube
        ? `https://www.youtube.com/${s.youtube}`
        : "",
    imageUrl: bioguide ? `https://unitedstates.github.io/images/congress/450x550/${bioguide}.jpg` : "",
  };
}
