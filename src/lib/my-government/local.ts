import type { CensusGeography, GovernmentOfficial } from "./types";

export const HALL_COUNTY_GIS_SOURCE =
  "https://services3.arcgis.com/H1fomogcAqX4720J/ArcGIS/rest/services/PV1_DistrictManagement/FeatureServer";

type Attributes = Record<string, unknown>;

interface ArcGisResponse {
  features?: Array<{ attributes?: Attributes }>;
}

function value(attributes: Attributes, key: string): string {
  const item = attributes[key];
  return typeof item === "string" || typeof item === "number" ? String(item).trim() : "";
}

function official(
  id: string,
  office: string,
  level: GovernmentOfficial["level"],
  jurisdiction: string,
  name: string,
  website?: string,
): GovernmentOfficial | null {
  if (!name) return null;
  return {
    id: `hall-${id}`,
    office,
    level,
    jurisdiction,
    name,
    website: website || undefined,
    status: "verified",
    sourceLabel: "Hall County public GIS",
    sourceUrl: HALL_COUNTY_GIS_SOURCE,
  };
}

function compact(items: Array<GovernmentOfficial | null>): GovernmentOfficial[] {
  return items.filter((item): item is GovernmentOfficial => Boolean(item));
}

export function parseHallCountyLayers(layers: Record<number, Attributes>): GovernmentOfficial[] {
  const countywide = layers[13] ?? {};
  const commissioner = layers[0] ?? {};
  const city = layers[2] ?? {};
  const council = layers[5] ?? {};
  const school = layers[14] ?? {};
  const county = "Hall County";
  const cityName = value(city, "NAME") || "Grand Island";
  const councilWard = value(council, "NAME") || `City Council Ward ${value(council, "DISTRICTID")}`;
  const schoolWard = value(school, "WARD") ? `Grand Island Public Schools Ward ${value(school, "WARD")}` : "Grand Island Public Schools";

  const officials = compact([
    official("mayor", "Mayor", "local", cityName, value(city, "Mayor"), value(city, "MayorWebpage")),
    official("council-1", "City council", "local", councilWard, value(council, "REP1NAME"), value(council, "REP1EMAIL")),
    official("council-2", "City council", "local", councilWard, value(council, "REP2NAME"), value(council, "REP2EMAIL")),
    official("school-1", "School board", "local", schoolWard, value(school, "REP1"), "https://www.gips.org/about-us/board-of-education"),
    official("school-2", "School board", "local", schoolWard, value(school, "REP2"), "https://www.gips.org/about-us/board-of-education"),
    official("school-3", "School board", "local", schoolWard, value(school, "REP3"), "https://www.gips.org/about-us/board-of-education"),
    official("commissioner", "County commission", "county", value(commissioner, "DISTRICT") || county, value(commissioner, "NAME"), value(commissioner, "LINK")),
    official("sheriff", "Sheriff", "county", county, value(countywide, "HC_Sheriff"), "https://files.hallcountyne.gov/government/sheriff/index.php"),
    official("attorney", "District attorney / prosecutor", "county", county, value(countywide, "HC_Attorney"), "https://files.hallcountyne.gov/government/county_attorney/index.php"),
    official("clerk", "County clerk", "county", county, value(countywide, "HC_Clerk")),
    official("assessor", "County assessor / register of deeds", "county", county, value(countywide, "HC_AssessRoD")),
    official("court-clerk", "Clerk of the District Court", "county", county, value(countywide, "HC_ClerkDistCourt")),
    official("treasurer", "County treasurer", "county", county, value(countywide, "HC_Treasurer")),
    official("public-defender", "Public defender", "county", county, value(countywide, "HC_PubDefend")),
    official("surveyor", "County surveyor", "county", county, value(countywide, "HC_Surveyor")),
    official("state-board", "State Board of Education", "state", "District 6", value(countywide, "NE_BrdEdu_D6")),
    official("regent", "University Board of Regents", "state", "District 6", value(countywide, "UN_BrdRegent_D6")),
    official("public-service", "Public Service Commission", "state", "District 5", value(countywide, "NE_PubServ_D5")),
    official("power-district", "Public Power District", "local", "Subdistrict 3", value(countywide, "NPPD_SubD3")),
    official("community-college-1", "Community college board", "local", "District 4", value(countywide, "CCC_Brd_D4_1")),
    official("community-college-2", "Community college board", "local", "District 4", value(countywide, "CCC_Brd_D4_2")),
  ]);

  for (let index = 1; index <= 4; index += 1) {
    const districtJudge = official(`district-judge-${index}`, "Local trial court judge", "courts", "Nebraska Judicial District 9", value(countywide, `NE_DistrictCrt_D9_${index}`));
    const countyJudge = official(`county-judge-${index}`, "Local trial court judge", "courts", "Nebraska Judicial District 9", value(countywide, `NE_CountyCrt_D9_${index}`));
    if (districtJudge) officials.push(districtJudge);
    if (countyJudge) officials.push(countyJudge);
  }

  const supreme = official("supreme-court", "State appellate and supreme court judge", "courts", "Nebraska Supreme Court District 5", value(countywide, "NE_SupremeCrt_D5"));
  const appeals = official("appeals-court", "State appellate and supreme court judge", "courts", "Nebraska Court of Appeals District 5", value(countywide, "NE_AppealsCrt_D5"));
  if (supreme) officials.push(supreme);
  if (appeals) officials.push(appeals);
  return officials;
}

async function queryLayer(layer: number, geography: CensusGeography): Promise<Attributes> {
  const url = new URL(`${HALL_COUNTY_GIS_SOURCE}/${layer}/query`);
  url.searchParams.set("geometry", `${geography.longitude},${geography.latitude}`);
  url.searchParams.set("geometryType", "esriGeometryPoint");
  url.searchParams.set("inSR", "4326");
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("outFields", "*");
  url.searchParams.set("returnGeometry", "false");
  url.searchParams.set("f", "json");
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
  if (!response.ok) return {};
  const body = (await response.json()) as ArcGisResponse;
  return body.features?.[0]?.attributes ?? {};
}

export async function getLocalOfficials(geography: CensusGeography): Promise<GovernmentOfficial[]> {
  // Hall County publishes unusually complete, address-queryable official GIS
  // layers. Keep local resolvers jurisdiction-scoped so no office is inferred
  // merely because another county uses the same title.
  if (geography.countyGeoid !== "31079") return [];
  const layerIds = [0, 2, 5, 13, 14];
  const results = await Promise.all(layerIds.map((layer) => queryLayer(layer, geography)));
  return parseHallCountyLayers(Object.fromEntries(layerIds.map((layer, index) => [layer, results[index]])));
}
