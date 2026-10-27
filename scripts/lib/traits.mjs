// How published records become entity_traits rows
// (scripts/import-entity-traits.mjs). Pure, so the rules are unit-tested.
//
// Only explicit statements count. A Wikidata "religion" or "ethnic group"
// claim, or a Wikipedia category that files the person under a group
// ("African-American journalists", "American Roman Catholics", "American
// people of Irish descent") — Wikipedia's BLPCAT policy requires a living
// person's religion categories to rest on their own self-identification.
// Nothing is guessed from a name, a photo or a biography's wording, so a
// person with no such record simply has no value for that trait.

// "21st-century African-American politicians" -> "African-American politicians"
const stripCentury = (title) => title.replace(/^\d{1,2}(st|nd|rd|th)-century /, "");

// ── Race & ethnicity (U.S. Census groups, Hispanic origin included) ───────

export const RACE_VALUES = ["black", "hispanic", "asian", "native", "pacific", "mena", "white"];

// Categories that start with a group's name file the person under it;
// "Activists for African-American civil rights" or "Native American
// rights activists" describe work, not the person, and don't start so.
const RACE_CATEGORY_PREFIXES = [
  [/^African-American (?!studies|history|civil rights|literature|music)/, "black"],
  [/^Black (British|Canadian|American) (?!studies|history)/, "black"],
  [/^Hispanic and Latino American /, "hispanic"],
  // "Asian-American and Pacific Islander state legislators" doesn't say which.
  [/^Asian-American (?!studies|history|and Pacific Islander)/, "asian"],
  [/^Native American (?!rights|studies|history|activists)/, "native"],
  [/^Native Hawaiian (?!rights|studies|history)/, "pacific"],
  [/^Pacific Islander American /, "pacific"],
  [/^Arab-American (?!studies|history)/, "mena"],
];

// Wikidata "ethnic group" (P172) labels, lower-cased.
const RACE_ETHNIC_GROUPS = [
  [/^(african americans|black people|black americans|afro-)/, "black"],
  [/^(hispanic|latino|mexican americans|puerto ricans|cuban americans|dominican americans|salvadoran americans|colombian americans|guatemalan americans|chicano)/, "hispanic"],
  [/^(asian americans|indian americans|chinese americans|korean americans|japanese americans|filipino americans|vietnamese americans|taiwanese americans|pakistani americans|bangladeshi americans|hmong americans)/, "asian"],
  [/^(native americans|indigenous peoples of the americas|cherokee|navajo|lakota|ojibwe|choctaw|chickasaw|muscogee|alaska natives)/, "native"],
  [/^(native hawaiians|samoan americans|chamorro|pacific islander)/, "pacific"],
  [/^(arab americans|lebanese americans|syrian americans|palestinian americans|iranian americans|egyptian americans|iraqi americans|yemeni americans)/, "mena"],
  [/^(white americans|white people|european americans)/, "white"],
];

export function raceFromCategory(title) {
  const t = stripCentury(title);
  for (const [re, value] of RACE_CATEGORY_PREFIXES) if (re.test(t)) return value;
  return null;
}

export function raceFromEthnicGroup(label) {
  const l = label.toLowerCase();
  for (const [re, value] of RACE_ETHNIC_GROUPS) if (re.test(l)) return value;
  return null;
}

// ── Ancestry ─────────────────────────────────────────────────────────────

