import { getDriver } from "../neo4j/client";
import type { CensusGeography, GovernmentOfficial } from "./types";

// State legislators and statewide executives, imported into the graph by
// scripts/import-openstates-people.mjs (govLevel='state' + govState /
// govChamber / govDistrict / govOffice on each politician entity).
export const OPEN_STATES_SOURCE = "https://open.pluralpolicy.com/data/";

export interface StateOfficialRow {
  id: string;
  name: string;
  govChamber: string;
  govDistrict: string;
  govOffice: string;
  govParty?: string | null;
  govPhone?: string | null;
  websiteUrl?: string | null;
}

// Census and Open States name districts differently ("State Senate District
// 027" vs "27", "1st Middlesex District" vs "1st Middlesex"). Reduce both to
// a comparable key.
export function districtKey(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/\b(state|senate|house|assembly|legislative|district|of delegates|representatives?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return /^\d+$/.test(cleaned) ? String(Number(cleaned)) : cleaned;
}

export function selectStateOfficials(
  rows: StateOfficialRow[],
  geography: Pick<CensusGeography, "stateCode" | "stateName" | "stateUpperDistrict" | "stateLowerDistrict">,
): GovernmentOfficial[] {
  const upper = districtKey(geography.stateUpperDistrict);
  const lower = districtKey(geography.stateLowerDistrict);

  const isDC = geography.stateCode === "DC";

  return rows.flatMap((row) => {
    const district = districtKey(row.govDistrict ?? "");
    let office = row.govOffice;
    let jurisdiction = geography.stateName;
    if (isDC && row.govChamber === "executive") {
      // Open States files the Mayor under the governor slot.
      if (office === "Governor") office = "Mayor";
    } else if (isDC && row.govChamber === "legislature") {
      // The DC Council: one member per ward, plus at-large members and a chair
      // elected citywide.
      if (district === "at large") office = "Councilmember (at-large)";
      else if (district === "chairman" || district === "chair") office = "Council chair";
      else if (upper && district === upper) {
        office = "Councilmember";
        jurisdiction = geography.stateUpperDistrict;
      } else return [];
    } else if (row.govChamber === "upper" || row.govChamber === "legislature") {
      if (!upper || district !== upper) return [];
      // Nebraska's unicameral members are senators.
      office = "State senator";
      jurisdiction = geography.stateUpperDistrict;
    } else if (row.govChamber === "lower") {
      if (!lower || district !== lower) return [];
      jurisdiction = geography.stateLowerDistrict;
    } else if (row.govChamber !== "executive") {
      return [];
    }
    return [{
      id: `state-${row.id}`,
      office,
      level: "state" as const,
      jurisdiction,
      name: row.name,
      party: row.govParty ?? undefined,
      phone: row.govPhone ?? undefined,
      website: row.websiteUrl || undefined,
      entityId: row.id,
      status: "verified" as const,
      sourceLabel: "Open States",
      sourceUrl: OPEN_STATES_SOURCE,
    }];
  });
}

export async function getStateOfficials(geography: CensusGeography): Promise<GovernmentOfficial[]> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (e:Entity {govLevel: 'state', govState: $state})
       WHERE e.govOffice IS NOT NULL
       RETURN e.id AS id, e.name AS name, e.govChamber AS govChamber,
              coalesce(e.govDistrict, '') AS govDistrict, e.govOffice AS govOffice,
              e.govParty AS govParty, e.govPhone AS govPhone, e.websiteUrl AS websiteUrl`,
      { state: geography.stateCode },
    );
    const rows = result.records.map((record) => record.toObject() as StateOfficialRow);
    // Governor (or DC's Mayor) first, then the rest alphabetically.
    const officials = selectStateOfficials(rows, geography);
    const head = (office: string) => office === "Governor" || office === "Mayor";
    return officials.sort((a, b) =>
      head(a.office) ? -1 : head(b.office) ? 1 : a.office.localeCompare(b.office),
    );
  } finally {
    await session.close();
  }
}
