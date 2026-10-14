// Filtering and facet counts for the People directory. Every facet counts
// the entities that pass all the *other* active filters, so each chart
// shows what clicking one of its segments would leave — the usual faceted
// search behaviour. Pure and dependency-light so it's unit-testable.

import { leanOf, type GraphSide } from "../graph/lean";
import { US_STATE_NAMES } from "../money/us-states";
import { entityPartyAndPlace, roleGroups } from "./public";
import type { Entity } from "../validation/entity";

export interface DirectoryParams {
  q?: string;
  group?: string;
  side?: string;
  state?: string;
  ties?: string;
  sort?: string;
  layout?: string;
  page?: string;
}

export const DIRECTORY_PAGE_SIZE = 60;

export const tieBands = [
  { key: "0", label: "0", min: 0, max: 0 },
  { key: "1", label: "1", min: 1, max: 1 },
  { key: "2-4", label: "2–4", min: 2, max: 4 },
  { key: "5-9", label: "5–9", min: 5, max: 9 },
  { key: "10+", label: "10+", min: 10, max: Infinity },
] as const;

const STATE_ABBR_BY_NAME = new Map(Object.entries(US_STATE_NAMES).map(([abbr, name]) => [name.toLowerCase(), abbr]));

// Recorded states mix "TX" and "Texas"; normalise to the tile-grid's
// two-letter codes. Territories and anything unrecognised return null.
export function stateAbbrOf(entity: Pick<Entity, "metadata">): string | null {
  const { place } = entityPartyAndPlace(entity);
  if (!place) return null;
  const upper = place.trim().toUpperCase();
  if (US_STATE_NAMES[upper]) return upper;
  return STATE_ABBR_BY_NAME.get(place.trim().toLowerCase()) ?? null;
}

export function sideOf(entity: Pick<Entity, "name" | "type" | "metadata">): GraphSide {
  return leanOf(entity) ?? "uncharacterized";
}

const GROUP_BY_TYPE = new Map<string, string>(
  roleGroups.flatMap((group) => group.types.map((type) => [type, group.key] as const)),
);

function bandOf(degree: number): string {
  return tieBands.find((band) => degree >= band.min && degree <= band.max)?.key ?? "0";
}

type FacetKey = "group" | "side" | "state" | "ties";

export interface DirectoryFacets {
  group: Record<string, number>;
  side: Record<string, number>;
  state: Record<string, number>;
  ties: Record<string, number>;
}

export function buildDirectory(entities: Entity[], degree: Map<string, number>, params: DirectoryParams) {
  const query = (params.q ?? "").trim().toLowerCase();
  const active: Record<FacetKey, string | undefined> = {
    group: roleGroups.some((g) => g.key === params.group) ? params.group : undefined,
    side: params.side,
    state: params.state?.toUpperCase(),
    ties: tieBands.some((b) => b.key === params.ties) ? params.ties : undefined,
  };
  const facets: DirectoryFacets = { group: {}, side: {}, state: {}, ties: {} };
  const keys = Object.keys(facets) as FacetKey[];
  const rows: Entity[] = [];

  for (const entity of entities) {
    if (query && !`${entity.name} ${entity.description} ${entity.metadata}`.toLowerCase().includes(query)) continue;
    const values: Record<FacetKey, string | null> = {
      group: GROUP_BY_TYPE.get(entity.type) ?? null,
      side: sideOf(entity),
      state: stateAbbrOf(entity),
      ties: bandOf(degree.get(entity.id) ?? 0),
    };
    const misses = keys.filter((key) => active[key] && values[key] !== active[key]);
    if (misses.length === 0) rows.push(entity);
    // An entity counts toward a facet when it passes every other filter.
    for (const key of keys) {
      const value = values[key];
      if (value === null) continue;
      if (misses.length === 0 || (misses.length === 1 && misses[0] === key)) {
        facets[key][value] = (facets[key][value] ?? 0) + 1;
      }
    }
  }

  rows.sort((a, b) => {
    if (params.sort === "name") return a.name.localeCompare(b.name);
    if (params.sort === "updated") return String(b.updatedAt).localeCompare(String(a.updatedAt));
    return (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || a.name.localeCompare(b.name);
  });

  return { rows, facets };
}

// Directory URL with `patch` applied; any filter change resets the page.
export function directoryHref(params: DirectoryParams, patch: Partial<DirectoryParams>): string {
  const next = new URLSearchParams({ view: "directory" });
  const merged = { ...params, ...("page" in patch ? {} : { page: undefined }), ...patch };
  for (const [key, value] of Object.entries(merged)) {
    if (value) next.set(key, value);
  }
  return `/people?${next.toString()}`;
}
