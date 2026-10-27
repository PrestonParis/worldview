import type { z } from "zod";
import type { economicProfileSchema, specialistProfileSchema } from "./profile-schema";

export type EconomicProfileResult = z.infer<typeof economicProfileSchema>;
export type SpecialistProfileResult = z.infer<typeof specialistProfileSchema>;

export interface AtlasProfile {
  savedPhilosophies: string[];
  economicResult: EconomicProfileResult | null;
  authorityResult: SpecialistProfileResult | null;
  foreignPolicyResult: SpecialistProfileResult | null;
  updatedAt: string | null;
}

export const EMPTY_ATLAS_PROFILE: AtlasProfile = {
  savedPhilosophies: [],
  economicResult: null,
  authorityResult: null,
  foreignPolicyResult: null,
  updatedAt: null,
};
