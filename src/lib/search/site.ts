// Site search over pages and data views: reads a free-text query like
// "Hispanic population in Texas" or "2024 presidential election" and
// returns links into the topic pages with the matching state, group, cycle
// or office already selected. Pure, so the /api/search route and tests share it.

import { STATES_51 } from "../geo/states";
import type { OfficeKey } from "../elections/overview";
import { getDemographicSeries, type DemographicDimensionId } from "../demographics/forecast";

export interface SiteResult {
  id: string;
  label: string;
  meta: string;
  href: string;
}

interface StateMatch {
  name: string;
  fips: string;
}

interface GroupMatch {
  dim: DemographicDimensionId;
  group?: string;
}

// Phrase → demographic dimension (and group). Longer phrases are tried
// first, so "native hawaiian" wins over "native".
const GROUP_TERMS: [string, GroupMatch][] = [
  ["hispanic", { dim: "race", group: "hispanic" }],
  ["latino", { dim: "race", group: "hispanic" }],
  ["latina", { dim: "race", group: "hispanic" }],
  ["latinx", { dim: "race", group: "hispanic" }],
  ["white", { dim: "race", group: "nhWhite" }],
  ["black", { dim: "race", group: "nhBlack" }],
  ["african american", { dim: "race", group: "nhBlack" }],
  ["asian", { dim: "race", group: "nhAsian" }],
  ["multiracial", { dim: "race", group: "nhMultiracial" }],
  ["two or more races", { dim: "race", group: "nhMultiracial" }],
  ["native american", { dim: "race", group: "nhAian" }],
  ["american indian", { dim: "race", group: "nhAian" }],
  ["alaska native", { dim: "race", group: "nhAian" }],
  ["pacific islander", { dim: "race", group: "nhNhpi" }],
  ["native hawaiian", { dim: "race", group: "nhNhpi" }],
  ["race", { dim: "race" }],
  ["racial", { dim: "race" }],
  ["ethnicity", { dim: "race" }],
  ["christian", { dim: "religion", group: "christian" }],
  ["christians", { dim: "religion", group: "christian" }],
  ["catholic", { dim: "religion", group: "christian" }],
  ["protestant", { dim: "religion", group: "christian" }],
  ["evangelical", { dim: "religion", group: "christian" }],
  ["atheist", { dim: "religion", group: "unaffiliated" }],
  ["agnostic", { dim: "religion", group: "unaffiliated" }],
  ["unaffiliated", { dim: "religion", group: "unaffiliated" }],
  ["nones", { dim: "religion", group: "unaffiliated" }],
  ["religion", { dim: "religion" }],
  ["religious", { dim: "religion" }],
  ["lgbt", { dim: "orientation" }],
  ["lgbtq", { dim: "orientation" }],
  ["gay", { dim: "orientation", group: "gayLesbian" }],
  ["lesbian", { dim: "orientation", group: "gayLesbian" }],
  ["bisexual", { dim: "orientation", group: "bisexual" }],
  ["sexual orientation", { dim: "orientation" }],
  ["seniors", { dim: "age", group: "age65plus" }],
  ["elderly", { dim: "age", group: "age65plus" }],
  ["children", { dim: "age", group: "under18" }],
  ["kids", { dim: "age", group: "under18" }],
  ["age", { dim: "age" }],
  ["median age", { dim: "age" }],
  ["women", { dim: "sex", group: "female" }],
  ["female", { dim: "sex", group: "female" }],
  ["men", { dim: "sex", group: "male" }],
  ["male", { dim: "sex", group: "male" }],
  ["sex", { dim: "sex" }],
  ["gender", { dim: "sex" }],
];

type Topic = "immigration" | "crime" | "abortion" | "demographics" | "elections" | "money" | "legislation" | "people" | "government" | "quiz" | "datasets";

