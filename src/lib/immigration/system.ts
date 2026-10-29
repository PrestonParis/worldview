// The U.S. immigration system as a graph: every node the /immigration
// flowchart can show, the vertical flows that connect them, and the legal
// content behind each one. Presentation lives in
// src/components/immigration/system/; this file is data only.
//
// Arrows describe legal possibilities, not measured transitions: no dataset
// here follows people from one node to the next.

import type { GlossaryId } from "@/lib/glossary";

export type NodeKind = "root" | "stage" | "process" | "decision" | "outcome" | "measure" | "context";

// step: the next procedural step. if: happens only under a condition.
// status: a change of legal status. context: an analytical link, not a step.
export type EdgeKind = "step" | "if" | "status" | "context";

// Chart panels the page builds server-side; nodes list the ones they show.
export type StatKey =
  | "history"
  | "border"
  | "borderWhere"
  | "temporary"
  | "refugees"
  | "asylum"
  | "greenCards"
  | "naturalization"
  | "unauthorized"
  | "removals"
  | "detention"
  | "population"
  | "netMigration"
  | "domestic"
  | "abroad"
  | `states:${string}`;

export interface Ref {
  label: string;
  href: string;
}

export interface SystemNode {
  title: string;
  kind: NodeKind;
  summary: string; // one line, shown on the card
  teaser?: string; // shorter card text when the summary runs long
  points?: string[]; // a stage's bullets on the start-here card
  body?: string[];
  agency?: string[];
  roles?: { agency: string; does: string }[]; // who does what, shown as cards in place of `agency`
  triggers?: string[]; // conditions that start or allow it
  rights?: string[]; // procedural protections
  outcomes?: string[];
  review?: string[]; // appeal and review mechanisms
  earlier?: string[]; // rules that applied before, kept apart from current ones
  law?: Ref[];
  sources?: Ref[];
  verified?: string; // ISO date the legal text was last checked against `law`
  stats?: StatKey[];
  units?: string; // what the statistics count
  related?: string[];
  terms?: GlossaryId[];
  opens?: { tracks: string; flow: string }; // selecting it also picks this track
  home?: string; // stage a shared link opens it in, when it appears in several
}

export interface Step {
  ids: string[]; // one id: a spine step; several: a local branch
  edge?: EdgeKind; // the connector leading into this step
  label?: string;
}

export type Block =
  | { kind: "nodes"; ids: string[]; title?: string; cols?: 1 | 2 }
  | { kind: "flow"; id: string }
  | { kind: "tracks"; id: string; label: string; flows: string[] };

export interface Flow {
  id: string;
  label: string; // selector label
  steps: Step[];
  after?: Block[];
}

export interface Stage {
  id: string;
  blocks: Block[];
}

// ------------------------------------------------------------- References

const usc = (section: string, label: string): Ref => ({
  label,
  href: `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title8-section${section}&num=0&edition=prelim`,
});
const cfr = (section: string, label: string): Ref => ({
  label,
  href: `https://www.ecfr.gov/current/title-8/section-${section}`,
});
const cfrPart = (part: string, label: string): Ref => ({
  label,
  href: `https://www.ecfr.gov/current/title-8/part-${part}`,
});

const LAW = {
  ina101: usc("1101", "INA §101(a)(15) · 8 U.S.C. §1101 — nonimmigrant classes"),
  ina201: usc("1151", "INA §201 · 8 U.S.C. §1151 — worldwide levels"),
  ina202: usc("1152", "INA §202 · 8 U.S.C. §1152 — per-country limits"),
  ina203: usc("1153", "INA §203 · 8 U.S.C. §1153 — preference categories"),
  ina204: usc("1154", "INA §204 · 8 U.S.C. §1154 — petitions"),
  ina207: usc("1157", "INA §207 · 8 U.S.C. §1157 — refugee admissions"),
  ina208: usc("1158", "INA §208 · 8 U.S.C. §1158 — asylum"),
  ina209: usc("1159", "INA §209 · 8 U.S.C. §1159 — adjustment of refugees and asylees"),
  ina212: usc("1182", "INA §212 · 8 U.S.C. §1182 — inadmissibility, parole"),
  ina214: usc("1184", "INA §214 · 8 U.S.C. §1184 — admission of nonimmigrants"),
  ina216: usc("1186a", "INA §216 · 8 U.S.C. §1186a — conditional residence"),
  ina217: usc("1187", "INA §217 · 8 U.S.C. §1187 — Visa Waiver Program"),
  ina222g: usc("1202", "INA §222(g) · 8 U.S.C. §1202 — visa voided by overstay"),
  ina235: usc("1225", "INA §235 · 8 U.S.C. §1225 — inspection, expedited removal"),
  ina236: usc("1226", "INA §236 · 8 U.S.C. §1226 — arrest and detention"),
  ina237: usc("1227", "INA §237 · 8 U.S.C. §1227 — deportability"),
  ina238: usc("1228", "INA §238 · 8 U.S.C. §1228 — administrative removal"),
  ina240: usc("1229a", "INA §240 · 8 U.S.C. §1229a — removal proceedings"),
  ina240a: usc("1229b", "INA §240A · 8 U.S.C. §1229b — cancellation of removal"),
  ina240b: usc("1229c", "INA §240B · 8 U.S.C. §1229c — voluntary departure"),
  ina241: usc("1231", "INA §241 · 8 U.S.C. §1231 — detention and removal after an order"),
  ina242: usc("1252", "INA §242 · 8 U.S.C. §1252 — judicial review"),
  ina244: usc("1254a", "INA §244 · 8 U.S.C. §1254a — Temporary Protected Status"),
  ina245: usc("1255", "INA §245 · 8 U.S.C. §1255 — adjustment of status"),
  ina248: usc("1258", "INA §248 · 8 U.S.C. §1258 — change of nonimmigrant status"),
  ina287: usc("1357", "INA §287 · 8 U.S.C. §1357 — officer powers, 287(g)"),
  ina316: usc("1427", "INA §316 · 8 U.S.C. §1427 — naturalization requirements"),
  ina310: usc("1421", "INA §310 · 8 U.S.C. §1421 — naturalization authority and review"),
  usc1325: usc("1325", "8 U.S.C. §1325 — improper entry (crime)"),
  usc1326: usc("1326", "8 U.S.C. §1326 — reentry after removal (crime)"),
  cfr208_30: cfr("208.30", "8 CFR §208.30 — credible fear"),
  cfr208_31: cfr("208.31", "8 CFR §208.31 — reasonable fear"),
  cfr1208_30: cfr("1208.30", "8 CFR §1208.30 — judge review of fear findings"),
  cfr235_3: cfr("235.3", "8 CFR §235.3 — expedited removal procedures"),
  cfr236_1: cfr("236.1", "8 CFR §236.1 — ICE custody determinations"),
  cfr1236_1: cfr("1236.1", "8 CFR §1236.1 — bond redetermination"),
  cfr1003_19: cfr("1003.19", "8 CFR §1003.19 — custody hearings before judges"),
  cfr1003_38: cfr("1003.38", "8 CFR §1003.38 — appeals to the BIA"),
  cfr1003_6: cfr("1003.6", "8 CFR §1003.6 — stay during BIA appeal"),
  cfr1003_14: cfr("1003.14", "8 CFR §1003.14 — filing the charging document"),
  cfr1240: cfrPart("1240", "8 CFR Part 1240 — proceedings before judges"),
  cfr1240_10: cfr("1240.10", "8 CFR §1240.10 — hearing procedure"),
  cfr1240_26: cfr("1240.26", "8 CFR §1240.26 — voluntary departure"),
  cfr1241_1: cfr("1241.1", "8 CFR §1241.1 — when an order becomes final"),
  cfr241_6: cfr("241.6", "8 CFR §241.6 — administrative stay of removal"),
  cfr241_8: cfr("241.8", "8 CFR §241.8 — reinstatement"),
  cfr238_1: cfr("238.1", "8 CFR §238.1 — administrative removal procedure"),
  cfr214_1: cfr("214.1", "8 CFR §214.1 — nonimmigrant admission and status"),
  cfr248: cfrPart("248", "8 CFR Part 248 — change of status"),
  cfr245: cfrPart("245", "8 CFR Part 245 — adjustment of status"),
  cfr207: cfrPart("207", "8 CFR Part 207 — refugees"),
  cfr208: cfrPart("208", "8 CFR Part 208 — asylum procedures"),
  cfr212_5: cfr("212.5", "8 CFR §212.5 — parole"),
  cfr287_7: cfr("287.7", "8 CFR §287.7 — detainers"),
} satisfies Record<string, Ref>;

const SRC = {
  uscisGreenCard: { label: "USCIS — Green card", href: "https://www.uscis.gov/green-card" },
  uscisEligibility: {
    label: "USCIS — Green card eligibility categories",
    href: "https://www.uscis.gov/green-card/green-card-eligibility-categories",
  },
  uscisAos: {
    label: "USCIS — Adjustment of status",
    href: "https://www.uscis.gov/green-card/green-card-processes-and-procedures/adjustment-of-status",
  },
  uscisConsular: {
    label: "USCIS — Consular processing",
    href: "https://www.uscis.gov/green-card/green-card-processes-and-procedures/consular-processing",
  },
  visaBulletin: {
    label: "State Department — Visa Bulletin",
    href: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html",
  },
  dv: {
    label: "State Department — Diversity Visa Program",
    href: "https://travel.state.gov/content/travel/en/us-visas/immigrate/diversity-visa-program-entry.html",
  },
  nvc: {
    label: "State Department — Immigrant visa process",
    href: "https://travel.state.gov/content/travel/en/us-visas/immigrate/the-immigrant-visa-process.html",
  },
  uscisNatz: {
    label: "USCIS — Citizenship and naturalization",
    href: "https://www.uscis.gov/citizenship/learn-about-citizenship/citizenship-and-naturalization",
  },
  uscisPolicyNatz: {
    label: "USCIS Policy Manual — Volume 12, Citizenship",
    href: "https://www.uscis.gov/policy-manual/volume-12",
  },
  visitorVisa: {
    label: "State Department — Visitor visas",
    href: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html",
  },
  i94: { label: "CBP — Form I-94 arrival/departure record", href: "https://i94.cbp.dhs.gov/" },
  uscisExtend: {
    label: "USCIS — Extend your stay",
    href: "https://www.uscis.gov/visit-the-united-states/extend-your-stay",
  },
  uscisChange: {
    label: "USCIS — Change your nonimmigrant status",
    href: "https://www.uscis.gov/visit-the-united-states/change-my-nonimmigrant-status",
  },
  uscisRefugees: { label: "USCIS — Refugees", href: "https://www.uscis.gov/humanitarian/refugees-and-asylum/refugees" },
  usrap: {
    label: "State Department — U.S. Refugee Admissions Program",
    href: "https://www.state.gov/refugee-admissions/",
  },
  uscisAsylum: { label: "USCIS — Asylum", href: "https://www.uscis.gov/humanitarian/refugees-and-asylum/asylum" },
  uscisAffirmative: {
    label: "USCIS — Obtaining asylum in the United States",
    href: "https://www.uscis.gov/humanitarian/refugees-and-asylum/asylum/obtaining-asylum-in-the-united-states",
  },
  uscisCredibleFear: {
    label: "USCIS — Credible fear screenings",
    href: "https://www.uscis.gov/humanitarian/refugees-and-asylum/asylum/credible-fear-screenings",
  },
  uscisParole: {
    label: "USCIS — Humanitarian or significant public benefit parole",
    href: "https://www.uscis.gov/humanitarian/humanitarian-parole",
  },
  uscisTps: {
    label: "USCIS — Temporary Protected Status",
    href: "https://www.uscis.gov/humanitarian/temporary-protected-status",
  },
  eoir: { label: "EOIR — Executive Office for Immigration Review", href: "https://www.justice.gov/eoir" },
  eoirManual: {
    label: "EOIR — Immigration Court Practice Manual",
    href: "https://www.justice.gov/eoir/reference-materials/ic",
  },
  bia: {
    label: "EOIR — Board of Immigration Appeals",
    href: "https://www.justice.gov/eoir/board-of-immigration-appeals",
  },
  bpm: { label: "EOIR — BIA Practice Manual", href: "https://www.justice.gov/eoir/reference-materials/bia" },
  iceEro: { label: "ICE — Enforcement and Removal Operations", href: "https://www.ice.gov/about-ice/ero" },
  iceDetention: { label: "ICE — Detention management", href: "https://www.ice.gov/detain/detention-management" },
  iceStats: { label: "ICE — Detention statistics", href: "https://www.ice.gov/detain/detention-management" },
  ice287g: { label: "ICE — 287(g) program", href: "https://www.ice.gov/identify-and-arrest/287g" },
  cbpStats: { label: "CBP — Nationwide encounters", href: "https://www.cbp.gov/newsroom/stats/nationwide-encounters" },
  cbpEntry: { label: "CBP — Travel and entry", href: "https://www.cbp.gov/travel" },
  ohss: { label: "DHS Office of Homeland Security Statistics", href: "https://ohss.dhs.gov/" },
  ohssUnauthorized: {
    label: "OHSS — Unauthorized immigrant population estimates",
    href: "https://ohss.dhs.gov/topics/immigration/unauthorized-immigrant-population-estimates",
  },
  ohssLpr: {
    label: "OHSS — Lawful permanent resident population estimates",
    href: "https://ohss.dhs.gov/topics/immigration/lawful-permanent-residents",
  },
  ohssOverstay: {
    label: "DHS — Entry/exit overstay reports",
    href: "https://www.dhs.gov/publication/entryexit-overstay-report",
  },
  censusFb: {
    label: "Census Bureau — Foreign-born population",
    href: "https://www.census.gov/topics/population/foreign-born.html",
  },
} satisfies Record<string, Ref>;

