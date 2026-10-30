// Site search over pages and data views: reads a free-text query like
// "Hispanic population in Texas" or "2024 presidential election" and
// returns links into the topic pages with the matching state, group, cycle
// or office already selected. Pure, so the /api/search route and tests share it.

import { STATES_51 } from "../geo/states";
import { stateSlug } from "../states/slug";
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

type Topic =
  | "immigration" | "crime" | "guns" | "abortion" | "health" | "energy" | "economy" | "housing" | "demographics" | "education" | "religion"
  | "family" | "spending" | "foreign-policy" | "foreign-relations" | "elections" | "money" | "legislation" | "people" | "government" | "quiz" | "datasets";

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
  guns: {
    label: "Guns",
    href: "/guns",
    blurb: "Firearm deaths, ownership, and opinion on gun laws",
    terms: ["gun", "guns", "firearm", "firearms", "gun violence", "gun control", "gun deaths", "shooting", "shootings", "second amendment", "2nd amendment", "assault weapons", "assault rifles", "background checks", "nra", "gun ownership", "gun laws"],
  },
  abortion: {
    label: "Abortion",
    href: "/abortion",
    blurb: "Abortions by state, travel, telehealth, and state limits",
    terms: ["abortion", "abortions", "dobbs", "roe", "roe v wade", "pro-life", "pro-choice", "mifepristone", "abortion pill", "medication abortion", "heartbeat bill", "shield law", "reproductive", "planned parenthood", "guttmacher"],
  },
  health: {
    label: "Healthcare",
    href: "/healthcare",
    blurb: "Insurance, overdoses, and how U.S. health compares",
    terms: ["health", "healthcare", "healthcare", "health insurance", "insurance", "uninsured", "obamacare", "aca", "affordable care act", "overdose", "overdoses", "opioid", "opioids", "fentanyl", "drug deaths", "life expectancy", "infant mortality"],
  },
  energy: {
    label: "Energy & Climate",
    href: "/energy",
    blurb: "Energy prices, electricity, emissions, and temperature",
    terms: ["energy", "climate", "climate change", "global warming", "warming", "temperature", "temperatures", "emissions", "carbon", "co2", "gas prices", "gasoline", "oil", "natural gas", "electricity", "coal", "nuclear", "solar", "wind", "renewables", "renewable"],
  },
  economy: {
    label: "Economy",
    href: "/economy",
    blurb: "Jobs, inflation, wages, incomes, and growth",
    terms: ["economy", "economic", "jobs", "employment", "unemployment", "jobless", "inflation", "prices", "cpi", "cost of living", "wages", "wage", "pay", "income", "incomes", "gdp", "recession", "interest rates", "fed", "federal reserve", "minimum wage", "poverty"],
  },
  housing: {
    label: "Housing",
    href: "/housing",
    blurb: "Home prices, mortgages, rents, and homeownership",
    terms: ["housing", "home prices", "house prices", "homes", "mortgage", "mortgages", "mortgage rates", "rent", "rents", "renters", "rent burden", "affordability", "homeownership", "home ownership", "housing starts"],
  },
  demographics: {
    label: "Demographics",
    href: "/demographics",
    blurb: "Who lives here, and forecasts through 2050",
    terms: ["demographics", "demographic", "population", "census", "residents", "people living"],
  },
  education: {
    label: "Education",
    href: "/education",
    blurb: "Test scores, degrees, tuition, and student debt",
    terms: ["education", "schools", "school", "students", "test scores", "naep", "nation's report card", "reading", "math", "proficiency", "college", "degree", "degrees", "tuition", "student loans", "student debt", "graduation"],
  },
  religion: {
    label: "Religion",
    href: "/religion",
    blurb: "Attendance, traditions, belief, and party by state",
    terms: ["church", "churches", "church attendance", "attendance", "denomination", "denominations", "pew", "prayer", "pray", "god", "faith", "worship", "congregation", "baptist", "mormon", "jewish", "muslim"],
  },
  family: {
    label: "Family",
    href: "/family",
    blurb: "Fertility, marriage, households, and children",
    terms: ["family", "families", "fertility", "birth rate", "births", "birthrate", "marriage", "married", "divorce", "divorces", "single parent", "single mother", "single mothers", "households", "household", "out of wedlock", "unmarried"],
  },
  spending: {
    label: "Government Spending",
    href: "/spending",
    blurb: "The budget, deficits, debt, and where federal money goes",
    terms: ["spending", "budget", "federal budget", "deficit", "deficits", "debt", "national debt", "outlays", "taxes", "revenue", "social security", "medicare", "medicaid", "snap", "food stamps", "welfare", "entitlements", "improper payments", "usaspending"],
  },
  "foreign-policy": {
    label: "U.S. Foreign Policy",
    href: "/foreign-policy",
    blurb: "Defense, aid, trade, diplomacy, legal authority, and country relationships",
    terms: ["foreign policy", "international relations", "diplomacy", "diplomatic", "national security", "defense policy", "foreign assistance", "foreign aid", "military aid", "security assistance", "alliance", "alliances", "ally", "allies", "treaty", "treaties", "sanctions", "export controls", "arms sales", "trade policy", "war powers", "state department", "foreign relations"],
  },
  "foreign-relations": {
    label: "U.S.–Israel Relations",
    href: "/israel",
    blurb: "U.S.–Israel aid, arms sales, lobbying, votes, and trade",
    terms: ["israel", "israeli", "us israel", "u.s. israel", "aipac", "united democracy project", "j street", "norpac", "foreign aid", "military aid", "arms sales", "arms sale", "iron dome", "gaza", "palestine", "palestinian", "palestinians", "hamas", "netanyahu", "zionism", "zionist", "pro-israel", "un votes", "veto", "vetoes"],
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
    label: "Worldview Atlas",
    href: "/atlas",
    blurb: "Map your views and explore political, economic, governing, and foreign-policy philosophies",
    terms: [
      "quiz",
      "political quiz",
      "atlas",
      "worldview",
      "ideology",
      "philosophy",
      "economic philosophy",
      "government authority",
      "foreign policy quiz",
    ],
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

// Religion has its own page with the same explorer, so religion views open there.
function demographicsHref(state: StateMatch | null, group: GroupMatch | null): string {
  const religion = group?.dim === "religion";
  const params = new URLSearchParams();
  if (state) params.set("state", state.fips);
  if (group && !religion) params.set("dim", group.dim);
  if (group?.group) params.set("group", group.group);
  const query = params.toString();
  const path = religion ? "/religion" : "/demographics";
  return query ? `${path}?${query}` : path;
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
      meta: group?.dim === "religion" ? "Religion" : "Demographics",
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

  // Any state named: its profile — first when the query is just the state.
  if (state) {
    const profile = { id: `state:${state.fips}`, label: state.name, meta: "State profile", href: `/states/${stateSlug(state.name)}` };
    if (results.length === 0) results.unshift(profile);
    else add(profile);
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

export type ResultGroup = "pages" | "datasets" | "entities";

/**
 * Which result group leads. An exact name ("Peter Thiel") puts people first;
 * so does a query that names no topic, state, or group ("nick"). Otherwise the
 * pages that answer the query lead, then people, then datasets.
 */
export function resultOrder(query: string, siteResults: SiteResult[], entityNames: string[]): ResultGroup[] {
  const q = normalizeQuery(query).trim();
  const exactName = entityNames.some((name) => normalizeQuery(name).trim() === q);
  if (exactName || (siteResults.length === 0 && entityNames.length > 0)) return ["entities", "pages", "datasets"];
  return ["pages", "entities", "datasets"];
}