const TOPICS: Record<Topic, { label: string; href: string; blurb: string; terms: string[] }> = {
  immigration: {
    label: "Immigration",
    href: "/immigration",
    blurb: "Border encounters, green cards, refugees, detention",
    terms: ["immigration", "immigrant", "immigrants", "migrant", "migrants", "migration", "border", "h-1b", "h1b", "visa", "visas", "green card", "green cards", "refugee", "refugees", "asylum", "deportation", "deportations", "ice", "cbp", "detention", "naturalization", "foreign born", "foreign-born"],
  },
  crime: {
    label: "Crime",
    href: "/crime",
    blurb: "Violent and property crime, nationally and by state",
    terms: ["crime", "crimes", "murder", "murders", "homicide", "homicides", "violent", "violence", "robbery", "assault", "burglary", "theft", "arrests", "police", "fbi", "victimization"],
  },
  abortion: {
    label: "Abortion",
    href: "/abortion",
    blurb: "Abortions by state, travel, telehealth, and state limits",
    terms: ["abortion", "abortions", "dobbs", "roe", "roe v wade", "pro-life", "pro-choice", "mifepristone", "abortion pill", "medication abortion", "heartbeat bill", "shield law", "reproductive", "planned parenthood", "guttmacher"],
  },
  demographics: {
    label: "Demographics",
    href: "/demographics",
    blurb: "Who lives here, and forecasts through 2050",
    terms: ["demographics", "demographic", "population", "census", "residents", "people living"],
  },
  elections: {
    label: "Elections",
    href: "/elections",
    blurb: "Results, ratings, and county maps",
    terms: ["election", "elections", "vote", "votes", "voting", "voters", "electorate", "presidential", "president", "senate", "house", "governor", "gubernatorial", "midterm", "midterms", "results", "ratings"],
  },
  money: {
    label: "Money & Influence",
    href: "/money",
    blurb: "Donors, PACs, lobbying, and money flow",
    terms: ["money", "donor", "donors", "donations", "contributions", "pac", "pacs", "super pac", "lobbying", "lobbyist", "lobbyists", "campaign finance", "fundraising"],
  },
  legislation: {
    label: "Legislation & Courts",
    href: "/legislation",
    blurb: "Bills, votes, and Supreme Court cases",
    terms: ["bill", "bills", "legislation", "law", "laws", "congress", "supreme court", "court", "roll call"],
  },
  people: {
    label: "People & Power",
    href: "/people",
    blurb: "Who's connected to whom, and how",
    terms: ["people", "politicians", "administration", "cabinet", "officials", "connections"],
  },
  government: {
    label: "My Government",
    href: "/my-government",
    blurb: "Your officials, districts, and votes",
    terms: ["my government", "representative", "representatives", "my rep", "district", "who represents"],
  },
  quiz: {
    label: "Political Quiz",
    href: "/quiz",
    blurb: "Map your views on 17 axes and 25 issues",
    terms: ["quiz", "political quiz"],
  },
  datasets: {
    label: "Datasets",
    href: "/datasets",
    blurb: "Public datasets with links to original sources",
    terms: ["dataset", "datasets", "data", "download", "api"],
  },
};

// Words that carry no search meaning in "population of Texas"-style queries.
const STOP_WORDS = new Set(["in", "of", "the", "a", "an", "for", "and", "by", "to", "on", "at", "us", "u.s.", "united", "states", "share", "percent", "rate", "rates", "number", "how", "many", "what", "is", "are"]);

export function normalizeQuery(q: string): string {
  return ` ${q.toLowerCase().replace(/[“”"'’,.?!()]/g, " ").replace(/\s+/g, " ").trim()} `;
}

/** True when `phrase` appears in the normalized query as whole words. */
function hasPhrase(normalized: string, phrase: string): boolean {
  return normalized.includes(` ${phrase} `);
}

// Longest names first, so "west virginia" is found before "virginia".
const STATES_BY_LENGTH = [...STATES_51].sort((a, b) => b.name.length - a.name.length);

export function findState(normalized: string): StateMatch | null {
  for (const state of STATES_BY_LENGTH) {
    if (hasPhrase(normalized, state.name.toLowerCase())) return { name: state.name, fips: state.fips };
  }
  // A bare postal code ("TX") only counts when it is the whole query —
  // otherwise "in", "or", "me" would read as states.
  const bare = normalized.trim();
  if (bare.length === 2) {
    const state = STATES_51.find((s) => s.abbr.toLowerCase() === bare);
    if (state) return { name: state.name, fips: state.fips };
  }
  return null;
}