// ------------------------------------------------------------------ Nodes

export const NODES: Record<string, SystemNode> = {
  // ------------------------------------------------------------ Root/stages
  system: {
    title: "U.S. immigration system",
    kind: "root",
    summary:
      "Five stages that explain how people enter, move through, and remain in the system. They map the main routes and decision points rather than one path everyone follows, so people may enter at different stages, skip some, or leave at any point.",
    teaser: "Five stages people can enter, skip, or leave at any point.",
    roles: [
      { agency: "State Department", does: "Issues visas at embassies and consulates abroad." },
      { agency: "CBP · DHS", does: "Inspects people at ports of entry and patrols between them." },
      { agency: "USCIS · DHS", does: "Decides petitions and applications inside the country." },
      { agency: "ICE · DHS", does: "Arrests, detains, and removes." },
      { agency: "Immigration courts (EOIR) · DOJ", does: "Hear removal cases, apart from DHS." },
    ],
    units:
      "Each agency counts in its own unit: encounters and admissions are events, green cards and naturalizations are grants, detention is an average daily population, and foreign-born residents are a population stock. Fiscal years run October–September.",
    stats: ["history"],
    terms: ["fiscal-year", "stock", "green-card", "cbp", "uscis", "ice", "eoir"],
  },
  entry: {
    title: "Entry and arrival",
    kind: "stage",
    summary: "Where people first meet the system: abroad, at a port of entry, between ports, or already inside.",
    points: [
      "Arrival from abroad or between ports",
      "First contact at a port of entry or inside the U.S.",
      "Initial screening shapes next steps",
    ],
  },
  pathways: {
    title: "Immigration pathways",
    kind: "stage",
    summary: "Permanent, temporary, humanitarian — and how people come to lack status.",
    points: [
      "Permanent, temporary, and humanitarian routes",
      "Each pathway has different rules",
      "People can also fall out of status",
    ],
  },
  processing: {
    title: "Status and legal processing",
    kind: "stage",
    summary: "Petitions, adjudications, status changes, and the enforcement and removal system.",
    points: [
      "Petitions, applications, and adjudications",
      "Status changes, renewals, and decisions",
      "Enforcement and removal procedures",
    ],
  },
  outcomes: {
    title: "Possible outcomes",
    kind: "stage",
    summary: "Legally distinct results. No one passes through all of them.",
    points: [
      "Admission, lawful status, detention, or removal",
      "Outcomes depend on the pathway and the case",
      "Not everyone passes through every stage",
    ],
  },
  population: {
    title: "Long-term status and population",
    kind: "stage",
    summary: "Citizenship, and the population measures that add up the people living here.",
    points: [
      "Permanent residence and citizenship",
      "Long-term categories shape who lives here",
      "Population measures track the system overall",
    ],
  },

  // ----------------------------------------------------------------- Entry
  "entry-abroad": {
    title: "Applying from abroad",
    kind: "process",
    summary: "Visas from a U.S. consulate, or refugee processing overseas.",
    body: [
      "Most people who come to the U.S. arrange it before travel: an immigrant visa (leading to a green card on arrival) or a nonimmigrant visa (for a temporary purpose) from a U.S. embassy or consulate, or a referral to the refugee program.",
      "Travelers from Visa Waiver Program countries skip the visa but need an approved ESTA travel authorization, and most Canadians need neither.",
      "A visa only allows a person to travel to a port of entry and ask to be admitted. The admission decision belongs to CBP at the border.",
    ],
    agency: ["State Department (consulates)", "USCIS (petitions, refugee interviews)"],
    law: [LAW.ina101, LAW.ina217, LAW.ina207],
    sources: [SRC.nvc, SRC.visitorVisa, SRC.usrap],
    related: ["permanent", "temporary", "humanitarian", "entry-port"],
    terms: ["visa"],
  },
  "entry-port": {
    title: "Inspection at a port of entry",
    kind: "process",
    summary: "CBP officers decide whether to admit each arriving person.",
    body: [
      "Everyone arriving at an airport, seaport, or land crossing is inspected by CBP's Office of Field Operations. Citizens are admitted once identity and citizenship are confirmed. Noncitizens must show they are admissible in the status they seek.",
      "An officer can admit the person (recording the class and length of stay on Form I-94), refuse admission, allow the person to withdraw the application and return, parole them in, or — for people with false or missing documents — place them in expedited removal. A person found inadmissible at a port is counted as a CBP encounter.",
    ],
    agency: ["CBP Office of Field Operations"],
    outcomes: [
      "Admitted in a status, with an I-94 record",
      "Withdrawal of the application for admission",
      "Parole",
      "Expedited removal",
      "Notice to Appear before an immigration judge",
    ],
    law: [LAW.ina235, LAW.ina212, LAW.cfr235_3],
    sources: [SRC.cbpEntry, SRC.i94],
    stats: ["border"],
    units: "Encounters at ports are inadmissibility findings — events, not people.",
    related: ["authorized-stay", "proc-expedited", "border-encounter"],
    terms: ["port-of-entry", "inadmissible", "ofo"],
  },
  "entry-between": {
    title: "Crossing between ports of entry",
    kind: "process",
    summary: "Entry without inspection; people stopped are Border Patrol apprehensions.",
    body: [
      "Crossing anywhere other than an official port is entry without inspection. It makes a person inadmissible and is a federal misdemeanor; reentering after a removal is a felony.",
      "Border Patrol agents who stop someone between ports record an apprehension. From there the person may be placed in expedited removal, given a Notice to Appear, returned, referred for prosecution, or — under Title 42 from March 2020 to May 2023 — expelled.",
      "People who cross without being stopped are not counted anywhere until they are encountered later or appear in population estimates.",
    ],
    agency: ["CBP U.S. Border Patrol"],
    law: [LAW.ina212, LAW.usc1325, LAW.usc1326, LAW.ina235],
    sources: [SRC.cbpStats],
    stats: ["border"],
    related: ["ewi", "border-encounter", "proc-expedited", "prosecution"],
    terms: ["apprehension", "usbp", "title-42"],
  },
  "entry-inside": {
    title: "Already inside the U.S.",
    kind: "process",
    summary: "Most green cards and many enforcement cases start with someone already here.",
    body: [
      "A large share of the system's decisions involve people already in the country: temporary residents changing or extending status, people adjusting to permanent residence, asylum seekers applying from inside, and people whose status has lapsed.",
      "Someone admitted lawfully can later lose status by overstaying or violating its terms. Unauthorized presence is not only an entry route.",
    ],
    agency: ["USCIS", "ICE"],
    law: [LAW.ina245, LAW.ina248, LAW.ina237],
    related: ["adjustment", "change-status", "overstay", "aff-filing"],
    terms: ["adjustment-of-status", "overstay"],
  },
  "border-encounter": {
    title: "CBP encounter",
    kind: "process",
    summary: "A stop by Border Patrol, or an inadmissibility finding at a port.",
    body: [
      "CBP's encounter count combines Border Patrol apprehensions between ports with Office of Field Operations inadmissibility findings at ports, plus Title 42 expulsions while that order was in effect.",
      "An encounter is an event: someone stopped three times counts three times. Encounters do not measure who entered, who stayed, or who lives here without status.",
      "Encounters are filed under the state of the CBP office that recorded them — which is why Florida and New York, with large airports and seaports, report encounters.",
    ],
    agency: ["CBP U.S. Border Patrol", "CBP Office of Field Operations"],
    outcomes: [
      "Expedited removal",
      "Notice to Appear (§240 proceedings)",
      "Voluntary return or withdrawal",
      "Parole or release",
      "Referral for prosecution",
      "Title 42 expulsion (2020–2023 only)",
    ],
    earlier: [
      "From March 2020 to May 11, 2023, a public-health order under Title 42 of the U.S. Code let CBP expel many people within hours, without immigration processing or an asylum screening.",
    ],
    law: [LAW.ina235, LAW.ina212],
    sources: [SRC.cbpStats],
    stats: ["border", "borderWhere", "states:enc"],
    units: "Encounters are events, not unique people.",
    related: ["entry-between", "entry-port", "initial-processing", "unauthorized-population"],
    terms: ["encounter", "apprehension", "inadmissible", "title-8", "title-42", "uac", "family-unit"],
  },

  // ------------------------------------------------------------- Permanent
  permanent: {
    title: "Permanent immigration",
    kind: "process",
    summary: "Becoming a lawful permanent resident (green-card holder).",
    body: [
      "Permanent immigration means obtaining lawful permanent residence: the right to live and work in the U.S. indefinitely, and after a waiting period to apply for citizenship.",
      "Most routes need a qualifying relationship or job, a petition, and — for capped categories — an available visa number. The final step happens either abroad at a consulate or inside the U.S. through adjustment of status.",
    ],
    agency: ["USCIS", "State Department", "Department of Labor (some employment cases)"],
    law: [LAW.ina201, LAW.ina203, LAW.ina245],
    sources: [SRC.uscisGreenCard, SRC.uscisEligibility],
    stats: ["greenCards", "states:lpr"],
    units: "Green cards count grants of permanent residence, by fiscal year — not arrivals.",
    related: ["lpr", "naturalization", "adjustment"],
    terms: ["green-card", "lpr"],
    opens: { tracks: "pathway", flow: "permanent" },
  },
  "immigrant-categories": {
    title: "Immigrant categories",
    kind: "decision",
    summary: "Family, employment, the diversity lottery, or another eligible category.",
    body: [
      "The INA sets yearly limits: 226,000 family-preference visas and 140,000 employment-based visas worldwide, plus 55,000 diversity visas. No single country may use more than 7% of the combined family and employment preference visas.",
      "Immediate relatives of U.S. citizens — spouses, unmarried children under 21, and parents of citizens 21 or older — are not capped. Neither are refugees and asylees adjusting status.",
    ],
    law: [LAW.ina201, LAW.ina202, LAW.ina203],
    sources: [SRC.uscisEligibility, SRC.visaBulletin],
    stats: ["greenCards"],
    related: ["petition"],
  },
  "cat-family": {
    title: "Family-sponsored",
    kind: "process",
    summary: "Immediate relatives of citizens (uncapped) and four capped preference categories.",
    body: [
      "Immediate relatives of U.S. citizens are uncapped. The capped family preferences are F1 (unmarried adult children of citizens), F2 (spouses and children of permanent residents), F3 (married children of citizens), and F4 (siblings of adult citizens).",
      "A U.S. citizen or permanent resident files Form I-130. Capped categories then wait for a priority date to become current; for some countries the wait is decades.",
    ],
    agency: ["USCIS", "State Department"],
    law: [LAW.ina201, LAW.ina203, LAW.ina204],
    sources: [SRC.uscisEligibility, SRC.visaBulletin],
    related: ["petition"],
  },
  "cat-employment": {
    title: "Employment-based",
    kind: "process",
    summary: "EB-1 to EB-5: priority workers, professionals, skilled workers, special immigrants, investors.",
    body: [
      "Most employment cases need an employer petition (Form I-140), and many first need a Department of Labor labor certification showing no qualified U.S. worker is available. Some categories allow self-petitions (extraordinary ability, national interest waiver). Investors file under EB-5.",
      "The 140,000 yearly limit counts family members of the worker, so roughly half of employment visas go to spouses and children.",
    ],
    agency: ["USCIS", "Department of Labor", "State Department"],
    law: [LAW.ina203, LAW.ina204],
    sources: [SRC.uscisEligibility, SRC.visaBulletin],
    related: ["petition"],
  },
  "cat-diversity": {
    title: "Diversity visa",
    kind: "process",
    summary: "A yearly lottery for nationals of countries with low recent immigration.",
    body: [
      "The State Department runs a yearly online entry period. Selected entrants must meet education or work-experience requirements and complete processing within the fiscal year; selection does not guarantee a visa.",
    ],
    agency: ["State Department"],
    law: [LAW.ina203],
    sources: [SRC.dv],
    related: ["petition", "consular-processing"],
  },
  "cat-other": {
    title: "Other categories",
    kind: "process",
    summary: "Refugees and asylees after a year, special immigrants, and others.",
    body: [
      "Other routes include adjustment by refugees and asylees, special immigrant categories (such as religious workers and Iraqi and Afghan U.S. government employees), certain victims of crime or trafficking (U and T status holders), cancellation of removal granted by an immigration judge, and registry for very long-term residents.",
    ],
    law: [LAW.ina209, LAW.ina240a, LAW.ina245],
    sources: [SRC.uscisEligibility],
    related: ["refugee-green-card", "out-relief"],
  },
  petition: {
    title: "Petition, eligibility, and visa availability",
    kind: "process",
    summary: "A sponsor petitions; capped categories wait for a visa number.",
    body: [
      "For family and employment cases, USCIS first approves a petition establishing the qualifying relationship or job. Approval does not itself grant status.",
      "For capped categories, the applicant then waits until their priority date (usually the petition filing date) is current in the State Department's monthly Visa Bulletin. Immediate relatives do not wait for a number.",
      "The applicant must also be admissible: the INA's grounds of inadmissibility (health, criminal, security, prior immigration violations, likelihood of becoming a public charge) apply, some with waivers.",
    ],
    agency: ["USCIS", "State Department"],
    triggers: ["A qualifying relationship, job offer, investment, or diversity selection"],
    outcomes: ["Petition approved and a visa number available", "Petition denied", "Waiting for a priority date"],
    review: [
      "Some petition denials can be appealed to the USCIS Administrative Appeals Office or the Board of Immigration Appeals (family petitions).",
    ],
    law: [LAW.ina204, LAW.ina203, LAW.ina212],
    sources: [SRC.visaBulletin, SRC.uscisEligibility],
    related: ["consular-processing", "adjustment"],
  },
  "consular-processing": {
    title: "Consular processing",
    kind: "process",
    summary: "Immigrant visa interview abroad; permanent residence begins at admission.",
    body: [
      "The case moves to the State Department's National Visa Center, then to a consulate for an interview. A consular officer issues or refuses the immigrant visa.",
      "The person becomes a permanent resident when CBP admits them on that visa at a port of entry. These are the 'new arrivals' in DHS's green-card counts.",
    ],
    agency: ["State Department", "CBP"],
    review: [
      "Consular visa refusals are generally not reviewable in court (the doctrine of consular nonreviewability).",
    ],
    law: [LAW.ina203, LAW.ina212],
    sources: [SRC.uscisConsular, SRC.nvc],
    related: ["lpr"],
    terms: ["new-arrival"],
  },
  adjustment: {
    title: "Adjustment of status",
    kind: "process",
    summary: "Becoming a permanent resident without leaving the U.S.",
    body: [
      "People already in the U.S. file Form I-485 with USCIS. Generally they must have been inspected and admitted or paroled; most applicants (other than immediate relatives) must also have maintained lawful status.",
      "Adjustment is how most green cards are issued each year: the recipient was already living here, often in a temporary status, as a refugee or asylee, or as a parolee.",
      "An applicant in removal proceedings may seek adjustment from the immigration judge instead.",
    ],
    agency: ["USCIS", "EOIR (for people in proceedings)"],
    triggers: [
      "An approved or concurrently filed petition, or another basis such as refugee or asylee status",
      "An available visa number, if the category is capped",
    ],
    outcomes: ["Approved: permanent residence", "Denied: may lead to an enforcement referral if no other status"],
    review: [
      "No appeal of a USCIS adjustment denial; the application can be renewed before an immigration judge if removal proceedings start.",
    ],
    law: [LAW.ina245, LAW.ina209, LAW.cfr245],
    sources: [SRC.uscisAos],
    stats: ["greenCards"],
    related: ["lpr", "enforcement-referral"],
    terms: ["adjustment-of-status"],
  },
  lpr: {
    title: "Lawful permanent residence",
    kind: "outcome",
    summary: "A green card: permanent right to live and work here, with conditions.",
    body: [
      "Permanent residents can live and work anywhere in the U.S., sponsor some relatives, and apply to naturalize. Green cards are renewed every ten years; status itself does not expire.",
      "Marriage-based residents married under two years, and investors, receive two-year conditional residence and must petition to remove the conditions.",
      "Permanent residents can still be removed — for certain crimes, fraud, or abandoning residence — through proceedings before an immigration judge.",
    ],
    agency: ["USCIS"],
    law: [LAW.ina245, LAW.ina216, LAW.ina237],
    sources: [SRC.uscisGreenCard],
    stats: ["greenCards", "states:lpr"],
    units: "Green cards count grants of permanent residence per fiscal year.",
    related: ["naturalization", "lpr-population", "proc-240"],
    terms: ["lpr", "green-card", "adjustment-of-status", "new-arrival"],
  },
  naturalization: {
    title: "Naturalization",
    kind: "process",
    summary: "Permanent residents who qualify can apply to become citizens.",
    body: [
      "Most applicants must have been permanent residents for five years (three if married to and living with a U.S. citizen), with continuous residence and physical presence for at least half that time, good moral character, and passing English and civics tests. Service members have faster routes.",
      "Applicants file Form N-400, attend biometrics and an interview, and become citizens only when they take the Oath of Allegiance.",
      "Naturalization is optional: many eligible permanent residents never apply.",
    ],
    agency: ["USCIS"],
    triggers: [
      "Lawful permanent residence for the required period",
      "Meeting residence, presence, moral character, English, and civics requirements",
    ],
    outcomes: ["Oath of Allegiance: U.S. citizenship", "Denial"],
    review: [
      "A denied applicant can request a hearing before another USCIS officer (Form N-336), then seek review in federal district court.",
    ],
    law: [LAW.ina316, LAW.ina310],
    sources: [SRC.uscisNatz, SRC.uscisPolicyNatz],
    stats: ["naturalization", "states:natz"],
    units: "Naturalizations count people sworn in per fiscal year; applications count filings.",
    related: ["lpr", "foreign-born"],
    terms: ["naturalization"],
  },

  // ------------------------------------------------------------- Temporary
  temporary: {
    title: "Temporary admission",
    kind: "process",
    summary: "Visitors, students, workers, and others admitted for a purpose and a period.",
    body: [
      "Nonimmigrants are admitted for a specific purpose — tourism, business, study, work, exchange — and must leave or change status when it ends. Some classes (such as H-1B and L-1) allow the person to also pursue a green card.",
      "Admissions far outnumber all other flows, and they count entries: a consultant who flies in ten times is ten admissions.",
    ],
    agency: ["State Department", "CBP", "USCIS"],
    law: [LAW.ina101, LAW.ina214],
    sources: [SRC.visitorVisa, SRC.i94],
    stats: ["temporary"],
    units: "I-94 admissions count entries, not people.",
    related: ["authorized-stay", "overstay"],
    terms: ["nonimmigrant", "visa"],
    opens: { tracks: "pathway", flow: "temporary" },
  },
  "nonimmigrant-class": {
    title: "Visa or admission classification",
    kind: "process",
    summary: "B visitors, F/M students, H/L/O/TN workers, J exchange visitors, and more.",
    body: [
      "The class sets what the person may do (study, work for a sponsoring employer, visit) and how long. Visitors under the Visa Waiver Program are admitted for up to 90 days and cannot extend or change status.",
      "Spouses and children often hold a matching dependent class (H-4, L-2, F-2) with its own work rules.",
    ],
    law: [LAW.ina101, LAW.ina217, LAW.cfr214_1],
    sources: [SRC.visitorVisa],
    stats: ["temporary"],
    units: "I-94 admissions by class count entries.",
    related: ["authorized-stay"],
    terms: ["nonimmigrant"],
  },
  "authorized-stay": {
    title: "Period of authorized stay",
    kind: "process",
    summary: "Set by the I-94 at admission — not by the visa's expiration date.",
    body: [
      "The visa is a travel document: its expiration date only limits when it can be used to seek entry. How long the person may stay is set at admission and recorded on Form I-94.",
      "A person can remain lawfully on an expired visa if the I-94 is still valid, and can overstay on an unexpired visa if the I-94 has run out. Students and exchange visitors are usually admitted for 'duration of status' rather than a fixed date.",
    ],
    agency: ["CBP"],
    law: [LAW.ina214, LAW.cfr214_1],
    sources: [SRC.i94],
    related: ["stay-decision", "overstay"],
    terms: ["visa", "overstay"],
  },
  "stay-decision": {
    title: "Before the stay ends",
    kind: "decision",
    summary: "Extend, change status, adjust to permanent residence, or depart.",
    body: [
      "Requests to extend or change status must generally be filed before the I-94 expires. A timely, non-frivolous filing can let the person remain while USCIS decides, even past the I-94 date.",
    ],
    agency: ["USCIS"],
    law: [LAW.ina214, LAW.ina248],
    sources: [SRC.uscisExtend, SRC.uscisChange],
    related: ["extend-stay", "change-status", "adjustment", "depart-on-time"],
  },
  "extend-stay": {
    title: "Extension of stay",
    kind: "process",
    summary: "More time in the same class (Form I-539, or I-129 for workers).",
    law: [LAW.ina214, LAW.cfr214_1],
    sources: [SRC.uscisExtend],
    outcomes: ["Extended: continued authorized stay", "Denied: the person must depart or faces unlawful presence"],
    related: ["out-temporary-stay", "overstay"],
  },
  "change-status": {
    title: "Change of nonimmigrant status",
    kind: "process",
    summary: "Switching classes inside the U.S., such as F-1 student to H-1B worker.",
    body: [
      "USCIS can change a person's nonimmigrant class without departure if they were lawfully admitted and have kept their status. Visa Waiver entrants, people in transit, and some others are barred from changing status.",
    ],
    agency: ["USCIS"],
    law: [LAW.ina248, LAW.cfr248],
    sources: [SRC.uscisChange],
    related: ["out-temporary-stay"],
  },
  "depart-on-time": {
    title: "Departure",
    kind: "outcome",
    summary: "Leaving by the I-94 date — what most temporary visitors do.",
    sources: [SRC.i94],
    related: ["temporary"],
  },
  "out-temporary-stay": {
    title: "Continued temporary stay",
    kind: "outcome",
    summary: "Remaining lawfully in the same or a new nonimmigrant status.",
    related: ["extend-stay", "change-status"],
  },
  overstay: {
    title: "Visa overstay",
    kind: "process",
    summary: "Remaining past the authorized stay — a common way people lose status.",
    body: [
      "A person who stays past their I-94 date without a pending timely extension or change begins to accrue unlawful presence, and their visa is automatically void.",
      "DHS estimates overstays separately from border crossings; a large share of the unauthorized population entered lawfully.",
    ],
    triggers: ["The I-94 date passes without a timely extension, change, or adjustment filing"],
    outcomes: [
      "Unlawful presence accrues",
      "Removability under INA §237",
      "Possible later adjustment for immediate relatives of citizens",
    ],
    law: [LAW.ina222g, LAW.ina212, LAW.ina237],
    sources: [SRC.ohssOverstay],
    related: ["unlawful-presence", "enforcement-referral", "unauthorized-population"],
    terms: ["overstay"],
  },

  // ---------------------------------------------------------- Humanitarian
  humanitarian: {
    title: "Humanitarian immigration",
    kind: "process",
    summary: "Refugees approved abroad, asylum sought from here, and parole.",
    body: [
      "Refugees and asylees must meet the same definition: a well-founded fear of persecution on account of race, religion, nationality, political opinion, or membership in a particular social group. The difference is where they are when they ask.",
      "Refugees are approved while outside the U.S. and counted when they arrive. Asylum is requested inside the U.S. or at the border and counted when granted, often years later.",
      "Screening interviews (credible fear, reasonable fear) decide only whether a claim can go forward. Passing one is not a grant of protection.",
    ],
    law: [LAW.ina207, LAW.ina208, LAW.ina212],
    sources: [SRC.uscisRefugees, SRC.uscisAsylum],
    stats: ["refugees", "asylum"],
    units: "Refugees: arrivals per fiscal year. Asylum: grants per fiscal year, not applications.",
    related: ["out-protection", "credible-fear"],
    terms: ["refugee", "asylum", "parole"],
    opens: { tracks: "pathway", flow: "humanitarian" },
  },
  "refugee-referral": {
    title: "Referral to the refugee program",
    kind: "process",
    summary: "Outside the U.S. and referred — usually by UNHCR, an embassy, or an NGO.",
    body: [
      "Applicants must be outside the U.S. and generally outside their own country. Most are referred by the UN refugee agency; some groups have direct access, and some relatives of refugees already here can apply.",
      "Each year the president, after consulting Congress, sets a ceiling on refugee admissions and its regional allocations.",
    ],
    agency: ["State Department", "UNHCR (referrals)"],
    earlier: [
      "Executive Order 14163 (January 2025) suspended most refugee admissions; later presidential determinations set a much lower ceiling than earlier years.",
    ],
    law: [LAW.ina207, LAW.cfr207],
    sources: [SRC.usrap],
    related: ["refugee-interview"],
  },
  "refugee-interview": {
    title: "USCIS interview and vetting abroad",
    kind: "process",
    summary: "A USCIS officer interviews; security and medical checks follow.",
    body: [
      "A USCIS officer interviews the applicant overseas to decide whether they meet the refugee definition and are admissible. Approval is conditional on security vetting and a medical exam.",
    ],
    agency: ["USCIS", "State Department", "intelligence and law-enforcement agencies (vetting)"],
    outcomes: ["Conditionally approved", "Denied"],
    review: ["A denied applicant can ask USCIS to reconsider; there is no appeal or judicial review."],
    law: [LAW.ina207, LAW.cfr207],
    sources: [SRC.uscisRefugees],
    related: ["refugee-admission"],
  },
  "refugee-admission": {
    title: "Arrival and admission as a refugee",
    kind: "outcome",
    summary: "Admitted at a port of entry and resettled with an agency's help.",
    body: [
      "Approved refugees travel to the U.S., are admitted by CBP in refugee status, and are placed with a resettlement agency. They can work immediately.",
    ],
    agency: ["CBP", "State Department", "HHS Office of Refugee Resettlement"],
    law: [LAW.ina207],
    sources: [SRC.usrap],
    stats: ["refugees"],
    units: "Refugee arrivals per fiscal year.",
    related: ["refugee-green-card"],
    terms: ["refugee"],
  },
  "refugee-green-card": {
    title: "Green card after one year",
    kind: "process",
    summary: "Refugees must apply for permanent residence after a year here.",
    law: [LAW.ina209],
    sources: [SRC.uscisRefugees],
    related: ["adjustment", "lpr"],
  },
  "asylum-adjudication": {
    title: "Asylum adjudication",
    kind: "process",
    summary: "Decided by USCIS asylum officers (affirmative) or immigration judges (defensive).",
    body: [
      "An asylum claim is decided in one of two forums. A person not in removal proceedings applies affirmatively to USCIS. A person in removal proceedings applies defensively to the immigration judge, with ICE opposing.",
      "Applicants generally must file within one year of arrival unless an exception applies. Some people are barred — for example, for persecuting others, serious crimes, or firm resettlement elsewhere.",
    ],
    agency: ["USCIS Asylum Division", "EOIR immigration courts"],
    law: [LAW.ina208, LAW.cfr208],
    sources: [SRC.uscisAsylum, SRC.eoir],
    stats: ["asylum"],
    units: "Asylum grants per fiscal year.",
    related: ["aff-filing", "def-filing", "out-protection"],
    terms: ["asylum", "affirmative-asylum", "defensive-asylum"],
  },
  "aff-filing": {
    title: "Affirmative application to USCIS",
    kind: "process",
    summary: "Form I-589, filed by someone not in removal proceedings.",
    body: [
      "The applicant files Form I-589 with USCIS, generally within one year of arrival. They may be in lawful status, out of status, or paroled. A pending application can lead to work authorization after a waiting period.",
    ],
    agency: ["USCIS Asylum Division"],
    triggers: ["Present in the U.S. and not in removal proceedings"],
    law: [LAW.ina208, LAW.cfr208],
    sources: [SRC.uscisAffirmative],
    related: ["aff-interview"],
    terms: ["affirmative-asylum"],
  },
  "aff-interview": {
    title: "Asylum office interview and decision",
    kind: "decision",
    summary: "A non-adversarial interview with an asylum officer.",
    body: [
      "An asylum officer interviews the applicant; no government lawyer argues against the claim. The officer grants asylum, or — if the applicant has no other lawful status — refers the case to immigration court, where it is heard again from the start.",
      "If the applicant is still in lawful status, a non-grant is a denial and the person keeps that status.",
    ],
    agency: ["USCIS Asylum Division"],
    rights: ["May bring a lawyer at their own expense"],
    outcomes: [
      "Granted: asylee status",
      "Referred to immigration court (no lawful status)",
      "Denied (still in lawful status)",
    ],
    review: ["No appeal of a referral; the claim is heard anew by the immigration judge."],
    law: [LAW.ina208, LAW.cfr208],
    sources: [SRC.uscisAffirmative],
    stats: ["asylum"],
    related: ["out-protection", "aff-referral"],
  },
  "aff-referral": {
    title: "Referral to immigration court",
    kind: "process",
    summary: "USCIS issues a Notice to Appear; the claim continues defensively.",
    law: [LAW.ina240, LAW.cfr208],
    related: ["def-filing", "p240-nta"],
  },
  "def-filing": {
    title: "Defensive application before a judge",
    kind: "process",
    summary: "Asylum requested as a defense to removal in §240 proceedings.",
    body: [
      "A person in removal proceedings files Form I-589 with the immigration court. Withholding of removal and Convention Against Torture protection are usually requested together with asylum.",
    ],
    agency: ["EOIR immigration courts", "ICE Office of the Principal Legal Advisor (opposing counsel)"],
    triggers: ["In §240 removal proceedings, including after a positive credible-fear finding or a USCIS referral"],
    law: [LAW.ina208, LAW.ina240],
    sources: [SRC.eoirManual],
    related: ["def-hearing", "proc-240"],
    terms: ["defensive-asylum"],
  },
  "def-hearing": {
    title: "Merits hearing and decision",
    kind: "decision",
    summary: "An adversarial hearing; the judge grants, denies, or grants lesser protection.",
    body: [
      "The applicant testifies and presents evidence; an ICE attorney can cross-examine and argue against the claim. The judge decides asylum, withholding of removal, and CAT protection, and orders removal if all are denied.",
    ],
    agency: ["EOIR immigration courts"],
    rights: [
      "Counsel at no expense to the government",
      "Examine and present evidence, cross-examine witnesses",
      "Interpreter provided by the court",
    ],
    outcomes: ["Asylum granted", "Withholding or CAT protection only", "Denied and ordered removed"],
    review: [
      "Appeal to the Board of Immigration Appeals within 30 days, then a petition for review in a federal court of appeals.",
    ],
    law: [LAW.ina208, LAW.ina240, LAW.cfr1240_10],
    sources: [SRC.eoirManual],
    stats: ["asylum"],
    related: ["out-protection", "withholding-cat", "bia-appeal"],
  },
  parole: {
    title: "Humanitarian parole",
    kind: "process",
    summary: "Temporary permission to be in the U.S. — not an admission or a status.",
    body: [
      "DHS may parole a person into the U.S. case by case for urgent humanitarian reasons or significant public benefit. Parole lets someone be physically present for a set period; it is not admission and leads to no status on its own.",
      "Parolees may apply for asylum, work authorization, or — if otherwise eligible — adjustment of status.",
    ],
    agency: ["USCIS", "CBP", "ICE"],
    earlier: [
      "Category-wide parole programs used between 2021 and 2024 — for Ukrainians, Afghans, and nationals of Cuba, Haiti, Nicaragua, and Venezuela — were largely ended in 2025.",
    ],
    outcomes: [
      "Parole expires: the person must depart or obtain another status",
      "Parole terminated early",
      "Asylum or adjustment from parole",
    ],
    law: [LAW.ina212, LAW.cfr212_5],
    sources: [SRC.uscisParole],
    related: ["aff-filing", "adjustment", "enforcement-referral"],
    terms: ["parole"],
  },
  "parole-period": {
    title: "Paroled for a set period",
    kind: "process",
    summary: "Present lawfully but without a status; the clock runs out unless something follows.",
    law: [LAW.ina212, LAW.cfr212_5],
    related: ["aff-filing", "adjustment", "enforcement-referral"],
  },
  "credible-fear": {
    title: "Credible-fear screening",
    home: "processing",
    kind: "decision",
    summary: "Whether a person in expedited removal may pursue protection. Not a grant of asylum.",
    body: [
      "When someone in expedited removal says they fear persecution or torture or want asylum, an asylum officer interviews them. The question is only whether there is a 'significant possibility' they could establish eligibility.",
      "A positive finding sends the claim to full proceedings, where it is decided on the merits. A negative finding leads to removal unless an immigration judge reverses it.",
    ],
    agency: ["USCIS Asylum Division", "EOIR (review)"],
    triggers: ["A person in expedited removal expresses fear of return or an intent to apply for asylum"],
    rights: [
      "May consult a person of their choosing before the interview, if it causes no unreasonable delay",
      "Interpreter provided",
      "Request review by an immigration judge of a negative finding",
    ],
    outcomes: ["Positive: the claim proceeds to a full hearing", "Negative: removal, unless reversed on review"],
    review: ["Immigration judge review of a negative finding, generally within days; no further appeal to the BIA."],
    earlier: [
      "Rules on who may seek asylum at the southern border — and the standard applied at screening — have changed repeatedly since 2023 through regulations, proclamations, and court orders.",
    ],
    law: [LAW.ina235, LAW.cfr208_30, LAW.cfr1208_30],
    sources: [SRC.uscisCredibleFear],
    related: ["cf-review", "er-protection", "proc-expedited"],
  },
  "reasonable-fear": {
    title: "Reasonable-fear screening",
    home: "processing",
    kind: "decision",
    summary: "For reinstated or administratively removed people: may they seek withholding or CAT?",
    body: [
      "People whose prior order is reinstated, or who receive an administrative removal order, cannot apply for asylum. If they express fear, an asylum officer decides whether there is a 'reasonable possibility' of persecution or torture — a higher bar than credible fear.",
    ],
    agency: ["USCIS Asylum Division", "EOIR (review)"],
    outcomes: ["Positive: withholding-only proceedings before a judge", "Negative: removal, unless reversed on review"],
    review: ["Immigration judge review of a negative finding."],
    law: [LAW.cfr208_31, LAW.ina241],
    sources: [SRC.uscisCredibleFear],
    related: ["withholding-only", "withholding-cat"],
  },
  "withholding-cat": {
    title: "Withholding of removal and CAT protection",
    kind: "outcome",
    summary: "Bars removal to a specific country; narrower than asylum.",
    body: [
      "Withholding of removal requires showing persecution is more likely than not. Convention Against Torture protection requires showing torture is more likely than not, and has no criminal bars for its deferral form.",
      "Neither leads to a green card or lets the person bring family; DHS can still remove the person to a third country.",
    ],
    law: [LAW.ina241, LAW.cfr208],
    related: ["out-protection", "def-hearing"],
  },

  // ---------------------------------------------------------- Unauthorized
  unauthorized: {
    title: "Unauthorized immigration",
    kind: "process",
    summary: "Entering without inspection, overstaying, or violating status — not one entry route.",
    body: [
      "People come to lack lawful status in different ways. Some entered without inspection; many were admitted lawfully and later overstayed or violated their status.",
      "Some unauthorized immigrants have temporary protection from removal — Temporary Protected Status or deferred action — without a lawful permanent or nonimmigrant status.",
    ],
    law: [LAW.ina212, LAW.ina237, LAW.ina244],
    sources: [SRC.ohssUnauthorized, SRC.ohssOverstay],
    stats: ["unauthorized"],
    units: "The population is an estimate as of January 1; it is not measured by border encounters.",
    related: ["unauthorized-population", "enforcement"],
    terms: ["unauthorized", "overstay"],
    opens: { tracks: "pathway", flow: "unauthorized" },
  },
  ewi: {
    title: "Entry without inspection",
    kind: "process",
    summary: "Crossing outside a port without being admitted.",
    body: [
      "A person present without admission or parole is inadmissible and is treated as an applicant for admission. Improper entry is also a federal misdemeanor; reentry after removal is a felony.",
    ],
    law: [LAW.ina212, LAW.usc1325, LAW.usc1326],
    related: ["entry-between", "unlawful-presence", "prosecution"],
  },
  "status-violation": {
    title: "Other status violations",
    kind: "process",
    summary: "Working without authorization, dropping out of school, or other breaches.",
    body: [
      "A nonimmigrant who violates the conditions of their class — for example by working without authorization or failing to maintain a full course of study — falls out of status even before their I-94 date.",
      "Permanent residents can also become removable, for certain crimes or fraud.",
    ],
    law: [LAW.ina237, LAW.cfr214_1],
    related: ["unlawful-presence", "enforcement-referral"],
  },
  "unlawful-presence": {
    title: "Unlawful presence",
    kind: "process",
    summary: "Time accrued without authorization triggers bars to returning.",
    body: [
      "Someone who accrues more than 180 days of unlawful presence and then departs is barred from returning for three years; more than one year triggers a ten-year bar. Some waivers exist.",
      "These bars apply on departure, which is why many people eligible for a green card through a relative avoid leaving to process abroad unless they first obtain a provisional waiver.",
    ],
    law: [LAW.ina212],
    outcomes: ["3-year or 10-year bar on departure", "Removability"],
    related: ["status-routes", "enforcement-referral"],
  },
  "status-routes": {
    title: "Limited routes to status",
    kind: "decision",
    summary: "Adjustment through a citizen relative, asylum, TPS, U/T visas, cancellation.",
    body: [
      "A few routes remain open to some people without status: adjustment as the immediate relative of a citizen (if they were admitted or paroled), asylum within a year of arrival, Temporary Protected Status for designated countries, U and T visas for certain crime and trafficking victims, and cancellation of removal before an immigration judge.",
    ],
    law: [LAW.ina245, LAW.ina244, LAW.ina240a, LAW.ina208],
    sources: [SRC.uscisTps],
    related: ["adjustment", "asylum-adjudication", "out-relief"],
  },
  "enforcement-referral": {
    title: "Enforcement referral",
    kind: "process",
    summary: "How a case enters the enforcement system: an encounter, an arrest, or a referral.",
    body: [
      "Cases reach enforcement through a CBP encounter at the border, an ICE arrest in the interior (often through a jail detainer or a 287(g) partnership with local police), or a USCIS Notice to Appear after an application is denied.",
    ],
    agency: ["CBP", "ICE", "USCIS"],
    law: [LAW.ina287, LAW.cfr287_7, LAW.ina240],
    sources: [SRC.iceEro, SRC.ice287g],
    related: ["enforcement", "ice-arrest", "p240-nta"],
  },

  // ----------------------------------------------------------- Enforcement
  enforcement: {
    title: "Enforcement and removal",
    kind: "process",
    summary: "From encounter or arrest to a removal procedure, custody, review, and an outcome.",
    body: [
      "Immigration enforcement is civil, not criminal: removal is not punishment, and many protections of criminal court (a free lawyer, a jury) do not apply. Separate criminal prosecution for immigration crimes happens in federal court.",
      "Not every case gets the same process. Which procedure applies — full proceedings before a judge, expedited removal by an officer, reinstatement of an old order, or administrative removal — determines what hearing, if any, the person receives and what review is available.",
    ],
    agency: ["CBP", "ICE", "EOIR", "federal courts"],
    law: [LAW.ina235, LAW.ina236, LAW.ina238, LAW.ina240, LAW.ina241, LAW.ina242],
    sources: [SRC.iceEro, SRC.eoir],
    stats: ["removals", "detention"],
    units: "Removals and returns count events; detention is an average daily population.",
    related: ["proc-240", "proc-expedited", "detention"],
    terms: ["removal", "deportation", "return"],
  },
  "ice-arrest": {
    title: "Interior arrest by ICE",
    kind: "process",
    summary: "Arrests away from the border, often after a local jail booking.",
    body: [
      "ICE officers can arrest a noncitizen on an administrative warrant (signed by an immigration officer, not a judge) to start or carry out removal. Many interior arrests follow a detainer asking a jail to hold someone briefly for transfer.",
      "Under 287(g) agreements, trained state and local officers perform some immigration functions.",
    ],
    agency: ["ICE Enforcement and Removal Operations", "287(g) partner agencies"],
    rights: [
      "A lawyer at the person's own expense; the government does not appoint one",
      "Notice of the charges if proceedings are started",
    ],
    law: [LAW.ina236, LAW.ina287, LAW.cfr287_7],
    sources: [SRC.iceEro, SRC.ice287g],
    related: ["initial-processing", "custody-decision"],
    terms: ["ice"],
  },
  "initial-processing": {
    title: "Initial processing and status determination",
    kind: "process",
    summary: "Identity, criminal and immigration history, and claims to status or citizenship.",
    body: [
      "Officers record biometrics, check immigration and criminal databases, and establish whether the person is a citizen, has a status, has a prior removal order, or entered recently. Those facts determine which procedure applies.",
      "Unaccompanied children must generally be transferred to HHS custody within 72 hours and are placed in full proceedings rather than expedited removal.",
    ],
    agency: ["CBP", "ICE"],
    law: [LAW.ina235, LAW.ina236],
    related: ["procedure-choice"],
    terms: ["uac"],
  },
  "procedure-choice": {
    title: "Which removal procedure applies",
    kind: "decision",
    summary: "Full proceedings, expedited removal, reinstatement, or administrative removal.",
    body: [
      "The procedure depends on the person's history and how they came to the government's attention: recent arrivals without valid documents may be placed in expedited removal; people previously removed who returned illegally may have the old order reinstated; non-permanent residents with aggravated-felony convictions may be removed administratively; everyone else — and anyone DHS chooses — goes before an immigration judge.",
    ],
    law: [LAW.ina235, LAW.ina238, LAW.ina240, LAW.ina241],
    related: ["proc-240", "proc-expedited", "proc-reinstatement", "proc-admin"],
  },
  "proc-240": {
    title: "Removal proceedings (§240)",
    home: "processing",
    kind: "process",
    summary: "Full hearing before an immigration judge, with appeal to the BIA and the courts.",
    body: [
      "Section 240 proceedings are the standard process: DHS charges the person on a Notice to Appear, an immigration judge decides removability and any relief, and the decision can be appealed to the Board of Immigration Appeals and then to a federal court of appeals.",
    ],
    agency: ["EOIR", "ICE (prosecuting attorneys)"],
    rights: [
      "Counsel at no expense to the government",
      "Reasonable opportunity to examine evidence, present evidence, and cross-examine witnesses",
      "Interpreter provided by the court",
      "Notice of hearings; a removal order in absentia only after written notice",
    ],
    review: [
      "BIA appeal within 30 days",
      "Petition for review in a federal court of appeals within 30 days of a final order",
    ],
    law: [LAW.ina240, LAW.cfr1240, LAW.cfr1003_14],
    sources: [SRC.eoir, SRC.eoirManual],
    related: ["p240-nta", "bia-appeal", "petition-for-review"],
    opens: { tracks: "procedure", flow: "flow-240" },
  },
  "proc-expedited": {
    title: "Expedited removal",
    kind: "process",
    summary: "Removal ordered by an officer, without a hearing before a judge.",
    body: [
      "Expedited removal lets an immigration officer order someone removed without a hearing or judge. It applies to arriving people inadmissible for fraud or missing documents, and — to the extent DHS designates — to people who entered without inspection and cannot show two years' continuous presence.",
      "It does not include the hearing, evidence rights, or appeals of §240 proceedings. The main safeguard is the credible-fear screening for people who express fear.",
    ],
    agency: ["CBP", "ICE", "USCIS (fear screenings)"],
    earlier: [
      "DHS's designation of who may be placed in expedited removal has been widened and narrowed several times since 1997, and its 2025 expansion has been challenged in court.",
    ],
    law: [LAW.ina235, LAW.cfr235_3],
    sources: [SRC.uscisCredibleFear],
    related: ["credible-fear", "er-eligibility"],
    opens: { tracks: "procedure", flow: "flow-expedited" },
  },
  "proc-reinstatement": {
    title: "Reinstatement of a prior order",
    kind: "process",
    summary: "A returning removed person's old order is reinstated — no new hearing.",
    body: [
      "If someone who was removed (or left under an order) reenters illegally, an immigration officer can reinstate the prior order. The person is not entitled to a hearing before a judge and cannot apply for most relief, but can seek withholding or CAT protection through a reasonable-fear screening.",
    ],
    agency: ["ICE", "CBP"],
    law: [LAW.ina241, LAW.cfr241_8],
    related: ["reasonable-fear", "reinst-prior"],
    opens: { tracks: "procedure", flow: "flow-reinstatement" },
  },
  "proc-admin": {
    title: "Administrative removal (§238(b))",
    kind: "process",
    summary: "For non-permanent residents convicted of an aggravated felony; decided by DHS.",
    body: [
      "DHS can order removal of a person who is not a permanent resident and has an aggravated-felony conviction without a hearing before an immigration judge. The person is ineligible for discretionary relief but can seek withholding or CAT protection.",
    ],
    agency: ["ICE"],
    law: [LAW.ina238, LAW.cfr238_1],
    related: ["admin-notice", "reasonable-fear"],
    opens: { tracks: "procedure", flow: "flow-admin" },
  },
  "custody-decision": {
    title: "Detention or release",
    kind: "decision",
    summary: "Held in ICE detention, released on bond or conditions, or paroled.",
    body: [
      "Whether a person is held during their case depends on the legal authority: some are subject to mandatory detention, some can be released on bond or conditions by ICE or an immigration judge, and some arriving people can only be released on parole.",
      "Detention is civil custody while a case is decided or a removal is arranged.",
    ],
    agency: ["ICE", "EOIR (bond hearings)"],
    law: [LAW.ina236, LAW.ina235, LAW.ina241],
    sources: [SRC.iceDetention],
    stats: ["detention", "states:det"],
    units: "Average daily population, by fiscal year.",
    related: ["detention", "mandatory-detention", "bond", "release"],
    terms: ["ice-detention", "mandatory-detention"],
  },
  "review-mechanisms": {
    title: "Hearings, screenings, and review",
    kind: "process",
    summary: "What review exists depends on the procedure.",
    body: [
      "In §240 proceedings: hearings before a judge, appeal to the BIA, and a petition for review in a court of appeals. In expedited removal: a credible-fear screening and judge review of a negative finding. In reinstatement and administrative removal: a reasonable-fear screening, withholding-only proceedings, and a petition for review.",
    ],
    law: [LAW.ina240, LAW.ina242, LAW.cfr1208_30],
    related: ["bia-appeal", "petition-for-review", "credible-fear", "reasonable-fear"],
  },
  "removal-order": {
    title: "Removal order",
    home: "processing",
    kind: "outcome",
    summary: "An order that the person be removed; final once appeals end or are waived.",
    body: [
      "An immigration judge's order becomes final when the BIA dismisses an appeal, the appeal period runs out, or appeal is waived. Expedited, reinstated, and administrative orders are issued by officers.",
      "After a final order, ICE has a 90-day removal period during which detention is generally required; longer detention is limited when removal is not reasonably foreseeable.",
    ],
    law: [LAW.ina241, LAW.cfr1241_1],
    related: ["out-removal", "stay-of-removal", "petition-for-review"],
  },
  detention: {
    title: "Immigration detention",
    kind: "process",
    summary: "Civil custody in ICE facilities, contracted jails, and private centers.",
    body: [
      "ICE holds people in its own facilities, in contracted private facilities, and in local jails under agreements. Detention is civil custody, not a criminal sentence; people without criminal convictions make up a large share of the detained population.",
    ],
    agency: ["ICE"],
    law: [LAW.ina236, LAW.ina241],
    sources: [SRC.iceDetention],
    stats: ["detention", "states:det"],
    units: "Average daily population; not the number of people who passed through detention.",
    related: ["mandatory-detention", "bond", "release"],
    terms: ["ice-detention", "criminal-conviction", "threat-level"],
  },
  "mandatory-detention": {
    title: "Mandatory detention",
    kind: "process",
    summary: "Categories the law says must be held, with no bond hearing.",
    body: [
      "INA §236(c) requires detention of people removable on certain criminal or terrorism grounds, without bond. The 2025 Laken Riley Act added people who entered without inspection, lack documents, or committed fraud and are charged with or arrested for certain theft, burglary, assault-on-officer, or injury offenses.",
      "People in expedited removal are detained during fear screenings, and arriving applicants for admission can generally be released only on parole.",
      "A person can contest whether they actually fall within a mandatory category.",
    ],
    agency: ["ICE"],
    earlier: [
      "In 2025 DHS and the Board of Immigration Appeals took the position that people who entered without inspection are held under §235(b) and are not eligible for bond hearings; many federal courts have rejected that position in individual habeas cases.",
    ],
    review: [
      "A hearing before a judge on whether the person is properly included in the mandatory category",
      "Federal habeas corpus petitions challenging detention",
    ],
    law: [LAW.ina236, LAW.ina235],
    sources: [SRC.iceDetention],
    related: ["bond", "detention"],
    terms: ["mandatory-detention"],
  },
  bond: {
    title: "Bond and custody hearings",
    kind: "process",
    summary: "ICE sets custody; a judge can review it for people not mandatorily detained.",
    body: [
      "For people held under §236(a), ICE makes an initial custody decision: detain, release on bond (at least $1,500), or release on conditions. The person can ask an immigration judge to redetermine custody; the judge weighs flight risk and danger.",
      "Bond hearings are separate from the removal case and can be appealed to the BIA.",
    ],
    agency: ["ICE", "EOIR"],
    rights: [
      "Bond redetermination hearing before a judge, for eligible detainees",
      "Appeal of the bond decision to the BIA",
    ],
    law: [LAW.ina236, LAW.cfr236_1, LAW.cfr1236_1, LAW.cfr1003_19],
    sources: [SRC.eoirManual],
    related: ["release", "mandatory-detention"],
  },
  release: {
    title: "Release pending proceedings",
    kind: "outcome",
    summary: "Bond, conditional release, parole, or alternatives to detention.",
    body: [
      "Most people in removal proceedings are not detained. They may be released on bond, on their own recognizance, on parole, or into an alternatives-to-detention program with check-ins or electronic monitoring, and must attend hearings.",
    ],
    agency: ["ICE"],
    law: [LAW.ina236, LAW.ina212],
    related: ["proc-240"],
  },
  "voluntary-departure": {
    title: "Voluntary departure",
    kind: "outcome",
    summary: "Leaving at one's own expense by a deadline, avoiding a removal order.",
    body: [
      "DHS or an immigration judge can grant voluntary departure before proceedings end (up to 120 days to leave) or at their conclusion (up to 60 days, requiring a year of presence, good moral character, and a bond).",
      "Failing to leave on time brings a civil fine and a ten-year bar on several forms of relief.",
    ],
    agency: ["ICE", "EOIR"],
    law: [LAW.ina240b, LAW.cfr1240_26],
    related: ["out-other-departure"],
    terms: ["return"],
  },
  "stay-of-removal": {
    title: "Stay of removal",
    kind: "process",
    summary: "A temporary bar on carrying out a removal order.",
    body: [
      "A timely BIA appeal automatically stays removal. A petition for review in a court of appeals does not; the person must ask the court for a stay. ICE can also grant an administrative stay, and a motion to reopen an in-absentia order stays removal while it is decided.",
    ],
    law: [LAW.cfr1003_6, LAW.cfr241_6, LAW.ina242],
    related: ["bia-appeal", "petition-for-review"],
  },
  "judicial-review": {
    title: "Judicial review",
    kind: "process",
    summary: "Federal courts can review some removal decisions — with important limits.",
    body: [
      "A final §240 order can be reviewed by petition in a federal court of appeals, filed within 30 days. Courts generally cannot review discretionary decisions (such as cancellation of removal) except for constitutional claims and questions of law.",
      "Review of expedited removal orders is very narrow. Detention can be challenged through habeas corpus in district court.",
    ],
    agency: ["Federal courts of appeals", "Federal district courts (habeas)"],
    law: [LAW.ina242],
    related: ["petition-for-review", "bia-appeal"],
  },
  prosecution: {
    title: "Criminal prosecution",
    kind: "process",
    summary: "Illegal entry and reentry are federal crimes, tried separately in federal court.",
    body: [
      "Improper entry (8 U.S.C. §1325) is a misdemeanor for a first offense; reentry after removal (§1326) is a felony. Prosecution happens in federal criminal court with full criminal protections, separately from any removal case.",
    ],
    agency: ["Department of Justice (U.S. Attorneys)", "federal courts"],
    law: [LAW.usc1325, LAW.usc1326],
    related: ["ewi", "proc-reinstatement"],
  },

  // ---------------------------------------------------------- §240 detail
  "p240-nta": {
    title: "Notice to Appear",
    kind: "process",
    summary: "DHS charges the person and files the NTA with the immigration court.",
    body: [
      "A Notice to Appear (Form I-862) states the factual allegations and the legal charges of removability. Proceedings begin when DHS files it with the immigration court.",
    ],
    agency: ["ICE", "CBP", "USCIS (issuing)", "EOIR (filing)"],
    rights: [
      "Written notice of the charges, the hearing, and the right to counsel",
      "A list of free legal service providers",
    ],
    law: [LAW.ina240, LAW.cfr1003_14],
    sources: [SRC.eoirManual],
    related: ["p240-master"],
  },
  "p240-master": {
    title: "Master calendar hearing",
    kind: "process",
    summary: "A short preliminary hearing, often with many cases scheduled together.",
    body: [
      "The judge explains the person's rights, asks whether they have a lawyer, and schedules the case. Missing a hearing after proper notice can lead to a removal order in absentia.",
    ],
    agency: ["EOIR"],
    rights: ["Advisal of rights", "Time to find counsel", "Interpreter"],
    review: [
      "An in-absentia order can be reopened for exceptional circumstances (within 180 days) or lack of notice (any time).",
    ],
    law: [LAW.ina240, LAW.cfr1240_10],
    sources: [SRC.eoirManual],
    related: ["p240-pleadings"],
  },
  "p240-pleadings": {
    title: "Pleadings",
    kind: "process",
    summary: "Admit or deny the allegations, concede or contest the charges, name relief.",
    body: [
      "The respondent responds to the NTA's allegations and charges and designates a country of removal. DHS must prove removability — by clear and convincing evidence for people who were admitted; people who were never admitted must prove they are entitled to be here.",
    ],
    agency: ["EOIR"],
    law: [LAW.ina240, LAW.cfr1240_10],
    related: ["p240-relief"],
  },
  "p240-relief": {
    title: "Applications for relief",
    kind: "process",
    summary: "Asylum, withholding, CAT, cancellation, adjustment, waivers, voluntary departure.",
    body: [
      "Relief depends on the person's history: asylum and related protection, cancellation of removal (for permanent residents with seven years' residence, or others with ten years' presence and qualifying relatives facing exceptional hardship), adjustment of status, waivers, and voluntary departure.",
    ],
    agency: ["EOIR"],
    law: [LAW.ina208, LAW.ina240a, LAW.ina245, LAW.ina240b],
    related: ["def-filing", "out-relief"],
  },
  "p240-merits": {
    title: "Individual merits hearing",
    kind: "process",
    summary: "The evidentiary hearing on contested removability or relief.",
    agency: ["EOIR", "ICE (opposing counsel)"],
    rights: [
      "Present and examine evidence",
      "Cross-examine witnesses",
      "Counsel at no expense to the government",
      "Interpreter",
    ],
    law: [LAW.ina240, LAW.cfr1240_10],
    related: ["p240-decision"],
  },
  "p240-decision": {
    title: "Immigration judge's decision",
    kind: "decision",
    summary: "Relief granted, proceedings terminated, voluntary departure, or a removal order.",
    agency: ["EOIR"],
    outcomes: ["Relief granted", "Proceedings terminated or dismissed", "Voluntary departure", "Order of removal"],
    review: ["Either side can appeal to the BIA within 30 days."],
    law: [LAW.ina240],
    related: ["bia-appeal"],
  },
  "bia-appeal": {
    title: "Appeal to the Board of Immigration Appeals",
    home: "processing",
    kind: "process",
    summary: "Filed within 30 days; the Board reviews the judge's decision.",
    body: [
      "The Board of Immigration Appeals reviews immigration judge decisions, mostly on the written record. A timely appeal generally stays removal. The Board can affirm, reverse, or send the case back.",
    ],
    agency: ["EOIR Board of Immigration Appeals"],
    triggers: ["Notice of appeal (Form EOIR-26) filed within 30 days of the judge's decision"],
    outcomes: ["Appeal dismissed: the order is final", "Appeal sustained", "Remanded to the judge"],
    review: ["Petition for review in a federal court of appeals"],
    law: [LAW.cfr1003_38, LAW.cfr1003_6],
    sources: [SRC.bia, SRC.bpm],
    related: ["petition-for-review", "stay-of-removal"],
  },
  "petition-for-review": {
    title: "Petition for review in a court of appeals",
    kind: "process",
    summary: "Filed within 30 days of a final order; limited by statute.",
    body: [
      "The federal court of appeals for the region reviews the final order on the administrative record. Filing does not automatically stop removal. Courts cannot review many discretionary decisions, but can review constitutional claims and questions of law.",
    ],
    agency: ["Federal courts of appeals"],
    law: [LAW.ina242],
    related: ["judicial-review", "stay-of-removal"],
  },

  // ----------------------------------------------------- Expedited detail
  "er-eligibility": {
    title: "Who can be placed in expedited removal",
    kind: "decision",
    summary: "Arriving people with false or no documents; some recent entrants.",
    body: [
      "It covers people arriving at a port who are inadmissible for fraud or lack of valid documents, and — as far as DHS designates, up to the statute's limit — people who entered without inspection and cannot show two years' continuous presence.",
      "It does not apply to unaccompanied children, and people who claim to be citizens, permanent residents, refugees, or asylees get a review of that claim.",
    ],
    law: [LAW.ina235, LAW.cfr235_3],
    related: ["er-inspection"],
  },
  "er-inspection": {
    title: "Inspection and processing",
    kind: "process",
    summary: "A sworn statement; the officer must ask about fear of return.",
    body: [
      "The officer records a sworn statement and must ask whether the person fears being returned. A supervisor reviews the order.",
    ],
    agency: ["CBP", "ICE"],
    law: [LAW.cfr235_3],
    related: ["er-fear"],
  },
  "er-fear": {
    title: "Fear of persecution or torture expressed?",
    kind: "decision",
    summary: "If yes, the case goes to a credible-fear screening before any removal.",
    law: [LAW.ina235, LAW.cfr235_3],
    related: ["credible-fear", "er-order"],
  },
  "er-order": {
    title: "Expedited removal order",
    kind: "outcome",
    summary: "Issued by an officer; brings a five-year bar on returning.",
    law: [LAW.ina235, LAW.ina212],
    related: ["out-removal"],
  },
  "cf-review": {
    title: "Judge review of a negative finding",
    kind: "process",
    summary: "An immigration judge reviews a negative credible-fear finding on request.",
    body: [
      "The review is quick, limited to the fear question, and its result cannot be appealed to the BIA. If the judge reverses, the claim goes forward; if the judge agrees, the person is removed.",
    ],
    agency: ["EOIR"],
    law: [LAW.cfr1208_30],
    related: ["credible-fear"],
  },
  "er-protection": {
    title: "Full protection proceedings",
    kind: "process",
    summary: "After a positive finding, the asylum claim is decided on its merits.",
    body: [
      "A positive credible-fear finding usually leads to §240 proceedings before an immigration judge, where the person applies for asylum defensively.",
    ],
    law: [LAW.ina235, LAW.cfr208_30],
    related: ["def-filing", "proc-240"],
  },

  // -------------------------------------------- Reinstatement and §238(b)
  "reinst-prior": {
    title: "Prior order and unlawful reentry",
    kind: "decision",
    summary: "The officer confirms identity, the prior order, and the illegal reentry.",
    law: [LAW.ina241, LAW.cfr241_8],
    related: ["reinst-order"],
  },
  "reinst-order": {
    title: "Prior order reinstated",
    kind: "process",
    summary: "No new hearing; most relief is barred.",
    rights: ["Written notice and an opportunity to make a statement contesting the determination"],
    law: [LAW.ina241, LAW.cfr241_8],
    related: ["reasonable-fear", "petition-for-review"],
  },
  "withholding-only": {
    title: "Withholding-only proceedings",
    kind: "process",
    summary: "A judge decides only withholding and CAT protection.",
    agency: ["EOIR"],
    review: ["BIA appeal, then a petition for review"],
    law: [LAW.cfr208_31],
    related: ["withholding-cat"],
  },
  "admin-notice": {
    title: "Notice of Intent (Form I-851)",
    kind: "process",
    summary: "DHS serves the charges; the person has a short period to respond.",
    rights: [
      "Notice of the charges",
      "Counsel at no expense to the government",
      "A short period to rebut the charges in writing",
    ],
    law: [LAW.ina238, LAW.cfr238_1],
    related: ["admin-order"],
  },
  "admin-order": {
    title: "Final administrative removal order (Form I-851A)",
    kind: "outcome",
    summary: "Issued by a DHS deciding officer; carried out after a short waiting period.",
    review: ["Petition for review in a federal court of appeals", "Reasonable-fear screening if fear is expressed"],
    law: [LAW.ina238, LAW.cfr238_1],
    related: ["petition-for-review", "reasonable-fear"],
  },

  // -------------------------------------------------------------- Outcomes
  "out-protection": {
    title: "Humanitarian protection",
    kind: "outcome",
    summary: "Asylum, refugee status, withholding of removal, or CAT protection.",
    body: [
      "Asylees and refugees can work, petition for spouses and children, and apply for a green card after a year. Withholding and CAT protection only bar removal to a specific country.",
    ],
    law: [LAW.ina207, LAW.ina208, LAW.ina241],
    stats: ["refugees", "asylum"],
    units: "Grants and arrivals per fiscal year.",
    related: ["refugee-green-card", "withholding-cat"],
    terms: ["asylum", "refugee"],
  },
  "out-relief": {
    title: "Relief from removal",
    kind: "outcome",
    summary: "A judge grants a status or waiver that ends the removal case.",
    body: [
      "Relief includes asylum, cancellation of removal (which grants a green card), adjustment of status, and waivers of removability.",
    ],
    law: [LAW.ina240a, LAW.ina208, LAW.ina245],
    related: ["lpr", "out-protection"],
  },
  "out-termination": {
    title: "Proceedings terminated or dismissed",
    kind: "outcome",
    summary: "The case ends without a removal order — e.g., charges not proved.",
    law: [LAW.cfr1240],
    related: ["proc-240"],
  },
  "out-removal": {
    title: "Removal",
    kind: "outcome",
    summary: "Departure under an order, with bars on returning.",
    body: [
      "A removal carries a bar on returning: five years after expedited removal or removal at arrival, ten years after other removals, twenty for a second removal, and permanently for aggravated felons — unless DHS consents. Reentering after removal is a felony.",
    ],
    agency: ["ICE"],
    law: [LAW.ina241, LAW.ina212, LAW.usc1326],
    sources: [SRC.iceEro],
    stats: ["removals"],
    units: "Removals count events, not unique people.",
    related: ["proc-reinstatement"],
    terms: ["removal", "deportation"],
  },
  "out-other-departure": {
    title: "Other authorized departures",
    kind: "outcome",
    summary: "Returns without an order: voluntary return, withdrawal of an application.",
    body: [
      "DHS counts confirmed departures without a removal order as returns. They carry no formal removal penalty, though unlawful-presence bars may still apply.",
    ],
    earlier: ["From 2020 to 2023, Title 42 public-health expulsions were a separate, third category of departure."],
    law: [LAW.ina240b, LAW.ina235],
    stats: ["removals"],
    units: "Returns count events.",
    related: ["voluntary-departure"],
    terms: ["return", "title-42"],
  },

  // ------------------------------------------------------------ Population
  "foreign-born": {
    title: "Foreign-born population",
    kind: "measure",
    summary: "Everyone living here who was not a U.S. citizen at birth, any status.",
    body: [
      "The Census Bureau's American Community Survey counts the foreign-born: naturalized citizens, permanent residents, temporary residents, refugees, and unauthorized immigrants alike.",
      "It is a population stock — it changes by arrivals, departures, and deaths, not just by any one flow above.",
    ],
    sources: [SRC.censusFb],
    stats: ["population", "states:fb"],
    units: "Residents in a survey year; a stock, not a yearly flow.",
    related: ["naturalization", "unauthorized-population", "history"],
    terms: ["foreign-born", "stock"],
  },
  "lpr-population": {
    title: "Permanent-resident population",
    kind: "measure",
    summary: "Green-card holders living here; DHS publishes periodic estimates.",
    body: [
      "DHS estimates how many permanent residents live in the U.S. and how many are eligible to naturalize. Worldview does not yet import these estimates; the yearly green-card grants are under Lawful permanent residence.",
    ],
    sources: [SRC.ohssLpr],
    related: ["lpr", "naturalization"],
    terms: ["lpr"],
  },
  "unauthorized-population": {
    title: "Unauthorized population",
    kind: "measure",
    summary: "Estimated by subtraction; no agency counts it directly.",
    body: [
      "DHS estimates the unauthorized population as the survey-measured foreign-born population, adjusted for undercount, minus everyone known to be here lawfully. Pew Research Center estimates 14 million as of July 2023 using similar methods.",
      "It includes people who entered lawfully and overstayed, and people who arrived decades ago. Border encounters do not measure it.",
    ],
    sources: [SRC.ohssUnauthorized],
    stats: ["unauthorized"],
    units: "Estimated residents as of January 1.",
    related: ["unauthorized", "foreign-born"],
    terms: ["unauthorized"],
  },
  "net-migration": {
    title: "Net international migration",
    kind: "measure",
    summary: "Everyone moving in from abroad minus everyone moving abroad.",
    body: [
      "The Census Bureau's population estimates count everyone who moves to the U.S. for a year or more — any status, including returning citizens — minus everyone who moves abroad. It is not green cards minus deportations.",
    ],
    stats: ["netMigration", "states:intl"],
    units: "People, in the year to July 1.",
    related: ["foreign-born"],
    terms: ["nim"],
  },
  history: {
    title: "History since 1850",
    kind: "measure",
    summary: "The foreign-born share at every census, then the yearly survey.",
    stats: ["history"],
    units: "Percent of residents.",
    related: ["foreign-born"],
  },
  states: {
    title: "Across the states",
    kind: "measure",
    summary: "Compare states on population, green cards, encounters, detention, and moves.",
    body: ["Pick a measure to map. State figures also appear inside each relevant step's statistics."],
    stats: ["states:fb"],
    related: ["related-migration"],
  },
  "related-migration": {
    title: "Related migration",
    kind: "context",
    summary: "Moves between states and Americans abroad — often confused with immigration.",
    body: [
      "Moving from California to Texas is domestic migration, not immigration. Americans living abroad are counted by other countries' censuses; the U.S. keeps no register of people who leave.",
    ],
    stats: ["domestic", "abroad", "states:dom"],
    units: "Domestic moves: people per survey year. Abroad: a mid-year population stock.",
    related: ["states", "net-migration"],
    terms: ["stock"],
  },
};

