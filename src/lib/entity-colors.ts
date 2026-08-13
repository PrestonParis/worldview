import type { EntityType } from "@/lib/validation/entity";

export const entityColors: Record<EntityType, { bg: string; border: string; text: string }> = {
  person: { bg: "#EFF6FF", border: "#3B82F6", text: "#1D4ED8" },
  organization: { bg: "#FAF5FF", border: "#A855F7", text: "#7E22CE" },
  election: { bg: "#FFF7ED", border: "#F97316", text: "#C2410C" },
  company: { bg: "#FEFCE8", border: "#EAB308", text: "#A16207" },
};
