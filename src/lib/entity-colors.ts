import type { EntityType } from "@/lib/validation/entity";

export interface EntityColor {
  bg: string;
  border: string;
  text: string;
}

export const entityColors: Record<EntityType, EntityColor> = {
  politician: { bg: "#EFF6FF", border: "#3B82F6", text: "#1D4ED8" },
  pundit: { bg: "#FFF7ED", border: "#F97316", text: "#C2410C" },
  journalist: { bg: "#ECFDF5", border: "#10B981", text: "#047857" },
  organization: { bg: "#FAF5FF", border: "#A855F7", text: "#7E22CE" },
  company: { bg: "#FEFCE8", border: "#EAB308", text: "#A16207" },
  lobbyist: { bg: "#F0FDFA", border: "#14B8A6", text: "#0F766E" },
  donor: { bg: "#FEF2F2", border: "#F43F5E", text: "#BE123C" },
};

const FALLBACK_COLOR: EntityColor = { bg: "#F1F5F9", border: "#94A3B8", text: "#475569" };

// Entity `type` values in the database can lag the current EntityType union
// during a taxonomy migration (e.g. legacy "person" records not yet
// reclassified) — look up by arbitrary string, not just EntityType, and
// never throw on an unrecognized one.
export function entityColorFor(type: string): EntityColor {
  return (entityColors as Record<string, EntityColor>)[type] ?? FALLBACK_COLOR;
}
