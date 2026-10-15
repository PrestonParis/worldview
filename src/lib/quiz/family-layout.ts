// The landing map: traditions grouped by family in a 3×3 grid of clusters,
// not plotted on axes (no two dimensions fit them all). Pure geometry.

import { ideologies } from "./ideologies";
import type { IdeologyFamily } from "./types";

// Reading order of the grid, three per row.
export const FAMILY_ORDER: IdeologyFamily[] = ["left", "liberal", "center", "conservative", "right", "libertarian", "populist", "religious", "other"];

export interface Spot {
  x: number; // 0–100, % of the plot's width
  y: number; // 0–100, % of the plot's height
}

export const CELL = 100 / 3;
// Room at the top of each cell for its family label.
const LABEL = 8;
// Sunflower spacing: point k sits at SPACING·√(k + ½) from the cluster centre.
// Sized so the largest family (13) fits its cell with a margin.
export const SPACING = 3;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const round2 = (v: number) => Number(v.toFixed(2));

// Where each family's cluster is centred.
export function familyCentre(family: IdeologyFamily): Spot {
  const n = FAMILY_ORDER.indexOf(family);
  return { x: (n % 3) * CELL + CELL / 2, y: Math.floor(n / 3) * CELL + LABEL + (CELL - LABEL) / 2 };
}

// Every tradition's spot. `order` (ids, best first) puts the best fits at
// the centre of their cluster; null keeps catalog order. Rounded so
// server-rendered inline styles match the client exactly.
export function familyLayout(order: string[] | null): Record<string, Spot> {
  const rank = order ? new Map(order.map((id, n) => [id, n])) : null;
  const out: Record<string, Spot> = {};
  for (const family of FAMILY_ORDER) {
    const members = ideologies.filter((i) => i.family === family);
    if (rank) members.sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
    const c = familyCentre(family);
    members.forEach((i, k) => {
      const r = SPACING * Math.sqrt(k + 0.5);
      const angle = k * GOLDEN_ANGLE;
      out[i.id] = { x: round2(c.x + r * Math.cos(angle)), y: round2(c.y + r * Math.sin(angle)) };
    });
  }
  return out;
}