// ------------------------------------------------------------------ Flows

export const FLOWS: Record<string, Flow> = {
  permanent: {
    id: "permanent",
    label: "Permanent",
    steps: [
      { ids: ["permanent"] },
      { ids: ["immigrant-categories"] },
      { ids: ["cat-family", "cat-employment", "cat-diversity", "cat-other"], edge: "if", label: "one of" },
      { ids: ["petition"] },
      { ids: ["consular-processing", "adjustment"], edge: "if", label: "abroad, or already here" },
      { ids: ["lpr"], edge: "status" },
      { ids: ["naturalization"], edge: "if", label: "if eligible and pursued" },
    ],
  },
  temporary: {
    id: "temporary",
    label: "Temporary",
    steps: [
      { ids: ["temporary"] },
      { ids: ["nonimmigrant-class"] },
      { ids: ["authorized-stay"] },
      { ids: ["stay-decision"] },
      { ids: ["extend-stay", "change-status", "adjustment", "depart-on-time"], edge: "if", label: "one of" },
      { ids: ["out-temporary-stay", "lpr", "overstay"], edge: "if", label: "possible results" },
      { ids: ["enforcement-referral"], edge: "if", label: "after an overstay or violation" },
    ],
  },
  humanitarian: {
    id: "humanitarian",
    label: "Humanitarian",
    steps: [{ ids: ["humanitarian"] }],
    after: [
      {
        kind: "tracks",
        id: "humanitarian-route",
        label: "Route",
        flows: ["refugee", "affirmative", "defensive", "parole"],
      },
      {
        kind: "nodes",
        title: "Screenings — these decide whether a claim can proceed, not whether it is granted",
        ids: ["credible-fear", "reasonable-fear"],
        cols: 2,
      },
    ],
  },
  refugee: {
    id: "refugee",
    label: "Refugee",
    steps: [
      { ids: ["refugee-referral"] },
      { ids: ["refugee-interview"] },
      { ids: ["refugee-admission"], edge: "status", label: "if approved" },
      { ids: ["refugee-green-card"] },
      { ids: ["lpr"], edge: "status" },
    ],
  },
  affirmative: {
    id: "affirmative",
    label: "Affirmative asylum",
    steps: [
      { ids: ["aff-filing"] },
      { ids: ["aff-interview"] },
      { ids: ["out-protection", "aff-referral"], edge: "if", label: "granted, or referred" },
      { ids: ["def-filing"], edge: "if", label: "if referred" },
    ],
  },
  defensive: {
    id: "defensive",
    label: "Defensive asylum",
    steps: [
      { ids: ["proc-240"] },
      { ids: ["def-filing"] },
      { ids: ["def-hearing"] },
      { ids: ["out-protection", "withholding-cat", "removal-order"], edge: "if", label: "the judge decides" },
      { ids: ["bia-appeal"], edge: "if", label: "if appealed" },
    ],
  },
  parole: {
    id: "parole",
    label: "Parole",
    steps: [
      { ids: ["parole"] },
      { ids: ["parole-period"] },
      {
        ids: ["aff-filing", "adjustment", "out-other-departure", "enforcement-referral"],
        edge: "if",
        label: "before parole ends",
      },
    ],
  },
  unauthorized: {
    id: "unauthorized",
    label: "Unauthorized",
    steps: [
      { ids: ["unauthorized"] },
      { ids: ["ewi", "overstay", "status-violation"], edge: "if", label: "ways status is lacking or lost" },
      { ids: ["unlawful-presence"] },
      { ids: ["status-routes", "enforcement-referral"], edge: "if", label: "possible next steps" },
      { ids: ["unauthorized-population"], edge: "context", label: "counted in estimates" },
    ],
  },
  enforcement: {
    id: "enforcement",
    label: "Enforcement",
    steps: [
      { ids: ["enforcement"] },
      { ids: ["border-encounter", "ice-arrest"], edge: "if", label: "identification" },
      { ids: ["initial-processing"] },
      { ids: ["procedure-choice"] },
      {
        ids: ["proc-240", "proc-expedited", "proc-reinstatement", "proc-admin"],
        edge: "if",
        label: "one procedure applies",
      },
      { ids: ["custody-decision"] },
      { ids: ["review-mechanisms"] },
      { ids: ["removal-order"], edge: "if", label: "if ordered removed" },
      { ids: ["judicial-review"], edge: "if", label: "where available" },
      {
        ids: ["out-removal", "voluntary-departure", "out-relief", "out-termination"],
        edge: "if",
        label: "possible outcomes",
      },
    ],
    after: [
      {
        kind: "tracks",
        id: "procedure",
        label: "Procedure in detail",
        flows: ["flow-240", "flow-expedited", "flow-reinstatement", "flow-admin"],
      },
      {
        kind: "nodes",
        title: "Custody, departure, and review",
        ids: [
          "detention",
          "mandatory-detention",
          "bond",
          "release",
          "voluntary-departure",
          "stay-of-removal",
          "judicial-review",
          "prosecution",
        ],
        cols: 2,
      },
    ],
  },
  "flow-240": {
    id: "flow-240",
    label: "§240 proceedings",
    steps: [
      { ids: ["p240-nta"] },
      { ids: ["p240-master"] },
      { ids: ["p240-pleadings"] },
      { ids: ["p240-relief"], edge: "if", label: "if eligible" },
      { ids: ["p240-merits"], edge: "if", label: "if contested" },
      { ids: ["p240-decision"] },
      { ids: ["out-relief", "out-termination", "voluntary-departure", "removal-order"], edge: "if", label: "one of" },
      { ids: ["bia-appeal"], edge: "if", label: "if appealed (30 days)" },
      { ids: ["petition-for-review"], edge: "if", label: "where authorized" },
      { ids: ["out-removal", "out-relief"], edge: "if", label: "final outcome" },
    ],
  },
  "flow-expedited": {
    id: "flow-expedited",
    label: "Expedited removal",
    steps: [
      { ids: ["er-eligibility"] },
      { ids: ["er-inspection"] },
      { ids: ["er-fear"] },
      { ids: ["er-order", "credible-fear"], edge: "if", label: "no fear claimed, or fear claimed" },
      { ids: ["cf-review"], edge: "if", label: "if negative and requested" },
      { ids: ["out-removal", "er-protection"], edge: "if", label: "negative upheld, or positive" },
    ],
  },
  "flow-reinstatement": {
    id: "flow-reinstatement",
    label: "Reinstatement",
    steps: [
      { ids: ["reinst-prior"] },
      { ids: ["reinst-order"] },
      { ids: ["out-removal", "reasonable-fear"], edge: "if", label: "no fear, or fear claimed" },
      { ids: ["withholding-only"], edge: "if", label: "if positive" },
      { ids: ["petition-for-review"], edge: "if", label: "where authorized" },
    ],
  },
  "flow-admin": {
    id: "flow-admin",
    label: "Administrative removal",
    steps: [
      { ids: ["proc-admin"] },
      { ids: ["admin-notice"] },
      { ids: ["admin-order"] },
      { ids: ["reasonable-fear", "petition-for-review"], edge: "if", label: "possible review" },
      { ids: ["out-removal"] },
    ],
  },
};

