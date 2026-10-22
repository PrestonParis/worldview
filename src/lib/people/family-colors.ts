import type { NodeFamily } from "@/lib/graph/lean";

// Node fill by political family (CSS vars, theme-aware).
export const FAMILY_FILL: Record<NodeFamily, string> = {
  liberal: "var(--viz-dem)",
  conservative: "var(--viz-rep)",
  unplaced: "#94A3B8",
  institution: "#475569",
};

