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

  return rows.flatMap((row) => {
    const district = districtKey(row.govDistrict ?? "");
    let office = row.govOffice;
    let jurisdiction = geography.stateName;
    if (row.govChamber === "upper" || row.govChamber === "legislature") {
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
    // Governor first, then the rest of the statewide offices alphabetically.
    const officials = selectStateOfficials(rows, geography);
    return officials.sort((a, b) =>
      a.office === "Governor" ? -1 : b.office === "Governor" ? 1 : a.office.localeCompare(b.office),
    );
  } finally {
    await session.close();
  }
}