// ----------------------------------------------------------------- Stages

export const STAGES: Stage[] = [
  {
    id: "entry",
    blocks: [
      { kind: "nodes", ids: ["entry-abroad", "entry-port", "entry-between", "entry-inside"], cols: 2 },
      { kind: "nodes", ids: ["border-encounter"] },
    ],
  },
  {
    id: "pathways",
    blocks: [
      {
        kind: "tracks",
        id: "pathway",
        label: "Pathway",
        flows: ["permanent", "temporary", "humanitarian", "unauthorized"],
      },
    ],
  },
  {
    id: "processing",
    blocks: [
      {
        kind: "nodes",
        title: "Status decisions",
        ids: ["petition", "adjustment", "change-status", "asylum-adjudication", "enforcement-referral"],
        cols: 2,
      },
      { kind: "flow", id: "enforcement" },
    ],
  },
  {
    id: "outcomes",
    blocks: [
      {
        kind: "nodes",
        ids: [
          "lpr",
          "out-temporary-stay",
          "out-protection",
          "out-relief",
          "voluntary-departure",
          "out-other-departure",
          "out-removal",
          "out-termination",
        ],
        cols: 2,
      },
    ],
  },
  {
    id: "population",
    blocks: [
      { kind: "nodes", ids: ["naturalization"] },
      {
        kind: "nodes",
        title: "Measurements — counts of people living here, not legal steps",
        ids: ["foreign-born", "lpr-population", "unauthorized-population", "net-migration", "states", "history"],
        cols: 2,
      },
      { kind: "nodes", ids: ["related-migration"] },
    ],
  },
];

