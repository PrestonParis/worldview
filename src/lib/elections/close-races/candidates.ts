// Contest options → candidate registrations (GA campaign finance commission,
// FEC), for public campaign contacts on Writ's close-races report. Pure; the
// fetching is scripts/sync-ga-candidates.mjs.
//
// A match must first agree on scope (office family, district, county), and
// only then on name, because registries and ballots spell names differently
// ("Jon Ossoff" / "OSSOFF, T. JONATHAN", "Mo Ivory" / "Ivory, Noraima" with
// ballot name "Ivory, Mo"). Within that scope:
//   verified — last name and a given name (or nickname, or ballot name) agree,
//              and exactly one person does;
//   probable — the last name is unique in scope but no given name agrees;
//   anything with more than one person left is ambiguous and not matched.

export type OfficeFamily =
  | "us_senate"
  | "us_house"
  | "governor"
  | "lt_governor"
  | "secretary_of_state"
  | "attorney_general"
  | "agriculture"
  | "insurance"
  | "labor"
  | "school_superintendent"
  | "psc"
  | "state_senate"
  | "state_house"
  | "supreme_court"
  | "court_of_appeals"
  | "superior_court"
  | "state_court_judge"
  | "probate_judge"
  | "magistrate"
  | "juvenile_judge"
  | "district_attorney"
  | "solicitor"
  | "clerk"
  | "sheriff"
  | "tax_commissioner"
  | "coroner"
  | "surveyor"
  | "soil_water"
  | "county_commission_chair"
  | "county_commission"
  | "school_board"
  | "mayor"
  | "city_council";

// Ordered: the first match wins, so specific offices come before the
// general ones they contain ("Clerk of Superior Court" before "Superior
// Court", "Tax Commissioner" before "County Commissioner").
const FAMILIES: [OfficeFamily, RegExp][] = [
  ["us_senate", /\b(us|u\.s\.|united states) senat/],
  ["us_house", /\b(us|u\.s\.|united states) (house|representative)|\bcongress/],
  ["lt_governor", /lieutenant governor|\blt\.? governor/],
  ["governor", /\bgovernor\b/],
  ["secretary_of_state", /secretary of state/],
  ["attorney_general", /attorney general/],
  ["agriculture", /agriculture/],
  ["insurance", /insurance/],
  ["labor", /commissioner of labor|labor commissioner/],
  ["school_superintendent", /school superintendent/],
  ["psc", /public service commission|\bpsc\b/],
  ["state_senate", /state senat|\b(ga|georgia) senate/],
  ["state_house", /state house|state representative|\b(ga|georgia) house/],
  ["clerk", /\bclerk\b/],
  ["tax_commissioner", /tax commissioner/],
  ["supreme_court", /supreme court/],
  ["court_of_appeals", /court of appeals/],
  ["district_attorney", /district attorney/],
  ["solicitor", /solicitor/],
  ["superior_court", /superior court/],
  ["state_court_judge", /state court/],
  ["probate_judge", /probate/],
  ["juvenile_judge", /juvenile/],
  ["magistrate", /magistrate/],
  ["sheriff", /sheriff/],
  ["coroner", /coroner/],
  ["surveyor", /surveyor/],
  ["soil_water", /soil (and|&) water|water conservation/],
  ["school_board", /board of education|school board|\bboe\b/],
  ["county_commission_chair", /commission(er)?s?\s*(-\s*)?(chair|chairman|chairperson)\b|chairman.*commission/],
  ["county_commission", /county commission|board of commissioners|^commissioner\b|^(augusta|athens-clarke|macon-bibb|columbus) commission/],
  ["mayor", /\bmayor\b/],
  ["city_council", /council|alderm[ae]n/],
];

/** Office family from a ballot contest name or a registry office label; null if unrecognized. */
export function officeFamily(office: string): OfficeFamily | null {
  const text = office.toLowerCase().replace(/^(spec(ial)?|nonpartisan)\.?\s+/, "");
  return FAMILIES.find(([, re]) => re.test(text))?.[0] ?? null;
}

/** "State House of Representatives - District 056" → "56"; "Post 2" → "2"; "1-B" → "1B". */
export function normalizeDistrict(value: string | null | undefined): string | null {
  if (value == null) return null;
  const m = String(value).match(/(?:district|post|ward|seat)?\s*0*([0-9]+)\s*-?\s*([A-Z])?\b/i);
  return m ? `${m[1]}${(m[2] ?? "").toUpperCase()}` : null;
}

/** District number from a contest name: "District 5", "Post 3", "HD 56", "GA HOUSE 56". */
export function contestDistrict(name: string): string | null {
  const m =
    name.match(/\b(?:district|post|ward|seat)\s*0*([0-9]+[A-Z]?)\b/i) ??
    name.match(/\b(?:HD|SD)\s*0*([0-9]+)\b/) ??
    name.match(/\b(?:house|senate)\s+0*([0-9]+)\s*$/i);
  return m ? m[1].toUpperCase() : null;
}

