// One vocabulary for positions on the -1…+1 axes, shared by the quiz
// results, the Atlas entries and the compare workspace, so the same value
// reads the same way everywhere.

import { axisById } from "../quiz/axes";
import type { AxisId } from "../quiz/types";

export const BALANCED = 0.2; // below this, neither pole
export const MODERATE = 0.45;
export const STRONG = 0.7;

export type Strength = "balanced" | "leans" | "moderate" | "strong";

export function strengthOf(value: number): Strength {
  const a = Math.abs(value);
  if (a < BALANCED) return "balanced";
  if (a < MODERATE) return "leans";
  if (a < STRONG) return "moderate";
  return "strong";
}

export const STRENGTH_LABEL: Record<Strength, string> = {
  balanced: "Balanced",
  leans: "Mild",
  moderate: "Moderate",
  strong: "Strong",
};

// Lowercase a pole label mid-sentence, leaving proper nouns ("America First").
export const lcPole = (label: string) =>
  /\s[A-Z]/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1);

export function poleOf(axis: AxisId, value: number) {
  const def = axisById[axis];
  return value < 0 ? def.negative : def.positive;
}

// "Strongly restrictive", "Leans federal", "Balanced".
export function positionLabel(axis: AxisId, value: number): string {
  const strength = strengthOf(value);
  if (strength === "balanced") return "Balanced";
  const pole = lcPole(poleOf(axis, value).label);
  switch (strength) {
    case "leans":
      return `Leans ${pole}`;
    case "moderate":
      return `Moderately ${pole}`;
    case "strong":
      return `Strongly ${pole}`;
  }
}

// A position as a 0–100 figure: 0 at the negative pole, 50 balanced.
export const value100 = (value: number) => Math.round((Math.max(-1, Math.min(1, value)) + 1) * 50);

// Distance between two positions, in points on the same 0–100 scale.
export const pointsApart = (gap: number) => Math.round(Math.abs(gap) * 50);

export type GapSize = "close" | "moderate" | "clear" | "wide";

export function gapSize(gap: number): GapSize {
  const g = Math.abs(gap);
  if (g < 0.35) return "close";
  if (g < 0.6) return "moderate";
  if (g < 1) return "clear";
  return "wide";
}

export const GAP_LABEL: Record<GapSize, string> = {
  close: "Close",
  moderate: "Moderate gap",
  clear: "Clear gap",
  wide: "Wide gap",
};

// Which way `them` sits from `you`: "more restrictive", or null when level.
export function directionFrom(axis: AxisId, you: number, them: number): string | null {
  if (Math.abs(them - you) < 0.05) return null;
  const pole = them > you ? axisById[axis].positive : axisById[axis].negative;
  return `more ${lcPole(pole.label)}`;
}
