// The relationship vocabulary for the People graph. Edges carry a free-text
// `label` (the human detail — "Chief of Staff", "guest, ep. 412") plus a
// `relType` slug from this list, which is the thing filters, colours, and
// grouping key off. `inferRelType` maps the legacy free-text labels onto a
// slug for the backfill and as the edge form's default.

export const relationshipCategories = [
  "institutional",
  "affiliation",
  "employment",
  "political",
  "media",
  "personal",
  "corporate",
] as const;

export type RelationshipCategory = (typeof relationshipCategories)[number];

export interface RelationshipType {
  slug: string;
  label: string;
  category: RelationshipCategory;
  /** How it reads source → target. */
  verb: string;
  /** How it reads target → source. */
  inverse: string;
  /** false = symmetric (spouse, ally); the two directions read the same. */
  directed: boolean;
}

export const relationshipTypes: RelationshipType[] = [
  // institutional
  { slug: "serves-in", label: "Serves in", category: "institutional", verb: "serves in", inverse: "has member", directed: true },
  { slug: "chairs", label: "Chairs", category: "institutional", verb: "chairs", inverse: "chaired by", directed: true },
  { slug: "sits-on-committee", label: "Sits on committee", category: "institutional", verb: "sits on", inverse: "has member", directed: true },
  { slug: "governor-of", label: "Governor of", category: "institutional", verb: "serves as governor of", inverse: "governed by", directed: true },
  { slug: "holds-office", label: "Holds office", category: "institutional", verb: "holds office at", inverse: "office held by", directed: true },

  // affiliation
  { slug: "member-of", label: "Member of", category: "affiliation", verb: "member of", inverse: "has member", directed: true },
  { slug: "party-member", label: "Party member", category: "affiliation", verb: "member of party", inverse: "party of", directed: true },
  { slug: "fellow-at", label: "Fellow at", category: "affiliation", verb: "fellow at", inverse: "has fellow", directed: true },
  { slug: "founded", label: "Founded", category: "affiliation", verb: "founded", inverse: "founded by", directed: true },
  { slug: "co-founded", label: "Co-founded", category: "affiliation", verb: "co-founded", inverse: "co-founded by", directed: true },
  { slug: "collaborated-with", label: "Collaborated with", category: "affiliation", verb: "collaborated with", inverse: "collaborated with", directed: false },
  { slug: "affiliated-with", label: "Affiliated with", category: "affiliation", verb: "affiliated with", inverse: "affiliated with", directed: false },

  // employment
  { slug: "works-for", label: "Works for", category: "employment", verb: "works for", inverse: "employs", directed: true },
  { slug: "staffer-for", label: "Staffer for", category: "employment", verb: "staffer for", inverse: "has staffer", directed: true },
  { slug: "adviser-to", label: "Adviser to", category: "employment", verb: "adviser to", inverse: "advised by", directed: true },
  { slug: "campaign-role", label: "Campaign role", category: "employment", verb: "worked the campaign of", inverse: "campaign worked by", directed: true },
  { slug: "former-role", label: "Former role", category: "employment", verb: "formerly worked for", inverse: "former employer of", directed: true },

  // political
  { slug: "endorsed", label: "Endorsed", category: "political", verb: "endorsed", inverse: "endorsed by", directed: true },
  { slug: "campaigned-for", label: "Campaigned for", category: "political", verb: "campaigned for", inverse: "campaigned for by", directed: true },
  { slug: "appointed", label: "Appointed", category: "political", verb: "appointed", inverse: "appointed by", directed: true },
  { slug: "nominated", label: "Nominated", category: "political", verb: "nominated", inverse: "nominated by", directed: true },
  { slug: "succeeded", label: "Succeeded", category: "political", verb: "succeeded", inverse: "succeeded by", directed: true },
  { slug: "allied-with", label: "Allied with", category: "political", verb: "allied with", inverse: "allied with", directed: false },
  { slug: "opposed", label: "Opposed", category: "political", verb: "opposed", inverse: "opposed by", directed: true },

  // media
  { slug: "hosts", label: "Hosts", category: "media", verb: "hosts", inverse: "hosted by", directed: true },
  { slug: "co-hosts", label: "Co-hosts", category: "media", verb: "co-hosts", inverse: "co-hosted by", directed: true },
  { slug: "contributes-to", label: "Contributes to", category: "media", verb: "contributes to", inverse: "has contributor", directed: true },
  { slug: "guest-on", label: "Guest on", category: "media", verb: "guest on", inverse: "hosted", directed: true },
  { slug: "cited", label: "Cited", category: "media", verb: "cited", inverse: "cited by", directed: true },

  // personal
  { slug: "family-of", label: "Family of", category: "personal", verb: "family of", inverse: "family of", directed: false },
  { slug: "married-to", label: "Married to", category: "personal", verb: "married to", inverse: "married to", directed: false },
  { slug: "mentee-of", label: "Mentee of", category: "personal", verb: "mentee of", inverse: "mentor of", directed: true },
  { slug: "friend-of", label: "Friend of", category: "personal", verb: "friend of", inverse: "friend of", directed: false },

  // corporate
  { slug: "donated-to", label: "Donated to", category: "corporate", verb: "donated to", inverse: "received from", directed: true },
  { slug: "lobbied-for", label: "Lobbied for", category: "corporate", verb: "lobbied for", inverse: "lobbied by", directed: true },
  { slug: "board-member-of", label: "Board member of", category: "corporate", verb: "board member of", inverse: "has board member", directed: true },
  { slug: "invested-in", label: "Invested in", category: "corporate", verb: "invested in", inverse: "backed by", directed: true },
  { slug: "client-of", label: "Client of", category: "corporate", verb: "client of", inverse: "represents", directed: true },
];

