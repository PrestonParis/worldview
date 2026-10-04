import { load } from "js-yaml";
import type { CensusGeography, GovernmentOfficial } from "./types";

export const CONGRESS_ROSTER_SOURCE =
  "https://github.com/unitedstates/congress-legislators";

const ROSTER_URL =
  "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.yaml";

export interface LegislatorTerm {
  type?: "rep" | "sen";
  start?: string;
  end?: string;
  state?: string;
  district?: number;
  party?: string;
  url?: string;
  phone?: string;
}

export interface Legislator {
  id?: { bioguide?: string };
  name?: { first?: string; last?: string; official_full?: string };
  terms?: LegislatorTerm[];
}

function latestTerm(person: Legislator): LegislatorTerm | undefined {
  return person.terms?.at(-1);
}

function nameOf(person: Legislator): string | null {
  return person.name?.official_full || [person.name?.first, person.name?.last].filter(Boolean).join(" ") || null;
}

function officeFor(term: LegislatorTerm): string {
  return term.type === "sen" ? "U.S. Senator" : "U.S. Representative";
}

function normalizeDistrict(value: string): number {
  const parsed = Number.parseInt(value.replace(/^0+/, "") || "0", 10);
  return Number.isFinite(parsed) ? parsed : -1;
}

export function selectFederalOfficials(
  roster: Legislator[],
  geography: Pick<CensusGeography, "stateCode" | "stateName" | "congressionalDistrict">,
): GovernmentOfficial[] {
  const districtNumber = normalizeDistrict(geography.congressionalDistrict);

  return roster.flatMap((person) => {
    const term = latestTerm(person);
    if (!term || term.state !== geography.stateCode) return [];
    if (term.type === "rep" && term.district !== districtNumber) return [];
    if (term.type !== "rep" && term.type !== "sen") return [];

    const bioguideId = person.id?.bioguide ?? "";
    const name = nameOf(person);
    return [{
      id: `federal-${bioguideId || `${term.type}-${term.state}-${term.district ?? "senate"}`}`,
      office: officeFor(term),
      level: "federal" as const,
      jurisdiction: term.type === "rep"
        ? `${geography.stateCode}-${districtNumber || "At large"}`
        : geography.stateName,
      name,
      party: term.party,
      phone: term.phone,
      website: term.url,
      bioguideId: bioguideId || undefined,
      status: "verified" as const,
      sourceLabel: "Congress Legislators",
      sourceUrl: CONGRESS_ROSTER_SOURCE,
    }];
  });
}

export async function getFederalOfficials(geography: CensusGeography): Promise<GovernmentOfficial[]> {
  const response = await fetch(ROSTER_URL, {
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return [];

  const parsed = load(await response.text());
  return Array.isArray(parsed) ? selectFederalOfficials(parsed as Legislator[], geography) : [];
}