/** Judicial circuit in a contest name or registry jurisdiction: "District Attorney - Enotah Judicial Circuit" → "enotah". */
export function circuitOf(text: string | null | undefined): string | null {
  const value = String(text ?? "");
  const before = value.match(/^(.*?)\s+(?:judicial\s+)?circuit\b/i)?.[1] ?? value;
  const place = before.split(/\s+-\s+/).at(-1)?.trim().toLowerCase();
  return place || null;
}

// ── names ────────────────────────────────────────────────────────────────

const SUFFIX = /^(jr|sr|ii|iii|iv|v|md|phd|esq)$/;
const TITLE = /^(mr|mrs|ms|dr|rev|hon|judge|truste|trustee)$/;

const NICKNAMES: string[][] = [
  ["michael", "mike", "mickey"],
  ["william", "bill", "billy", "will", "willie"],
  ["robert", "bob", "bobby", "rob", "robbie", "bert"],
  ["james", "jim", "jimmy", "jamie"],
  ["thomas", "tom", "tommy"],
  ["richard", "rick", "ricky", "dick", "rich"],
  ["joseph", "joe", "joey"],
  ["charles", "chuck", "charlie"],
  ["elizabeth", "liz", "beth", "betty", "lisa", "eliza"],
  ["katherine", "kathy", "kate", "katie", "kathryn", "catherine"],
  ["jonathan", "jon", "john", "johnny"],
  ["edward", "ed", "eddie", "ted", "ned"],
  ["anthony", "tony"],
  ["daniel", "dan", "danny"],
  ["david", "dave"],
  ["steven", "steve", "stephen"],
  ["christopher", "chris"],
  ["matthew", "matt"],
  ["nicholas", "nick"],
  ["patricia", "pat", "patty", "trish"],
  ["patrick", "pat"],
  ["samuel", "sam"],
  ["benjamin", "ben"],
  ["timothy", "tim"],
  ["gregory", "greg"],
  ["jeffrey", "jeff"],
  ["kenneth", "ken", "kenny"],
  ["ronald", "ron"],
  ["donald", "don"],
  ["douglas", "doug"],
  ["gerald", "jerry"],
  ["lawrence", "larry"],
  ["raymond", "ray"],
  ["rebecca", "becky", "becca"],
  ["deborah", "deb", "debbie", "debra"],
  ["susan", "sue", "suzy"],
  ["margaret", "maggie", "peggy", "meg"],
  ["jennifer", "jen", "jenny"],
  ["alexander", "alex"],
  ["andrew", "andy", "drew"],
  ["frederick", "fred"],
  ["harold", "hal"],
  ["henry", "hank"],
  ["randall", "randy"],
  ["phillip", "phil", "philip"],
  ["zachary", "zach"],
  ["jacqueline", "jackie"],
  ["victoria", "vicky", "tori"],
];
const NICK = new Map<string, Set<string>>();
for (const group of NICKNAMES) for (const n of group) NICK.set(n, new Set([...(NICK.get(n) ?? []), ...group]));

export interface PersonName {
  last: string;
  /** Given names and nicknames, lowercase, initials as single letters. */
  givens: string[];
}

