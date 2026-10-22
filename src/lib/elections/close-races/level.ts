// Contest name → level, office, district, municipality. Georgia's SOS names
// are free text, so this is an ordered rule table; the first match wins.

import type { ContestLevel } from "./types.ts";

export interface ContestClass {
  level: ContestLevel;
  office: string;
  district: string | null;
  municipality: string | null;
}

const MUNICIPAL = /\b(city|town|village)\b|\bmayor\b|alderm[ae]n|council ?member|city commissioner|city council|town council/i;
const SCHOOL = /board of education|\bboe\b|school board|board of ed\b/i;
const JUDICIAL = /district attorney|\bjudge\b|\bjustice\b|court of appeals|supreme court|probate|magistrate|solicitor/i;
const COUNTY_OFFICE = /clerk of (superior|state|magistrate|probate)? ?court|sheriff|tax commissioner|coroner|surveyor|soil and water|county commission|board of commissioners|commission chair/i;

function districtOf(name: string): string | null {
  const match =
    name.match(/\bdistrict\s*([0-9]+[A-Z]?)\b/i) ??
    name.match(/\b(?:post|ward|seat)\s*([0-9A-Z]+)\b/i) ??
    name.match(/\bP([0-9]+)\b/);
  return match ? match[1] : null;
}

/** "Sunday Package Sales - Social Circle" → "Social Circle": a place named after the last dash. */
export function placeSuffix(name: string): string | null {
  const match = name.match(/\s-\s([A-Z][A-Za-z.' ]+?)\s*$/);
  if (!match) return null;
  const place = match[1].trim();
  if (/\b(district|post|ward|seat|at large|special|county|rep|dem|lib|np|question|referendum)\b/i.test(place)) return null;
  return place;
}

/** "Atlanta Mayor", "Mayor - Bloomingdale", "City Council (Jonesboro)", "City of College Park …" → the city. */
export function municipalityOf(name: string): string | null {
  const cityOf = name.match(/\b(?:City|Town) of ([A-Z][A-Za-z.' -]+?)(?=\s+(?:Homestead|Sales|Ad Valorem|Question|Referendum|Bond|Tax|Charter|Exemption|Sunday|Mayor|City|Council|-)|$)/);
  if (cityOf) return cityOf[1].trim();
  const paren = name.match(/\(([A-Z][A-Za-z.' -]+)\)\s*$/);
  if (paren && !/^(SE|VF\d+|I|LRG)$/i.test(paren[1])) return paren[1].trim();
  const trailing = name.match(/-\s*([A-Z][A-Za-z.' ]+?)(?:\s+LRG)?\s*$/);
  if (trailing && MUNICIPAL.test(name) && !/district|post|ward|at large|seat/i.test(trailing[1])) return trailing[1].trim();
  const leading = name.match(/^([A-Z][A-Za-z.' ]+?)\s+(?:Mayor|City Council|City Commission|Town Council|Alderm)/);
  if (leading && !/^(City|Town|Village)$/i.test(leading[1])) return leading[1].trim();
  const dashed = name.match(/^Mayor\s*-\s*([A-Z][A-Za-z.' ]+)$/);
  if (dashed) return dashed[1].trim();
  return null;
}

function officeOf(name: string): string {
  return name
    .replace(/\s*-\s*(Rep|Dem|Lib|NP)$/i, "")
    .replace(/\s*-?\s*\bdistrict\s*[0-9]+[A-Z]?\b.*$/i, "")
    .trim();
}

export function classifyContest(
  name: string,
  { fromCounty, isReferendum }: { fromCounty: boolean; isReferendum: boolean },
): ContestClass {
  const district = districtOf(name);
  const base = { office: officeOf(name), district, municipality: null as string | null };
  if (isReferendum) {
    return { ...base, level: "referendum", municipality: fromCounty ? (municipalityOf(name) ?? placeSuffix(name)) : null };
  }
  if (/^(President|US Senate|US House|U\.S\. (Senate|House|Representative)|United States)/i.test(name)) {
    return { ...base, level: "federal" };
  }
  if (/^State (Senate|House)/i.test(name)) return { ...base, level: "legislative" };
  if (!fromCounty) {
    // Statewide and district-wide offices on the state feed: Governor, PSC,
    // State School Superintendent, … DAs and appellate judges are judicial.
    return { ...base, level: JUDICIAL.test(name) && !/clerk/i.test(name) ? "judicial" : "statewide" };
  }
  if (COUNTY_OFFICE.test(name)) return { ...base, level: "county" };
  if (SCHOOL.test(name)) return { ...base, level: "school" };
  if (MUNICIPAL.test(name)) return { ...base, level: "municipal", municipality: municipalityOf(name) };
  if (JUDICIAL.test(name)) return { ...base, level: "judicial" };
  return { ...base, level: "county" };
}
