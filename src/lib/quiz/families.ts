// Display metadata for ideology families: a label and an identity color used
// across the results page and the share image. Hex so it works in both
// Tailwind inline styles and next/og.

import type { IdeologyFamily } from "./types";

export const FAMILIES: Record<IdeologyFamily, { label: string; color: string }> = {
  left: { label: "Left", color: "#ec4899" },
  liberal: { label: "Liberal", color: "#3b82f6" },
  center: { label: "Center", color: "#8b5cf6" },
  conservative: { label: "Conservative", color: "#ef4444" },
  right: { label: "Right", color: "#f97316" },
  libertarian: { label: "Libertarian", color: "#eab308" },
  populist: { label: "Populist", color: "#14b8a6" },
  religious: { label: "Religious", color: "#84cc16" },
  other: { label: "Other", color: "#10b981" },
};

export const familyColor = (family: IdeologyFamily) => FAMILIES[family].color;
