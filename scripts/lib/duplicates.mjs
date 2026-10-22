// Rules for finding one person held as several entities
// (scripts/merge-entities.mjs --people). Pure, so they're unit-tested.
//
// Two records are the same person when their names agree after
// normalization (order, punctuation, suffixes, middle initials, common
// nicknames) AND they share a state from any source. A group is refused
// when it holds two different Bioguide or Open States ids (two members, two
// legislators) or names whose middle initials disagree.

const TITLES = new Set(["mr", "mrs", "ms", "dr", "hon", "md", "esq", "phd"]);
// Generational suffixes tell a father from a son, so two names that both
// carry one must carry the same.
const GENERATIONS = { jr: "jr", sr: "sr", ii: "ii", "2nd": "ii", iii: "iii", "3rd": "iii", iv: "iv" };

// Nickname -> given name, for the forms FEC filings and rosters disagree on.
const NICKNAMES = {
  joe: "joseph", bill: "william", will: "william", billy: "william", bob: "robert", rob: "robert", bobby: "robert",
  mike: "michael", jim: "james", jimmy: "james", tom: "thomas", tommy: "thomas", dan: "daniel", danny: "daniel",
  dave: "david", chris: "christopher", rick: "richard", dick: "richard", rich: "richard", steve: "stephen",
  steven: "stephen", tim: "timothy", ken: "kenneth", ron: "ronald", don: "donald", chuck: "charles",
  charlie: "charles", pat: "patrick", matt: "matthew", andy: "andrew", tony: "anthony", nick: "nicholas",
  greg: "gregory", jeff: "jeffrey", jerry: "gerald", larry: "lawrence", sam: "samuel", ben: "benjamin",
  ed: "edward", ted: "edward", eddie: "edward", fred: "frederick", frank: "francis", hank: "henry",
  jack: "john", johnny: "john", jon: "jonathan", josh: "joshua", kate: "katherine", katie: "katherine",
  kathy: "katherine", liz: "elizabeth", beth: "elizabeth", betsy: "elizabeth", sue: "susan", jenny: "jennifer",
  jen: "jennifer", abby: "abigail", debbie: "deborah", deb: "deborah", pete: "peter", ray: "raymond",
  doug: "douglas", phil: "philip", al: "albert", gene: "eugene", vince: "vincent", walt: "walter",
};

const STATE_NAMES = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT",
  delaware: "DE", "district of columbia": "DC", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME",
  maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
  "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN",
  texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY", "puerto rico": "PR", guam: "GU", "american samoa": "AS",
  "u.s. virgin islands": "VI", "northern mariana islands": "MP",
};
const ABBRS = new Set(Object.values(STATE_NAMES));

// "TX", "Texas", "Governor of Texas" -> "TX"; national ("US") and unknown -> null.
export function stateCode(value) {
  if (!value) return null;
  const v = String(value).trim();
  if (ABBRS.has(v.toUpperCase())) return v.toUpperCase();
  const lower = v.toLowerCase();
  if (STATE_NAMES[lower]) return STATE_NAMES[lower];
  const of = lower.match(/\bof (the )?([a-z. ]+?)\s*(\(|$)/)?.[2];
  return of && STATE_NAMES[of] ? STATE_NAMES[of] : null;
}

// A name as first + last + middle initials, nicknames resolved.
// "BIDEN, JOSEPH R JR" and "Joseph R. Biden Jr." -> { first: "joseph", last: "biden", middles: ["r"] }.
export function parseName(raw) {
  let name = String(raw ?? "").trim();
  const quoted = name.match(/["“”']([A-Za-z]+)["“”']/)?.[1];
  name = name.replace(/["“”'][A-Za-z]+["“”']/g, " ").replace(/\([^)]*\)/g, " ");
  if (name.includes(",")) {
    const [last, rest] = name.split(/,(.*)/s);
    name = `${rest} ${last}`;
  }
  const all = name
    .toLowerCase()
    .replace(/[.’]/g, "")
    .split(/[\s,]+/)
    .filter((t) => t && !TITLES.has(t));
  const generation = all.map((t) => GENERATIONS[t]).find(Boolean) ?? null;
  const tokens = all.filter((t) => !GENERATIONS[t]);
  if (tokens.length < 2) return null;
  const given = quoted ? quoted.toLowerCase() : tokens[0];
  const first = NICKNAMES[given] ?? given;
  const last = tokens[tokens.length - 1];
  const middles = tokens.slice(1, -1).map((t) => t[0]);
  return { first, last, middles, generation, key: `${first} ${last}` };
}

// Middle initials conflict only when both names carry them and none match.
// Generational suffixes conflict the same way.
export function middlesAgree(a, b) {
  if (a.generation && b.generation && a.generation !== b.generation) return false;
  if (!a.middles.length || !b.middles.length) return true;
  return a.middles.some((m) => b.middles.includes(m));
}

// Groups records (each { id, name, states: Set, bioguide, openstates, ...})
// into same-person clusters of 2+. Records with no state join a cluster only
// through `noStateOk(record, other)`.
export function clusterPeople(records, { noStateOk = () => false } = {}) {
  const byKey = new Map();
  for (const r of records) {
    const parsed = parseName(r.name);
    if (!parsed) continue;
    (byKey.get(parsed.key) ?? byKey.set(parsed.key, []).get(parsed.key)).push({ ...r, parsed });
  }
  const clusters = [];
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    const parent = group.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (!middlesAgree(a.parsed, b.parsed)) continue;
        const shared = [...a.states].some((s) => b.states.has(s));
        const stateless = (!a.states.size && noStateOk(a, b)) || (!b.states.size && noStateOk(b, a));
        if (shared || stateless) parent[find(i)] = find(j);
      }
    }
    const parts = new Map();
    group.forEach((r, i) => (parts.get(find(i)) ?? parts.set(find(i), []).get(find(i))).push(r));
    for (const members of parts.values()) if (members.length > 1) clusters.push(members);
  }
  return clusters;
}

// Why a cluster can't be merged, or null when it can.
export function clusterConflict(members) {
  for (const scheme of ["bioguide", "openstates", "wikidata"]) {
    const ids = new Set(members.map((m) => m[scheme]).filter(Boolean));
    if (ids.size > 1) return `${ids.size} different ${scheme} ids`;
  }
  // A member of Congress and a current state official share a name more
  // often than a career (Wayne Owens and his son Doug): only one Wikidata
  // QID on both joins them — the official's own, or the one their Open
// States Wikipedia link resolves to (`articleQid`).
  const member = members.find((m) => m.bioguide);
  const official = members.find((m) => m.openstates);
  const officialQid = official?.wikidata ?? official?.articleQid;
  // Statewide executives (`executive`) are few enough that name and state
  // hold: the governors who served in Congress.
  if (member && official && !official.executive && (!member.wikidata || member.wikidata !== officialQid)) {
    return "member and state legislator not linked by Wikidata";
  }
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      if (!middlesAgree(members[i].parsed, members[j].parsed)) return "middle initials or suffixes differ";
    }
  }
  return null;
}