const GROUP_TERMS_BY_LENGTH = [...GROUP_TERMS].sort((a, b) => b[0].length - a[0].length);

export function findGroup(normalized: string): GroupMatch | null {
  // "White House" is a place, not a group.
  normalized = normalized.replace(/ white house /g, " house ");
  for (const [term, match] of GROUP_TERMS_BY_LENGTH) {
    if (hasPhrase(normalized, term)) return match;
  }
  return null;
}

/** Site topics the query mentions; also the dataset `topic` values. */
export function findTopics(normalized: string): Topic[] {
  return (Object.keys(TOPICS) as Topic[]).filter((topic) =>
    TOPICS[topic].terms.some((term) => hasPhrase(normalized, term)),
  );
}

function findOffice(normalized: string): OfficeKey | null {
  if (hasPhrase(normalized, "presidential") || hasPhrase(normalized, "president")) return "president";
  if (hasPhrase(normalized, "senate") || hasPhrase(normalized, "senator")) return "senate";
  if (hasPhrase(normalized, "governor") || hasPhrase(normalized, "gubernatorial")) return "governor";
  if (hasPhrase(normalized, "house") || hasPhrase(normalized, "congressional")) return "house";
  return null;
}

const OFFICE_PHRASE: Record<OfficeKey, string> = {
  president: "presidential election",
  senate: "Senate elections",
  house: "House elections",
  governor: "governor's races",
};

function findYear(normalized: string): number | null {
  const match = normalized.match(/ (19[7-9]\d|20[0-5]\d) /);
  return match ? Number(match[1]) : null;
}

function demographicsHref(state: StateMatch | null, group: GroupMatch | null): string {
  const params = new URLSearchParams();
  if (state) params.set("state", state.fips);
  if (group) params.set("dim", group.dim);
  if (group?.group) params.set("group", group.group);
  const query = params.toString();
  return query ? `/demographics?${query}` : "/demographics";
}

function groupLabel(group: GroupMatch): string {
  const series = getDemographicSeries(group.dim);
  if (!group.group) return series.label;
  return series.categories.find((c) => c.id === group.group)?.label ?? series.label;
}

/** Pages and data views that answer the query, best first. */
export function searchSite(query: string): SiteResult[] {
  const normalized = normalizeQuery(query);
  if (!normalized.trim()) return [];

  const state = findState(normalized);
  const group = findGroup(normalized);
  const topics = findTopics(normalized);
  const results: SiteResult[] = [];
  const add = (result: SiteResult) => {
    if (!results.some((r) => r.href === result.href)) results.push(result);
  };

  // Demographic views: a group ("Hispanic"), or a state with a population word.
  if (group || (state && topics.includes("demographics"))) {
    const what = group ? `${groupLabel(group)} population` : "Population";
    add({
      id: `demographics:${state?.fips ?? "us"}:${group?.dim ?? ""}:${group?.group ?? ""}`,
      label: state ? `${what} in ${state.name}` : `${what} in the U.S.`,
      meta: "Demographics",
      href: demographicsHref(state, group),
    });
  }

  if (topics.includes("elections")) {
    const year = findYear(normalized);
    const office = findOffice(normalized);
    const params = new URLSearchParams();
    if (year) params.set("cycle", String(year));
    if (office) params.set("office", office);
    if (state) params.set("electorate", state.fips);
    const what = office ? OFFICE_PHRASE[office] : "Elections";
    add({
      id: `elections:${params.toString()}`,
      label: `${year ? `${year} ` : ""}${what}${state ? ` · ${state.name} voters` : ""}`,
      meta: "Elections",
      href: params.toString() ? `/elections?${params}` : "/elections",
    });
  }

  for (const topic of topics) {
    const { label, href, blurb } = TOPICS[topic];
    add({ id: `page:${topic}`, label, meta: blurb, href });
  }

  // A state on its own: its population profile.
  if (state && results.length === 0) {
    add({
      id: `demographics:${state.fips}`,
      label: `${state.name} population`,
      meta: "Demographics",
      href: demographicsHref(state, null),
    });
  }

  return results;
}

/** The words that should all appear in a record for it to match. */
export function significantWords(query: string): string[] {
  return normalizeQuery(query)
    .trim()
    .split(" ")
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}