// The chart each stage column leads with.
export const STAGE_LEAD: Record<string, StatKey> = {
  entry: "border",
  pathways: "greenCards",
  processing: "removals",
  outcomes: "asylum",
  population: "population",
};

// --------------------------------------------------------------- Locating

// Where each node first appears: its stage, the track choices that reveal
// it, and a location key unique to that card. Nodes can appear in several
// places; selecting one elsewhere carries its own location.
export interface NodeHome {
  stage: string;
  choices: Record<string, string>;
  loc: string;
}

// Every card the chart can draw, in stage order — a node can have several.
export const CARDS: { id: string; stage: string; loc: string }[] = [];

// First appearance wins, except a node with a `home` waits for that stage.
function claim(out: Record<string, NodeHome>, id: string, home: NodeHome) {
  CARDS.push({ id, stage: home.stage, loc: home.loc });
  if (out[id]) return;
  if (NODES[id].home && NODES[id].home !== home.stage) return;
  out[id] = home;
}

function walkBlocks(
  blocks: Block[],
  path: string,
  stage: string,
  choices: Record<string, string>,
  out: Record<string, NodeHome>,
) {
  blocks.forEach((block, i) => {
    const at = `${path}/b${i}`;
    if (block.kind === "nodes") {
      for (const id of block.ids) claim(out, id, { stage, choices, loc: `${at}/${id}` });
    } else if (block.kind === "flow") {
      walkFlow(FLOWS[block.id], `${at}/${block.id}`, stage, choices, out);
    } else {
      for (const flow of block.flows)
        walkFlow(FLOWS[flow], `${at}/${flow}`, stage, { ...choices, [block.id]: flow }, out);
    }
  });
}

