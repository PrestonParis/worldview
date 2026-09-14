// Coarse donor-industry vocabulary for the Money & Influence category.
// Modelled on the OpenSecrets "sector" taxonomy so a real crosswalk can be
// layered on later. Deliberately a fixed string list, not a table — one
// slug per donor, stamped onto `contributions.donor_industry` at import
// time (see scripts/import-fec-donors.mjs) and hand-correctable later.
//
// This file is intentionally dependency-free so the operational scripts
// (.mjs) can import it directly for `classifyCommitteeName`.

export const INDUSTRY_SLUGS = [
  "finance-insurance-realestate",
  "health",
  "energy-natural-resources",
  "agribusiness",
  "communications-electronics",
  "construction",
  "defense",
  "transportation",
  "labor",
  "lawyers-lobbyists",
  "ideological-single-issue",
  "misc-business",
  "civil-servants",
  "education",
  "other",
] as const;

export type IndustrySlug = (typeof INDUSTRY_SLUGS)[number];

export const INDUSTRY_LABELS: Record<IndustrySlug, string> = {
  "finance-insurance-realestate": "Finance, Insurance & Real Estate",
  health: "Health",
  "energy-natural-resources": "Energy & Natural Resources",
  agribusiness: "Agribusiness",
  "communications-electronics": "Communications & Electronics",
  construction: "Construction",
  defense: "Defense",
  transportation: "Transportation",
  labor: "Labor",
  "lawyers-lobbyists": "Lawyers & Lobbyists",
  "ideological-single-issue": "Ideological / Single-Issue",
  "misc-business": "Miscellaneous Business",
  "civil-servants": "Civil Servants / Public Officials",
  education: "Education",
  other: "Other",
};