export const relationshipTypeBySlug: Record<string, RelationshipType> = Object.fromEntries(
  relationshipTypes.map((r) => [r.slug, r]),
);

// One colour per category, for edge styling and the graph legend. Kept off
// the party blue/red, which the network uses for people's political family.
export const relationshipCategoryColors: Record<RelationshipCategory, string> = {
  institutional: "#64748B", // slate
  affiliation: "#8B5CF6", // violet
  employment: "#14B8A6", // teal
  political: "#F59E0B", // amber
  media: "#C026D3", // fuchsia
  personal: "#F472B6", // pink
  corporate: "#16A34A", // green
};

export function relationshipCategoryOf(slug: string): RelationshipCategory | null {
  return relationshipTypeBySlug[slug]?.category ?? null;
}

// Legacy free-text label -> slug. Ordered: first match wins.
const INFER_RULES: [RegExp, string][] = [
  [/govern(or|s as governor)/i, "governor-of"],
  [/serves? (in|on the)\b/i, "serves-in"],
  [/committee/i, "sits-on-committee"],
  [/chair(s|ed|man|woman|person)?\b/i, "chairs"],
  [/co-?found/i, "co-founded"],
  [/found(ed|er|s)\b/i, "founded"],
  [/co-?host/i, "co-hosts"],
  [/hosts?( and (produces?|executive produces?))?\b|anchor/i, "hosts"],
  [/contribut(or|es)|correspondent|columnist|writes? for/i, "contributes-to"],
  [/guest|appeared on|interview/i, "guest-on"],
  [/cite|shout-?out|referenced/i, "cited"],
  [/fellow\b/i, "fellow-at"],
  [/(donat|contribut).*(to|campaign)|campaign financ|funded|funding/i, "donated-to"],
  [/lobb(y|ied|ies)/i, "lobbied-for"],
  [/board (member|seat|of directors)/i, "board-member-of"],
  [/client\b/i, "client-of"],
  [/endorse/i, "endorsed"],
  [/campaign(ed)? for/i, "campaigned-for"],
  [/appoint/i, "appointed"],
  [/nominat/i, "nominated"],
  [/succeed/i, "succeeded"],
  [/(married|spouse|wife|husband)/i, "married-to"],
  [/(son|daughter|father|mother|brother|sister|cousin|nephew|niece|family|relative|in-law)/i, "family-of"],
  [/ally|allied/i, "allied-with"],
  [/oppos|rival|feud/i, "opposed"],
  [/mentor|mentee|protég/i, "mentee-of"],
  [/friend/i, "friend-of"],
  [/adviser|advisor|advises/i, "adviser-to"],
  [/staff(er)?|chief of staff|press secretary|communications director/i, "staffer-for"],
  [/former(ly)?|ex-|previously/i, "former-role"],
  [/works? for|employed by|employee/i, "works-for"],
  [/member of (the )?(democratic|republican|libertarian|green) party|party of/i, "party-member"],
  [/member of\b/i, "member-of"],
  [/affiliat|associat|part of|connected/i, "affiliated-with"],
];

export function inferRelType(label: string): string {
  for (const [re, slug] of INFER_RULES) if (re.test(label)) return slug;
  return "affiliated-with";
}