function walkFlow(
  flow: Flow,
  path: string,
  stage: string,
  choices: Record<string, string>,
  out: Record<string, NodeHome>,
) {
  flow.steps.forEach((step, j) => {
    for (const id of step.ids) claim(out, id, { stage, choices, loc: `${path}/s${j}/${id}` });
  });
  if (flow.after) walkBlocks(flow.after, `${path}/after`, stage, choices, out);
}

export const HOMES: Record<string, NodeHome> = (() => {
  const out: Record<string, NodeHome> = { system: { stage: "", choices: {}, loc: "root/system" } };
  for (const stage of STAGES) {
    out[stage.id] = { stage: stage.id, choices: {}, loc: `stage/${stage.id}` };
    walkBlocks(stage.blocks, `stage/${stage.id}`, stage.id, {}, out);
  }
  for (const id of Object.keys(NODES)) if (!out[id]) console.warn(`immigration system: node "${id}" is never shown`);
  return out;
})();

// The track each selector shows before anyone picks one: its first flow.
export const DEFAULT_CHOICES: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  const walk = (blocks: Block[]) => {
    for (const block of blocks) {
      if (block.kind === "flow") walk(FLOWS[block.id].after ?? []);
      if (block.kind !== "tracks") continue;
      out[block.id] ??= block.flows[0];
      for (const flow of block.flows) walk(FLOWS[flow].after ?? []);
    }
  };
  for (const stage of STAGES) walk(stage.blocks);
  return out;
})();

// Old #chapter links and ?focus= links, mapped onto nodes.
export const LEGACY_LINKS: Record<string, string> = {
  snapshot: "history",
  overview: "system",
  border: "border-encounter",
  "title-8-42": "border-encounter",
  legal: "lpr",
  humanitarian: "humanitarian",
  unauthorized: "unauthorized-population",
  temporary: "temporary",
  population: "foreign-born",
  enforcement: "enforcement",
  states: "states",
  related: "related-migration",
  domestic: "related-migration",
  abroad: "related-migration",
  "green-cards": "lpr",
  naturalizations: "naturalization",
  "net-migration": "net-migration",
};
