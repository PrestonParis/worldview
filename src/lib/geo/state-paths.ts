// SVG outlines of the 50 states and DC, projected once on the server from
// public/data/us-states.geojson: Albers equal-area conic (the usual U.S.
// projection), Alaska and Hawaii moved into insets. Points closer than half
// a unit are dropped, which keeps the markup small at no visible cost.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { insetPosition } from "./insets";

export interface StatePath {
  fips: string;
  abbr: string;
  name: string;
  d: string;
  label: [number, number] | null; // centroid of the largest polygon, if it fits a label
}

export const STATE_MAP_WIDTH = 960;

const RAD = Math.PI / 180;
const [PHI1, PHI2, PHI0, LAMBDA0] = [29.5 * RAD, 45.5 * RAD, 37.5 * RAD, -96 * RAD];
const N = (Math.sin(PHI1) + Math.sin(PHI2)) / 2;
const C = Math.cos(PHI1) ** 2 + 2 * N * Math.sin(PHI1);
const RHO0 = Math.sqrt(C - 2 * N * Math.sin(PHI0)) / N;

function albers(lon: number, lat: number): [number, number] {
  const rho = Math.sqrt(C - 2 * N * Math.sin(lat * RAD)) / N;
  const theta = N * (lon * RAD - LAMBDA0);
  return [rho * Math.sin(theta), -(RHO0 - rho * Math.cos(theta))];
}

type Ring = [number, number][];
type Feature = { properties: { GEOID: string; NAME: string; STUSPS: string }; geometry: { type: string; coordinates: unknown } };

// Labels only on states big enough to hold two letters.
const MIN_LABEL_AREA = 1400;
// Where a polygon's centroid lands badly (coastlines, crescents), the label
// goes at a hand-picked longitude/latitude instead.
const LABEL_AT: Record<string, [number, number]> = {
  FL: [-81.6, 28.3],
  LA: [-92.4, 31.1],
  MI: [-84.7, 43.4],
  KY: [-85.3, 37.5],
};

// The scale and offset that fit the projected states into the map, kept so
// points (cities) can be placed on the same map with projectPoint.
export interface MapFrame {
  minX: number;
  minY: number;
  k: number;
  pad: number;
}

// A longitude/latitude in the given state (FIPS, for the Alaska and Hawaii
// insets) to map coordinates.
export function projectPoint(frame: MapFrame, fips: string, lon: number, lat: number): [number, number] {
  const [x, y] = albers(...insetPosition(fips, lon, lat));
  return [Math.round(((x - frame.minX) * frame.k + frame.pad) * 10) / 10, Math.round(((y - frame.minY) * frame.k + frame.pad) * 10) / 10];
}

let cached: Promise<{ width: number; height: number; states: StatePath[]; frame: MapFrame }> | null = null;

export function loadStatePaths() {
  cached ??= build();
  return cached;
}

async function build() {
  const raw = JSON.parse(await readFile(join(process.cwd(), "public/data/us-states.geojson"), "utf8")) as { features: Feature[] };
  const projected = raw.features.map((f) => {
    const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : (f.geometry.coordinates as unknown[])) as [number, number][][][];
    return {
      p: f.properties,
      polys: polys.map((poly) => poly.map((ring) => ring.map(([lon, lat]) => albers(...insetPosition(f.properties.GEOID, lon, lat))))),
    };
  });

  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const s of projected) for (const poly of s.polys) for (const ring of poly) for (const [x, y] of ring) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const pad = 4;
  const k = (STATE_MAP_WIDTH - pad * 2) / (maxX - minX);
  const height = Math.ceil((maxY - minY) * k + pad * 2);
  const fit = ([x, y]: [number, number]): [number, number] => [(x - minX) * k + pad, (y - minY) * k + pad];

  const states = projected.map(({ p, polys }) => {
    let d = "";
    let best: { area: number; c: [number, number] } = { area: 0, c: [0, 0] };
    for (const poly of polys) {
      poly.forEach((ring, i) => {
        const pts: Ring = [];
        for (const pt of ring.map(fit)) {
          const last = pts.at(-1);
          if (!last || Math.abs(pt[0] - last[0]) + Math.abs(pt[1] - last[1]) >= 0.5) pts.push(pt);
        }
        if (pts.length < 3) return;
        d += `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}Z`;
        if (i === 0) {
          const c = centroid(pts);
          if (c.area > best.area) best = c;
        }
      });
    }
    return {
      fips: p.GEOID,
      abbr: p.STUSPS,
      name: p.NAME,
      d,
      label: best.area < MIN_LABEL_AREA ? null : LABEL_AT[p.STUSPS] ? round(fit(albers(...LABEL_AT[p.STUSPS]))) : round(best.c),
    };
  });
  return { width: STATE_MAP_WIDTH, height, states, frame: { minX, minY, k, pad } };
}

const round = ([x, y]: [number, number]): [number, number] => [Math.round(x), Math.round(y)];

function centroid(ring: Ring) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % ring.length];
    const cross = x0 * y1 - x1 * y0;
    a += cross; cx += (x0 + x1) * cross; cy += (y0 + y1) * cross;
  }
  return { area: Math.abs(a / 2), c: [cx / (3 * a), cy / (3 * a)] as [number, number] };
}
