import type { EntityType } from "@/lib/validation/entity";

export const entityColors: Record<EntityType, { bg: string; border: string; text: string }> = {
  person: { bg: "#EFF6FF", border: "#3B82F6", text: "#1D4ED8" },
  organization: { bg: "#FAF5FF", border: "#A855F7", text: "#7E22CE" },
  bill: { bg: "#F0FDF4", border: "#22C55E", text: "#15803D" },
  court_case: { bg: "#F5F3FF", border: "#8B5CF6", text: "#6D28D9" },
  election: { bg: "#FFF7ED", border: "#F97316", text: "#C2410C" },
  country: { bg: "#FEF2F2", border: "#EF4444", text: "#B91C1C" },
  company: { bg: "#FEFCE8", border: "#EAB308", text: "#A16207" },
};