// "American people of Irish descent", "English people of Polish-Jewish
// descent" -> ["Irish"], ["Polish", "Jewish"].
export function ancestryFromCategory(title) {
  const m = stripCentury(title).match(/ of ([A-Z][\w' -]+?) descent$/);
  if (!m) return [];
  return m[1]
    .split(/-(?=Jewish$)/)
    .map((part) => part.trim())
    .filter((part) => part && !/^(mixed|European|African|Asian)$/.test(part));
}

// "Jewish American journalists" files the person as Jewish by heritage,
// which may or may not be religious; it lands under ancestry.
export const isJewishHeritageCategory = (title) => /^Jewish (American|British|Canadian) /.test(stripCentury(title));

// Wikidata ethnic group labels that are ancestries, not Census groups:
// "Irish Americans" -> "Irish", "American Jews" -> "Jewish".
export function ancestryFromEthnicGroup(label) {
  if (/^(american jews|jewish people|jews|ashkenazi jews|sephardi jews)$/i.test(label)) return "Jewish";
  const m = label.match(/^([A-Z][\w'-]+) Americans$/);
  return m && !raceFromEthnicGroup(label) ? m[1] : null;
}

// ── Religion (Pew's groupings) ───────────────────────────────────────────

export const RELIGION_VALUES = [
  "protestant",
  "catholic",
  "christian",
  "lds",
  "orthodox",
  "jewish",
  "muslim",
  "hindu",
  "buddhist",
  "sikh",
  "unitarian",
  "unaffiliated",
  "other",
];

const PROTESTANT =
  "Baptists|Southern Baptists|Methodists|United Methodists|Presbyterians|Episcopalians|Anglicans|Lutherans|Pentecostals|[Ee]vangelicals|Protestants|Congregationalists|Quakers|Seventh-day Adventists|Adventists|Mennonites|Calvinists|Nazarenes|Disciples of Christ";

const RELIGION_CATEGORIES = [
  [/^Converts to (Roman )?Catholicism/, "catholic"],
  [/(^|\b)(Roman )?Catholics( from .+)?$/, "catholic"],
  [/^Converts to (Protestantism|Evangelical Christianity|Anglicanism|Methodism|Lutheranism)/, "protestant"],
  [new RegExp(`(^|\\b)(${PROTESTANT})( from .+)?$`), "protestant"],
  [/^Members of the (Churches of Christ|United Church of Christ|Assemblies of God|Church of God)/, "protestant"],
  [/Latter Day Saints( from .+)?$/, "lds"],
  [/Orthodox Christians( from .+)?$/, "orthodox"],
  [/^Converts to Judaism/, "jewish"],
  [/^(American |British |Canadian )?(Orthodox|Modern Orthodox|Reform|Conservative|Reconstructionist|Hasidic|Haredi) Jews$/, "jewish"],
  [/^Converts to Islam/, "muslim"],
  [/\b(Sunni |Shia )?Muslims( from .+)?$/, "muslim"],
  [/\bHindus( from .+)?$/, "hindu"],
  [/\bBuddhists( from .+)?$/, "buddhist"],
  [/\bSikhs( from .+)?$/, "sikh"],
  [/\b(Unitarian Universalists|Unitarians)( from .+)?$/, "unitarian"],
  [/\b(atheists|agnostics|secular humanists|humanists)( from .+)?$/, "unaffiliated"],
  [/^(American |British |Canadian )?Christians( from .+)?$/, "christian"],
];

export function religionFromCategory(title) {
  const t = stripCentury(title);
  // Former faiths and faith-based work aren't the person's religion.
  if (/^(Former|Critics of|Activists|Scholars|Writers about|Historians of)\b/.test(t)) return null;
  if (/\b(clergy|priests|bishops|missionaries|theologians|schools|universities|alumni|organizations|churches)\b/i.test(t)) return null;
  for (const [re, value] of RELIGION_CATEGORIES) if (re.test(t)) return value;
  return null;
}

// Wikidata religion (P140) labels.
export function religionFromWikidata(label) {
  const l = label.toLowerCase();
  if (/latter-day saints|latter day saint|mormon/.test(l)) return "lds";
  if (/catholic/.test(l) && !/old catholic/.test(l)) return "catholic";
  if (/orthodox (church|christian)|eastern orthodox|oriental orthodox|coptic/.test(l)) return "orthodox";
  if (/baptist|method|presbyter|episcopal|anglican|luther|pentecost|evangelical|protestant|congregational|quaker|religious society of friends|adventist|mennonite|calvin|reformed|nazarene|church of christ|churches of christ|assemblies of god|disciples of christ|nondenominational|non-denominational/.test(l)) return "protestant";
  if (/judaism|jewish/.test(l)) return "jewish";
  if (/islam|muslim|sunni|shia/.test(l)) return "muslim";
  if (/hindu/.test(l)) return "hindu";
  if (/buddhis/.test(l)) return "buddhist";
  if (/sikh/.test(l)) return "sikh";
  if (/unitarian/.test(l)) return "unitarian";
  if (/atheism|agnosticism|irreligion|secular humanism|^humanism|nonreligious|no religion/.test(l)) return "unaffiliated";
  if (/christian/.test(l)) return "christian";
  return "other";
}

// A specific Christian group outranks the generic "christian" it implies.
export function settleReligions(values) {
  const set = new Set(values);
  if (["protestant", "catholic", "lds", "orthodox"].some((v) => set.has(v))) set.delete("christian");
  return [...set];
}

// ── Sex ──────────────────────────────────────────────────────────────────

export function sexFromWikidata(label) {
  const l = label.toLowerCase();
  if (l === "female" || l === "trans woman" || l === "transgender woman") return "female";
  if (l === "male" || l === "trans man" || l === "transgender man") return "male";
  if (/non-binary|nonbinary|genderqueer|genderfluid|agender/.test(l)) return "nonbinary";
  return null;
}

export function sexFromOpenStates(gender) {
  const g = (gender ?? "").trim().toLowerCase();
  if (g === "female" || g === "f") return "female";
  if (g === "male" || g === "m") return "male";
  if (/non-binary|nonbinary/.test(g)) return "nonbinary";
  return null;
}

// ── Matching a name to a Wikidata person ─────────────────────────────────

// The work that puts a commentator or journalist in the People graph; a
// Wikidata description without one of these is a namesake.
const MEDIA_WORDS =
  /\b(commentator|journalist|host|podcast(er)?|pundit|columnist|writer|author|broadcaster|presenter|anchor|editor|activist|comedian|youtuber|political|politics|strategist|analyst|economist|reporter|correspondent|television|radio|personality|blogger|lawyer|attorney|scholar|historian|professor|influencer|streamer|internet personality|media|pollster|publisher|filmmaker|essayist|critic|commentary|news)\b/i;

const NATIONALITY = /\b(American|British|English|Canadian|Australian|Irish|Scottish|Welsh|Israeli|German|French)\b/;

// Accept a Wikidata human for an entity when its description names
// media/political work and, if our description gives a nationality, the
// same one.
export function plausiblePerson(ours, theirs) {
  if (!theirs || !MEDIA_WORDS.test(theirs)) return false;
  const nationality = (ours ?? "").match(NATIONALITY)?.[1];
  return !nationality || theirs.includes(nationality);
}
