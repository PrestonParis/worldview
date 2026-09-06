// Semantic color per tool page — a distinct axis from entity-colors.ts,
// which colors *entity types* (person/organization/election/company) inside
// the graph. Used only as small accent dots/pills in nav and homepage chrome,
// never as large fills. Where a page conceptually maps onto an entity type
// (people ~ person, money ~ company), the hex is shared with
// entity-colors.ts on purpose so the two systems don't clash when seen
// side by side.
export interface TypeColor {
  bg: string;
  border: string;
  text: string;
}

export const typeColors: Record<string, TypeColor> = {
  people: { bg: "#EFF6FF", border: "#3B82F6", text: "#1D4ED8" }, // blue
  studio: { bg: "#FDF2F8", border: "#EC4899", text: "#BE185D" }, // pink
  legislation: { bg: "#EEF2FF", border: "#6366F1", text: "#4338CA" }, // indigo
  money: { bg: "#F0FDF4", border: "#22C55E", text: "#15803D" }, // green
  elections: { bg: "#FEFCE8", border: "#EAB308", text: "#A16207" }, // yellow
  geography: { bg: "#ECFEFF", border: "#06B6D4", text: "#0E7490" }, // cyan
};

export function typeColorFor(slug: string): TypeColor {
  return typeColors[slug] ?? { bg: "#F1F5F9", border: "#94A3B8", text: "#475569" };
}
