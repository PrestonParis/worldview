// Filtering and facet counts for the People page's attribute explorer. Every facet counts
// the entities that pass all the *other* active filters, so each chart
// shows what clicking one of its segments would leave — the usual faceted
// search behaviour. Pure and dependency-light so it's unit-testable.

import { leanOf, type GraphSide } from "../graph/lean";
import { US_STATE_NAMES } from "../money/us-states";
import { entityPartyAndPlace, roleGroups } from "./public";
import { parseRowKey, spectrumRowOf } from "./spectrum";
import { NOT_RECORDED, bornOf, generationOf, type PersonTraits } from "./traits";
import type { Entity } from "../validation/entity";

export interface AttributeParams {
  q?: string;
  group?: string;
  // Comma-separated entity types, narrower than a role group (the People
  // page's spectrum links to "pundit" or "journalist" alone).
  type?: string;
  // A People-page spectrum group (src/lib/people/spectrum.ts).
  row?: string;
  side?: string;
  state?: string;
  ties?: string;
  sex?: string;
  race?: string;
  religion?: string;
  ancestry?: string;
  born?: string;
  gen?: string;
}

// How many matches the explorer lists; past that, narrowing is the way in.
export const ATTRIBUTE_RESULT_LIMIT = 24;

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

// Personal traits apply to people only; organizations have no value and
// drop out once a trait filter is on.
const PERSON_TYPES = new Set(["politician", "judge", "pundit", "journalist", "lobbyist", "donor"]);

export const TRAIT_KEYS = ["sex", "race", "religion", "ancestry", "born", "gen"] as const;
type TraitKey = (typeof TRAIT_KEYS)[number];
type FacetKey = "group" | "side" | "state" | "ties" | TraitKey;

export type AttributeFacets = Record<FacetKey, Record<string, number>>;
export type AttributeFacetTotals = Record<FacetKey, number>;

// A person's value(s) for each trait facet; "none" when nothing is recorded.
function traitValues(traits: PersonTraits | undefined): Record<TraitKey, string[]> {
  const one = (value: string | null | undefined) => [value ?? NOT_RECORDED];
  const many = (values: string[] | undefined) => (values?.length ? values : [NOT_RECORDED]);
  return {
    sex: one(traits?.sex),
    race: many(traits?.race),
    religion: many(traits?.religion),
    ancestry: many(traits?.ancestry),
    born: one(bornOf(traits?.birthCountry)),
    gen: one(generationOf(traits?.birthYear)),
  };
}

const NO_TRAITS: Record<TraitKey, string[]> = { sex: [], race: [], religion: [], ancestry: [], born: [], gen: [] };

export function buildAttributes(
  entities: Entity[],
  degree: Map<string, number>,
  params: AttributeParams,
  traits: Map<string, PersonTraits> = new Map(),
) {
  const query = (params.q ?? "").trim().toLowerCase();
  const types = params.type ? new Set(params.type.split(",")) : null;
  const row = parseRowKey(params.row);
  const active: Record<FacetKey, string | undefined> = {
    group: roleGroups.some((g) => g.key === params.group) ? params.group : undefined,
    side: params.side,
    state: params.state?.toUpperCase(),
    ties: tieBands.some((b) => b.key === params.ties) ? params.ties : undefined,
    ...(Object.fromEntries(TRAIT_KEYS.map((key) => [key, params[key] || undefined])) as Record<TraitKey, string | undefined>),
  };
  const keys = Object.keys(active) as FacetKey[];
  const facets = Object.fromEntries(keys.map((key) => [key, {}])) as AttributeFacets;
  const facetTotals = Object.fromEntries(keys.map((key) => [key, 0])) as AttributeFacetTotals;
  const rows: Entity[] = [];

  for (const entity of entities) {
    if (query && !`${entity.name} ${entity.description} ${entity.metadata}`.toLowerCase().includes(query)) continue;
    if (types && !types.has(entity.type)) continue;
    if (row && spectrumRowOf(entity) !== row) continue;
    const person = PERSON_TYPES.has(entity.type);
    const state = stateAbbrOf(entity);
    const values: Record<FacetKey, string[]> = {
      group: [GROUP_BY_TYPE.get(entity.type)].filter((v): v is string => Boolean(v)),
      // A missing political classification is meaningful for political
      // people, but not for an ordinary company, PAC or institution. Those
      // entities simply do not belong in this facet's denominator.
      side: (() => {
        const side = sideOf(entity);
        return side !== "uncharacterized" || ["politician", "judge", "pundit", "journalist"].includes(entity.type)
          ? [side]
          : [];
      })(),
      state: state ? [state] : [],
      ties: [bandOf(degree.get(entity.id) ?? 0)],
      ...(person ? traitValues(traits.get(entity.id)) : NO_TRAITS),
    };
    const misses = keys.filter((key) => {
      const want = active[key];
      return want && !values[key].includes(want);
    });
    if (misses.length === 0) rows.push(entity);
    // An entity counts toward a facet when it passes every other filter.
    for (const key of keys) {
      if (misses.length === 0 || (misses.length === 1 && misses[0] === key)) {
        if (values[key].length) facetTotals[key]++;
        for (const value of values[key]) facets[key][value] = (facets[key][value] ?? 0) + 1;
      }
    }
  }

  rows.sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || a.name.localeCompare(b.name));

  return { rows, facets, facetTotals };
}

export const ATTRIBUTE_KEYS = ["q", "group", "type", "row", "side", "state", "ties", ...TRAIT_KEYS] as const;

export function parseAttributeParams(search: URLSearchParams): AttributeParams {
  return Object.fromEntries(ATTRIBUTE_KEYS.flatMap((key) => (search.get(key) ? [[key, search.get(key)!]] : []))) as AttributeParams;
}

// Query string for `params` in a fixed key order, so equal filters share one
// cacheable URL.
export function attributeQuery(params: AttributeParams): string {
  const out = new URLSearchParams();
  for (const key of ATTRIBUTE_KEYS) if (params[key]) out.set(key, params[key]!);
  return out.toString();
}

export const isFiltered = (params: AttributeParams) => ATTRIBUTE_KEYS.some((key) => params[key]);
