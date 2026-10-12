// Site-wide glossary. <Term id="..."> (src/components/ui/term.tsx) shows
// these as popovers wherever a term appears; pages can also list a set of
// them in full. Definitions are plain statements of how the term is used by
// the agencies whose data Worldview shows.

export interface GlossaryEntry {
  term: string;
  definition: string;
  also?: string[]; // related entries, by id
}

export const GLOSSARY = {
  encounter: {
    term: "Border encounter",
    definition:
      "A CBP enforcement event: a Border Patrol apprehension between ports of entry, a person found inadmissible at a port of entry, or (March 2020 – May 2023) a Title 42 expulsion. Encounters count events, not people — someone stopped three times is three encounters. They do not count people who crossed without being stopped.",
    also: ["apprehension", "inadmissible", "title-8", "title-42"],
  },
  apprehension: {
    term: "Apprehension",
    definition:
      "When U.S. Border Patrol takes someone into custody for being in the country unlawfully, almost always between ports of entry. One of the two kinds of border encounter.",
    also: ["encounter", "usbp"],
  },
  inadmissible: {
    term: "Inadmissible",
    definition:
      "A person who presents themselves at a port of entry — a land crossing, airport, or seaport — and is found ineligible to enter, for example for lacking valid documents. Recorded by CBP's Office of Field Operations. They may be allowed to withdraw and return, placed in removal proceedings, or paroled in.",
    also: ["encounter", "ofo", "port-of-entry"],
  },
  "port-of-entry": {
    term: "Port of entry",
    definition: "An official place to enter the U.S. — a staffed land-border crossing, an international airport, or a seaport.",
  },
  "title-8": {
    term: "Title 8",
    definition:
      "Title 8 of the U.S. Code — the body of federal immigration law. People encountered under Title 8 are processed under it: expedited removal, a notice to appear before an immigration judge, voluntary return, or criminal prosecution for illegal entry or re-entry. Asylum claims are made under Title 8.",
    also: ["title-42", "removal", "asylum"],
  },
  "title-42": {
    term: "Title 42",
    definition:
      "A public-health law (42 U.S.C. § 265) used from March 2020 to May 11, 2023, during COVID-19, to expel many people encountered at the border to Mexico or their home country without Title 8 processing or an asylum screening. An expulsion carried no penalty on re-entry, so many people were encountered more than once.",
    also: ["title-8", "encounter"],
  },
  removal: {
    term: "Removal",
    definition:
      "The compulsory, confirmed departure of a noncitizen under an order of removal. A removal bars re-entry for years and makes a later unlawful re-entry a federal crime. What most people mean by “deportation.”",
    also: ["deportation", "return"],
  },
  deportation: {
    term: "Deportation",
    definition: "The everyday word for removal. Since 1997 the legal term has been “removal.”",
    also: ["removal"],
  },
  return: {
    term: "Return",
    definition:
      "The confirmed departure of a noncitizen without an order of removal — for example voluntary return at the border or voluntary departure granted by a judge. Carries fewer penalties on re-entry than a removal.",
    also: ["removal"],
  },
  parole: {
    term: "Parole",
    definition:
      "Permission to enter or stay in the U.S. temporarily, granted case by case for urgent humanitarian reasons or significant public benefit. Parole is not a legal admission or an immigration status; it ends when the parole period does.",
  },
  asylum: {
    term: "Asylum",
    definition:
      "Protection for a person already in the U.S. or arriving at the border who has a well-founded fear of persecution at home because of race, religion, nationality, political opinion, or membership in a particular social group. Asylees can apply for a green card after one year.",
    also: ["affirmative-asylum", "defensive-asylum", "refugee"],
  },
  "affirmative-asylum": {
    term: "Affirmative asylum",
    definition:
      "Asylum requested from USCIS by someone who is not in removal proceedings, decided by an asylum officer after an interview.",
    also: ["asylum", "defensive-asylum", "uscis"],
  },
  "defensive-asylum": {
    term: "Defensive asylum",
    definition:
      "Asylum requested as a defense against removal, decided by an immigration judge (EOIR) in removal proceedings.",
    also: ["asylum", "affirmative-asylum", "eoir"],
  },
  refugee: {
    term: "Refugee",
    definition:
      "A person outside the U.S. who meets the same persecution standard as asylum and is approved abroad, then resettled here through the U.S. Refugee Admissions Program under an annual ceiling set by the president. Refugees must apply for a green card after one year.",
    also: ["asylum"],
  },
  "green-card": {
    term: "Green card",
    definition:
      "Proof of lawful permanent resident status. A green-card holder can live and work in the U.S. permanently and can usually apply to become a citizen after five years (three if married to a U.S. citizen).",
    also: ["lpr", "adjustment-of-status", "naturalization"],
  },
  lpr: {
    term: "Lawful permanent resident (LPR)",
    definition: "A noncitizen allowed to live in the U.S. permanently — a green-card holder.",
    also: ["green-card"],
  },
  "adjustment-of-status": {
    term: "Adjustment of status",
    definition:
      "Getting a green card while already living in the U.S. — for example on a temporary visa, as a refugee or asylee, or on parole — instead of through an immigrant visa issued abroad. Adjustments are counted in the year the green card is granted, which may be years after the person arrived.",
    also: ["green-card", "new-arrival"],
  },
  "new-arrival": {
    term: "New arrival",
    definition: "A person who receives an immigrant visa abroad and becomes a permanent resident on entering the U.S.",
    also: ["adjustment-of-status"],
  },
  naturalization: {
    term: "Naturalization",
    definition:
      "How a green-card holder becomes a U.S. citizen: after meeting residence requirements, they apply to USCIS, pass English and civics tests, and take the oath of allegiance.",
    also: ["green-card"],
  },
  nonimmigrant: {
    term: "Nonimmigrant (temporary) admission",
    definition:
      "Entry for a temporary purpose — tourism, business, study, work, exchange — under a class such as B-2, F-1, or H-1B. Counted per entry: a business traveler who comes five times is five admissions.",
    also: ["visa"],
  },
  visa: {
    term: "Visa vs. admission",
    definition:
      "A visa is a travel document issued abroad by the State Department that lets someone ask to enter. An admission is CBP letting them in at a port of entry. One visa can be used for many admissions, and Visa Waiver travelers are admitted without one.",
    also: ["nonimmigrant"],
  },
  nim: {
    term: "Net international migration",
    definition:
      "The Census Bureau's estimate of everyone who moved to the U.S. from abroad minus everyone who moved abroad, over the 12 months ending July 1 — immigrants and U.S. citizens alike, of any legal status. It is the part of population change that comes from migration rather than births and deaths.",
    also: ["foreign-born"],
  },
  "foreign-born": {
    term: "Foreign-born",
    definition:
      "Anyone living in the U.S. who was not a U.S. citizen at birth: naturalized citizens, green-card holders, people on temporary visas, refugees and asylees, and unauthorized immigrants. People born abroad to U.S.-citizen parents are counted as native-born.",
    also: ["naturalization", "unauthorized"],
  },
  unauthorized: {
    term: "Unauthorized immigrant",
    definition:
      "A noncitizen living in the U.S. without lawful status — someone who entered without inspection, or who was admitted temporarily and stayed past or violated the terms of that admission. DHS's estimate includes people with temporary protection from removal, such as DACA recipients and TPS holders.",
    also: ["overstay", "foreign-born"],
  },
  overstay: {
    term: "Visa overstay",
    definition: "A person admitted lawfully for a temporary stay who remains past the date their admission ends.",
    also: ["unauthorized"],
  },
  "ice-detention": {
    term: "ICE detention",
    definition:
      "Civil — not criminal — custody of noncitizens by Immigration and Customs Enforcement while their immigration case is decided or their removal is arranged. It is not a sentence for a crime. People are held in ICE-owned, privately contracted, and local-jail facilities.",
    also: ["mandatory-detention", "criminal-conviction"],
  },
  "mandatory-detention": {
    term: "Mandatory detention",
    definition:
      "Detention required by statute for certain people — for example those with specified criminal convictions or in expedited removal — whom ICE may not release on bond.",
    also: ["ice-detention"],
  },
  "criminal-conviction": {
    term: "Criminal conviction (ICE data)",
    definition:
      "ICE counts a detainee as having a criminal conviction if any conviction is on record, including immigration crimes such as illegal re-entry and minor offenses. “No criminal conviction” can include people with pending criminal charges. Being in the U.S. without status is a civil violation, not a crime.",
    also: ["ice-detention", "threat-level"],
  },
  "threat-level": {
    term: "ICE threat level",
    definition:
      "A 1–3 rating ICE assigns to detainees with criminal convictions, by the severity and recency of the offense (1 is most serious). Detainees with no conviction have no threat level.",
    also: ["criminal-conviction"],
  },
  uac: {
    term: "Unaccompanied child (UAC)",
    definition:
      "A child under 18 with no lawful status and no parent or legal guardian in the U.S. able to care for them. CBP must transfer them to the Department of Health and Human Services, generally within 72 hours.",
  },
  "family-unit": {
    term: "Family unit",
    definition: "People encountered together as a family — a child under 18 with a parent or legal guardian. Each member counts as one encounter.",
  },
  "fiscal-year": {
    term: "Fiscal year (FY)",
    definition: "The federal budget year, October 1 to September 30, named for the year it ends: FY 2024 ran from October 1, 2023 to September 30, 2024.",
  },
  stock: {
    term: "Stock vs. flow",
    definition:
      "A stock is how many people are in a group at one moment (the foreign-born population on a given date). A flow is how many enter or leave a group over a period (green cards granted in a year). Comparing one with the other mixes different questions.",
  },
  cbp: {
    term: "CBP",
    definition: "U.S. Customs and Border Protection, the DHS agency at and between ports of entry. Its two frontline parts are Border Patrol and the Office of Field Operations.",
    also: ["usbp", "ofo"],
  },
  usbp: {
    term: "Border Patrol (USBP)",
    definition: "The part of CBP that patrols between ports of entry and apprehends people who cross there.",
    also: ["apprehension"],
  },
  ofo: {
    term: "Office of Field Operations (OFO)",
    definition: "The part of CBP that staffs ports of entry — land crossings, airports, and seaports — and inspects everyone arriving there.",
    also: ["inadmissible"],
  },
  ice: {
    term: "ICE",
    definition: "U.S. Immigration and Customs Enforcement, the DHS agency that enforces immigration law inside the country: arrests, detention, and removals.",
  },
  uscis: {
    term: "USCIS",
    definition: "U.S. Citizenship and Immigration Services, the DHS agency that decides applications: green cards, naturalization, affirmative asylum, work permits.",
  },
  eoir: {
    term: "EOIR",
    definition: "The Executive Office for Immigration Review, part of the Justice Department — the immigration courts, where judges decide removal cases and defensive asylum claims.",
  },
} satisfies Record<string, GlossaryEntry>;

export type GlossaryId = keyof typeof GLOSSARY;
