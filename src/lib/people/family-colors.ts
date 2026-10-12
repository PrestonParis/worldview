import type { NodeFamily } from "@/lib/graph/lean";

// Node fill by political family, shared by the SVG previews (CSS vars,
// theme-aware) and the WebGL network (hex, picked per theme).
export const FAMILY_FILL: Record<NodeFamily, string> = {
  liberal: "var(--viz-dem)",
  conservative: "var(--viz-rep)",
  unplaced: "#94A3B8",
  institution: "#475569",
};

export const FAMILY_HEX: Record<"light" | "dark", Record<NodeFamily, string>> = {
  light: { liberal: "#2166AC", conservative: "#B2182B", unplaced: "#94A3B8", institution: "#334155" },
  dark: { liberal: "#4393C3", conservative: "#D6604D", unplaced: "#64748B", institution: "#CBD5E1" },
};

export const FAMILY_LABEL: Record<NodeFamily, string> = {
  liberal: "Left of center",
  conservative: "Right of center",
  unplaced: "Person, not placed",
  institution: "Institution or office",
};
