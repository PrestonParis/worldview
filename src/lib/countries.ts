import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";

export interface CountryProperties {
  name: string;
  "ISO3166-1-Alpha-3": string;
  "ISO3166-1-Alpha-2": string;
}

export type CountryFeature = Feature<Polygon | MultiPolygon, CountryProperties>;
export type CountryCollection = FeatureCollection<Polygon | MultiPolygon, CountryProperties>;

let loadPromise: Promise<CountryCollection> | null = null;

export function loadCountries(): Promise<CountryCollection> {
  if (!loadPromise) {
    loadPromise = fetch("/data/countries.geojson").then((res) => res.json());
  }
  return loadPromise;
}

export function countryId(feature: CountryFeature): string {
  return feature.properties["ISO3166-1-Alpha-3"];
}

export async function searchCountries(
  query: string,
  limit = 8
): Promise<CountryFeature[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const { features } = await loadCountries();
  return features
    .filter((f) => {
      const p = f.properties;
      return (
        p.name.toLowerCase().includes(q) ||
        p["ISO3166-1-Alpha-3"].toLowerCase() === q ||
        p["ISO3166-1-Alpha-2"].toLowerCase() === q
      );
    })
    .sort((a, b) => a.properties.name.localeCompare(b.properties.name))
    .slice(0, limit);
}

export async function getCountryById(
  id: string
): Promise<CountryFeature | null> {
  const { features } = await loadCountries();
  return features.find((f) => countryId(f) === id) ?? null;
}

export async function getCountryBbox(
  id: string
): Promise<[number, number, number, number] | null> {
  const feature = await getCountryById(id);
  if (!feature) return null;
  const [minX, minY, maxX, maxY] = turf.bbox(feature);
  return [minX, minY, maxX, maxY];
}

// Neighbors aren't in the source data, so we derive them: buffer the
// selected country's mainland slightly (bridges small gaps from boundary
// simplification / shared-coastline rendering) and test intersection
// against every other country.
//
// Running booleanIntersects against a full multipolygon gets expensive fast
// for geometrically complex countries — in testing, Japan's ~14k vertices
// across its many islands took 38+ seconds against all 257 candidates and
// froze the tab; even after simplifying and bbox-prefiltering candidates,
// archipelago/far-flung-territory countries (Japan, USA, Indonesia) still
// took seconds because turf's booleanIntersects cost scales with the
// number of separate polygon *parts*, not just vertex count. Reducing the
// target to only its single largest landmass fixes that (down to
// consistently well under 2s) and matches what "neighboring countries"
// means for this app anyway — the map frames the selected country's main
// body, so that's the shape a user expects "neighbors" to be relative to.
// The tradeoff: a neighbor that only touches a smaller island/territory
// (not the mainland) won't be detected. Acceptable for a visual toggle,
// not a legal adjacency claim.
const neighborCache = new Map<string, string[]>();

function bboxesOverlap(
  a: [number, number, number, number],
  b: [number, number, number, number]
): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

function mainlandPolygon(feature: CountryFeature): Feature<Polygon> {
  if (feature.geometry.type !== "MultiPolygon") {
    return turf.polygon(feature.geometry.coordinates);
  }
  let best: Feature<Polygon> | null = null;
  let bestArea = -1;
  for (const coords of feature.geometry.coordinates) {
    const poly = turf.polygon(coords);
    const area = turf.area(poly);
    if (area > bestArea) {
      bestArea = area;
      best = poly;
    }
  }
  // Only reachable for a MultiPolygon with zero parts, which shouldn't
  // occur in practice given the source data.
  return best ?? turf.polygon(feature.geometry.coordinates[0]);
}

export async function getNeighborIds(id: string): Promise<string[]> {
  const cached = neighborCache.get(id);
  if (cached) return cached;

  const { features } = await loadCountries();
  const target = features.find((f) => countryId(f) === id);
  if (!target) return [];

  const simplified = turf.simplify(mainlandPolygon(target), {
    tolerance: 0.05,
    highQuality: false,
  });
  const bufferPaddingDeg = 0.5; // generous pad to bridge strait gaps lost to simplification
  const [minX, minY, maxX, maxY] = turf.bbox(simplified);
  const searchBbox: [number, number, number, number] = [
    minX - bufferPaddingDeg,
    minY - bufferPaddingDeg,
    maxX + bufferPaddingDeg,
    maxY + bufferPaddingDeg,
  ];

  const candidates = features.filter((f) => {
    if (countryId(f) === id) return false;
    const fb = turf.bbox(f) as [number, number, number, number];
    return bboxesOverlap(searchBbox, fb);
  });

  const buffered = turf.buffer(simplified, 5, { units: "kilometers" });
  if (!buffered) return [];

  const neighbors = candidates
    .filter((f) => turf.booleanIntersects(buffered, f))
    .map(countryId);

  neighborCache.set(id, neighbors);
  return neighbors;
}
