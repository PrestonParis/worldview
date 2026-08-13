import type { EntityType } from "@/lib/validation/entity";

// Donor/funding relationships aren't a distinct edge "type" in the data
// model — they're ordinary labeled edges — so this pattern is how every
// donor-aware view (entity profiles, the money graph) recognizes them.
export const donorLabelPattern = /(donat|contribut|campaign financ|funded|funding)/i;

export function isDonorEdge(label: string): boolean {
  return donorLabelPattern.test(label);
}

export const individualEntityTypes = new Set<EntityType>([
  "politician",
  "pundit",
  "journalist",
]);
