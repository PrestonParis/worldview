// A 2D map of the ideology catalog: the first two principal components of the
// ideologies' reference positions (undefined axes read as neutral). With the
// current catalog the first runs progressive → traditional and the second
// state-directed → free-market; signs are fixed so that stays true.

import { axisIds, type AxisId } from "./types";
import { ideologies } from "./ideologies";
import type { IdeologyMatch } from "./results";

export interface MapPoint {
  x: number; // -1…+1
  y: number; // -1…+1, up = free-market
}

function principalComponents(rows: number[][], k: number): number[][] {
  const d = rows[0].length;
  const n = rows.length;
  let cov = Array.from({ length: d }, (_, a) =>
    Array.from({ length: d }, (_, b) => rows.reduce((s, r) => s + r[a] * r[b], 0) / n),
  );
  const pcs: number[][] = [];
  for (let c = 0; c < k; c++) {
    let v = Array.from({ length: d }, (_, j) => 1 + j * 0.01);
    for (let it = 0; it < 300; it++) {
      const w = cov.map((row) => row.reduce((s, x, j) => s + x * v[j], 0));
      const norm = Math.hypot(...w);
      v = w.map((x) => x / norm);
    }
    const lambda = cov.map((row) => row.reduce((s, x, j) => s + x * v[j], 0)).reduce((s, x, j) => s + x * v[j], 0);
    pcs.push(v);
    cov = cov.map((row, a) => row.map((x, b) => x - lambda * v[a] * v[b]));
  }
  return pcs;
}

function orient(pc: number[], axis: AxisId): number[] {
  return pc[axisIds.indexOf(axis)] < 0 ? pc.map((x) => -x) : pc;
}

// The map's two directions, plus the centring and scale that fit the
// catalog into -1…+1.
function buildBasis() {
  const rows = ideologies.map((i) => axisIds.map((a) => i.position[a]));
  const mean = axisIds.map((_, j) => rows.reduce((s, r) => s + r[j], 0) / rows.length);
  const centered = rows.map((r) => r.map((v, j) => v - mean[j]));
  const [pc1, pc2] = principalComponents(centered, 2);
  const px = orient(pc1, "social");
  const py = orient(pc2, "regulation");
  const raw = centered.map((r) => [r.reduce((s, x, j) => s + x * px[j], 0), r.reduce((s, x, j) => s + x * py[j], 0)]);
  const sx = Math.max(...raw.map((p) => Math.abs(p[0])));
  const sy = Math.max(...raw.map((p) => Math.abs(p[1])));
  return { mean, px, py, sx, sy, raw };
}

const basis = buildBasis();

function buildMap(): Record<string, MapPoint> {
  return Object.fromEntries(ideologies.map((i, n) => [i.id, { x: basis.raw[n][0] / basis.sx, y: basis.raw[n][1] / basis.sy }]));
}

// Any set of axis positions on the same map, clamped to its edges. Moves with
// every answer, where placeRespondent snaps to the nearest traditions.
export function projectPosition(position: Record<AxisId, number>): MapPoint {
  const c = axisIds.map((a, j) => position[a] - basis.mean[j]);
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  return {
    x: clamp(c.reduce((s, x, j) => s + x * basis.px[j], 0) / basis.sx),
    y: clamp(c.reduce((s, x, j) => s + x * basis.py[j], 0) / basis.sy),
  };
}

export const ideologyMap = buildMap();

// The respondent sits among their closest matches (inverse-distance weighted),
// so the map agrees with the ranking.
export function placeRespondent(matches: IdeologyMatch[]): MapPoint {
  let x = 0;
  let y = 0;
  let total = 0;
  for (const m of matches.slice(0, 5)) {
    const w = 1 / Math.max(m.distance, 0.05) ** 4;
    const p = ideologyMap[m.ideology.id];
    x += w * p.x;
    y += w * p.y;
    total += w;
  }
  return { x: x / total, y: y / total };
}
