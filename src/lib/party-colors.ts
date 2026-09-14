// Semantic colour per political party — used as small accent dots / pills
// and as the choropleth fill in later phases, never as a large decorative
// fill. The two major U.S. parties use the ColorBrewer RdBu endpoints,
// which are colour-vision-safe and read correctly on the diverging swing
// scale Phase 3 introduces; everything else falls back to neutral greys.
// Keyed on the lowercased party string (free text, so this is best-effort).
export interface PartyColor {
  bg: string;
  border: string;
  text: string;
}

const DEMOCRATIC: PartyColor = { bg: "#EAF1F8", border: "#2166AC", text: "#174E82" };
const REPUBLICAN: PartyColor = { bg: "#F9EBEC", border: "#B2182B", text: "#8A1220" };

const PARTY_COLORS: Record<string, PartyColor> = {
  democratic: DEMOCRATIC,
  democrat: DEMOCRATIC,
  "democratic-farmer-labor": DEMOCRATIC,
  dfl: DEMOCRATIC,
  republican: REPUBLICAN,
  gop: REPUBLICAN,
  libertarian: { bg: "#FEF6E7", border: "#D9A404", text: "#8A6A02" },
  green: { bg: "#EAF4EC", border: "#3F9E4D", text: "#2A6E35" },
  independent: { bg: "#F1F5F9", border: "#64748B", text: "#475569" },
  nonpartisan: { bg: "#F1F5F9", border: "#64748B", text: "#475569" },
};

const FALLBACK: PartyColor = { bg: "#F1F5F9", border: "#94A3B8", text: "#475569" };

export function partyColorFor(party: string | null | undefined): PartyColor {
  if (!party) return FALLBACK;
  return PARTY_COLORS[party.trim().toLowerCase()] ?? FALLBACK;
}