// Never throws — an unrecognised slug (older data, a hand-typed value)
// gets a title-cased fallback rather than a crash.
export function industryLabel(slug: string | null | undefined): string {
  if (!slug) return "Unclassified";
  if (slug in INDUSTRY_LABELS) return INDUSTRY_LABELS[slug as IndustrySlug];
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Ordered most-specific first. Each entry: [slug, /regex/] tested against an
// upper-cased committee / employer name. First match wins; no match → null
// (caller decides whether to store "other" or leave it unset).
const KEYWORD_RULES: [IndustrySlug, RegExp][] = [
  ["defense", /\b(LOCKHEED|RAYTHEON|RTX|NORTHROP|BOEING|GENERAL DYNAMICS|L3HARRIS|BAE SYSTEMS|DEFENSE|AEROSPACE|MISSILE|ARMAMENT)\b/],
  ["energy-natural-resources", /\b(EXXON|CHEVRON|CONOCO|MARATHON PETROLEUM|VALERO|HALLIBURTON|KOCH|OIL|GAS|PETROLEUM|COAL|MINING|NUCLEAR|SOLAR|WIND ENERGY|UTILITIES|ELECTRIC POWER|ENERGY)\b/],
  ["communications-electronics", /\b(COMCAST|VERIZON|AT&T|T-MOBILE|CHARTER COMMUNICATIONS|GOOGLE|ALPHABET|META|MICROSOFT|APPLE|AMAZON|NVIDIA|ORACLE|IBM|INTEL|TELECOM|BROADCAST|SOFTWARE|SEMICONDUCTOR|INTERNET)\b/],
  ["transportation", /\b(UNITED AIRLINES|AMERICAN AIRLINES|DELTA AIR|SOUTHWEST AIRLINES|FEDEX|UPS|UNION PACIFIC|NORFOLK SOUTHERN|CSX|BOEING|AIRLINE|RAILROAD|TRUCKING|MARITIME|SHIPPING|AUTO DEALERS|AUTOMOTIVE)\b/],
  ["agribusiness", /\b(CARGILL|ARCHER DANIELS|ADM|TYSON|SMITHFIELD|DEERE|FARM BUREAU|AGRICULTUR|CROP|DAIRY|POULTRY|CATTLE|TOBACCO|FOOD PROCESS)\b/],
  ["health", /\b(PFIZER|MERCK|AMGEN|ELI LILLY|ABBVIE|JOHNSON & JOHNSON|UNITEDHEALTH|CIGNA|HUMANA|CVS HEALTH|HCA|HOSPITAL|PHARMACEUTICAL|PHARMA|BIOTECH|PHYSICIAN|NURSES|MEDICAL|HEALTH)\b/],
  ["finance-insurance-realestate", /\b(GOLDMAN SACHS|MORGAN STANLEY|JPMORGAN|JP ?MORGAN|CITIGROUP|BANK OF AMERICA|WELLS FARGO|BLACKSTONE|BLACKROCK|CITADEL|BERKSHIRE|VISA|MASTERCARD|STIFEL|JANNEY|CHARLES SCHWAB|BANK|CAPITAL|SECURITIES|INVESTMENT|PRIVATE EQUITY|HEDGE FUND|INSURANCE|MORTGAGE|REAL ESTATE|REALTOR|CREDIT UNION)\b/],
  ["construction", /\b(BECHTEL|FLUOR|CATERPILLAR|VULCAN MATERIALS|HOME BUILDERS|CONSTRUCTION|CONTRACTOR|ENGINEERING FIRM|BUILDING TRADES)\b/],
  ["labor", /\b(AFL-CIO|AFL ?CIO|TEAMSTERS|SEIU|UAW|AUTO WORKERS|AFSCME|STEELWORKERS|MINE ?WORKERS|FARM WORKERS|CARPENTERS|ELECTRICAL WORKERS|IBEW|MACHINISTS|LABORERS|PLUMBERS|PIPEFITTERS|TRADE UNION|LABOR UNION|WORKERS UNION|UNION)\b/],
  ["lawyers-lobbyists", /\b(AKIN GUMP|BROWNSTEIN|SQUIRE PATTON|K&L GATES|HOLLAND & KNIGHT|TRIAL LAWYERS|ASSOCIATION FOR JUSTICE|LAW FIRM|LLP|ATTORNEYS|LOBBY)\b/],
  ["education", /\b(UNIVERSITY|COLLEGE|SCHOOL DISTRICT|TEACHERS|NEA|AFT|EDUCATION ASSOCIATION|ACADEMIC)\b/],
  ["civil-servants", /\b(FIREFIGHTERS|POLICE|LAW ENFORCEMENT|GOVERNMENT EMPLOYEES|POSTAL WORKERS|PUBLIC EMPLOYEES|BORDER PATROL)\b/],
  ["ideological-single-issue", /\b(FOR AMERICA|VICTORY FUND|PLANNED PARENTHOOD|NRA|GUN OWNERS|CLUB FOR GROWTH|EMILY'?S LIST|MOVEON|HERITAGE ACTION|LEADERSHIP PAC|PAC$|POLITICAL ACTION|CITIZENS FOR|AMERICANS FOR|COMMITTEE TO ELECT|FRIENDS OF)\b/],
];

// Heuristic — first keyword rule to hit. Returns null when nothing matches
// (the importer stores that as an unset industry, not a wrong guess).
export function classifyCommitteeName(name: string | null | undefined): IndustrySlug | null {
  if (!name) return null;
  const upper = name.toUpperCase();
  for (const [slug, re] of KEYWORD_RULES) {
    if (re.test(upper)) return slug;
  }
  return null;
}

// FEC Schedule A `entity_type` → our coarse enum. `super_pac` isn't
// derivable from entity_type alone, so it's never returned here.
export function contributionTypeFromFec(
  entityType: string | null | undefined,
): "individual" | "pac" | "party" | "committee" | "other" | null {
  switch ((entityType || "").toUpperCase()) {
    case "IND":
      return "individual";
    case "PAC":
      return "pac";
    case "PTY":
      return "party";
    case "CCM":
    case "COM":
      return "committee";
    case "ORG":
      return "other";
    default:
      return null;
  }
}