const tokens = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s'-]/g, " ")
    .replace(/'/g, "")
    .split(/\s+/)
    .filter((t) => t && !SUFFIX.test(t) && !TITLE.test(t));

/** Ballot-style "Keisha Lance Bottoms", "Rebecca \"Becky\" Jackson", "Nathaniel Hicks Jr." */
export function parseBallotName(name: string): PersonName {
  const nick = [...name.matchAll(/[("“]([^)"”]+)[)"”]/g)].flatMap((m) => tokens(m[1]));
  const rest = tokens(name.replace(/[("“][^)"”]+[)"”]/g, " "));
  const last = rest.pop() ?? "";
  return { last, givens: [...rest, ...nick] };
}

/** Registry-style "Jackson, Rebecca (Becky) L." or "OSSOFF, T. JONATHAN"; falls back to ballot order without a comma. */
export function parseRegistryName(name: string): PersonName {
  const comma = name.indexOf(",");
  if (comma < 0) return parseBallotName(name);
  const last = tokens(name.slice(0, comma)).join(" ");
  const given = name.slice(comma + 1);
  const nick = [...given.matchAll(/[("“]([^)"”]+)[)"”]/g)].flatMap((m) => tokens(m[1]));
  return { last, givens: [...tokens(given.replace(/[("“][^)"”]+[)"”]/g, " ")), ...nick] };
}

/** Last names agree when one's final part is among the other's parts ("lance bottoms" / "bottoms", "smith-jones" / "jones"). */
export function lastNamesAgree(a: string, b: string): boolean {
  const pa = a.split(/[\s-]+/).filter(Boolean);
  const pb = b.split(/[\s-]+/).filter(Boolean);
  if (!pa.length || !pb.length) return false;
  return pb.includes(pa.at(-1)!) || pa.includes(pb.at(-1)!);
}

function givenAgrees(a: string, b: string): boolean {
  if (a === b) return a.length > 1;
  if (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a))) return true;
  return Boolean(NICK.get(a)?.has(b));
}

export function givenNamesAgree(a: string[], b: string[]): boolean {
  return a.some((x) => b.some((y) => givenAgrees(x, y)));
}

// ── matching ─────────────────────────────────────────────────────────────

export interface Registration {
  id: string;
  /** Names to try: legal name and the ballot name the candidate filed. */
  names: PersonName[];
  officeFamily: OfficeFamily | null;
  district: string | null;
  /** County (or city) for local offices; null for state and district offices. */
  jurisdiction: string | null;
  active: boolean;
}

export interface MatchTarget {
  name: string;
  officeFamily: OfficeFamily | null;
  district: string | null;
  /** Counties the contest is on the ballot in (names, "Fulton County" or "Fulton"). */
  counties: string[];
  municipality: string | null;
  /** True for contests from a county feed (county, school, municipal offices). */
  local: boolean;
}

export type MatchResult =
  | { kind: "verified" | "probable"; registrationId: string; evidence: string }
  | { kind: "ambiguous"; count: number }
  | { kind: "none"; reason: string };

const placeKey = (s: string) => s.toLowerCase().replace(/\s+county$/, "").replace(/[^a-z]/g, "");

const DISTRICTLESS: OfficeFamily[] = [
  "us_senate", "governor", "lt_governor", "secretary_of_state", "attorney_general", "agriculture",
  "insurance", "labor", "school_superintendent", "supreme_court", "court_of_appeals",
];

function inScope(target: MatchTarget, reg: Registration): boolean {
  if (!target.officeFamily || reg.officeFamily !== target.officeFamily) return false;
  if (!DISTRICTLESS.includes(target.officeFamily)) {
    // Both name a district: they must agree. A contest with a district and a
    // registry row without one (or the reverse) is still in scope; the name
    // check and the uniqueness rule carry the decision.
    if (target.district && reg.district && target.district !== reg.district) return false;
  }
  if (target.local) {
    if (!reg.jurisdiction) return false;
    const places = new Set([...target.counties, ...(target.municipality ? [target.municipality] : [])].map(placeKey));
    // "Macon-Bibb (Cons. Gov.)" is the Bibb County ballot.
    const own = reg.jurisdiction.replace(/\(.*?\)/g, "").trim();
    if (![own, ...own.split("-")].some((p) => places.has(placeKey(p)))) return false;
  }
  return true;
}

function districtConfirmed(target: MatchTarget, reg: Registration): boolean {
  if (target.officeFamily && DISTRICTLESS.includes(target.officeFamily)) return true;
  return target.district === reg.district;
}

export function matchCandidate(target: MatchTarget, pool: Registration[]): MatchResult {
  if (!target.officeFamily) return { kind: "none", reason: "office not recognized" };
  const person = parseBallotName(target.name);
  if (!person.last) return { kind: "none", reason: "no name" };
  const scoped = pool.filter((r) => inScope(target, r));
  if (!scoped.length) return { kind: "none", reason: "no registration for this office" };
  const sameLast = scoped.filter((r) => r.names.some((n) => lastNamesAgree(person.last, n.last)));
  if (!sameLast.length) return { kind: "none", reason: "no registration with this last name" };

  const full = sameLast.filter((r) => r.names.some((n) => lastNamesAgree(person.last, n.last) && givenNamesAgree(person.givens, n.givens)));
  const pick = (list: Registration[]): Registration | null => {
    // One person can hold several registrations (a renewed or re-filed
    // committee). Collapse rows that read as the same person, preferring the
    // active one; anything else left over is a second person.
    const people: Registration[][] = [];
    for (const r of list) {
      const same = people.find((p) => p[0].names.some((a) => r.names.some((b) => a.last === b.last && givenNamesAgree(a.givens, b.givens))));
      if (same) same.push(r);
      else people.push([r]);
    }
    if (people.length !== 1) return null;
    return people[0].find((r) => r.active) ?? people[0][0];
  };

  const scope = `${target.officeFamily}${target.district ? ` ${target.district}` : ""}${target.local ? ` in ${target.counties.join("/")}` : ""}`;
  if (full.length) {
    const one = pick(full);
    if (one && !districtConfirmed(target, one)) {
      return { kind: "probable", registrationId: one.id, evidence: `full name agrees; registration doesn't state the district (${scope})` };
    }
    if (one) return { kind: "verified", registrationId: one.id, evidence: `office, district and full name agree (${scope})` };
    return { kind: "ambiguous", count: full.length };
  }
  const one = pick(sameLast);
  if (one) return { kind: "probable", registrationId: one.id, evidence: `only registration with this last name for ${scope}; given name differs` };
  return { kind: "ambiguous", count: sameLast.length };
}
