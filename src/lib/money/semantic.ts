// The fixed vocabulary of Money & Influence: one colour and one plain-English
// label per kind of money, used by every /money view so a colour means the
// same thing wherever it appears. Colours are CSS variables (globals.css,
// --money-*); parties use the site-wide --viz-dem / --viz-rep.

export const MONEY_COLORS = {
  individual: "var(--money-individual)",
  pac: "var(--money-pac)",
  party: "var(--money-party)",
  other: "var(--money-other)",
  lobbying: "var(--money-lobbying)",
  support: "var(--money-support)",
  oppose: "var(--money-oppose)",
  neutral: "var(--money-neutral)",
} as const;

export type FundingSource = "individual" | "pac" | "party" | "other";

export const FUNDING_SOURCES: { key: FundingSource; label: string; short: string; color: string }[] = [
  { key: "individual", label: "Individual donors", short: "Individuals", color: MONEY_COLORS.individual },
  { key: "pac", label: "PACs & other committees", short: "PACs", color: MONEY_COLORS.pac },
  { key: "party", label: "Party committees", short: "Party", color: MONEY_COLORS.party },
  { key: "other", label: "Transfers, loans & other", short: "Other", color: MONEY_COLORS.other },
];

// FEC party codes → colour. Anything but the two major parties is neutral.
export function partyColor(code: string | null | undefined): string {
  const c = (code ?? "").toUpperCase();
  if (c.startsWith("DEM") || c === "D") return "var(--viz-dem)";
  if (c.startsWith("REP") || c === "R") return "var(--viz-rep)";
  return MONEY_COLORS.other;
}

export function partyLetter(code: string | null | undefined): string {
  const c = (code ?? "").toUpperCase();
  if (c.startsWith("DEM")) return "D";
  if (c.startsWith("REP")) return "R";
  if (c.startsWith("LIB")) return "L";
  if (c.startsWith("IND")) return "I";
  if (c.startsWith("GRE")) return "G";
  return c.slice(0, 1);
}

// Display groups for the contributor's FEC entity type. The precise FEC
// category stays available as `fec` (shown in tooltips and the explorer).
export interface DonorTypeGroup {
  key: string;
  label: string;
  fec: string;
  color: string;
}

const DONOR_TYPES: Record<string, DonorTypeGroup> = {
  individual: { key: "individual", label: "Individuals", fec: "Individual (IND)", color: MONEY_COLORS.individual },
  pac: { key: "pac", label: "PACs", fec: "Political action committee (PAC)", color: MONEY_COLORS.pac },
  super_pac: { key: "pac", label: "PACs", fec: "Super PAC (independent-expenditure-only committee)", color: MONEY_COLORS.pac },
  party: { key: "party", label: "Party organizations", fec: "Party committee (PTY)", color: MONEY_COLORS.party },
  committee: {
    key: "committee",
    label: "Candidate-affiliated committees",
    fec: "Candidate or joint fundraising committee (CCM / COM)",
    color: MONEY_COLORS.other,
  },
  other: { key: "other", label: "Other organizations", fec: "Organization or other entity (ORG)", color: MONEY_COLORS.other },
};

const UNRECORDED: DonorTypeGroup = { key: "unknown", label: "Type not reported", fec: "No entity type on the filing", color: MONEY_COLORS.other };

export function donorTypeGroup(type: string | null | undefined): DonorTypeGroup {
  return (type && DONOR_TYPES[type]) || UNRECORDED;
}
