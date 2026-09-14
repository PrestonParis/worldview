// A tile-grid ("statebins") layout of the US — each state a same-size cell in
// an approximate geographic arrangement. Used by /money/map instead of a
// true polygon choropleth: no external GeoJSON to vendor, every state stays
// visible regardless of land area, and it renders as plain SVG. Swap in a
// real MapLibre choropleth later behind the same query if wanted.
//
// Dependency-free (imported by the .mjs scripts is not needed today, but keep
// it that way for consistency with industries.ts).

export interface StateCell {
  abbr: string;
  name: string;
  row: number;
  col: number;
}

// 8 rows × 11 cols. Layout follows the common statebins/geofacet grid.
export const US_STATE_GRID: StateCell[] = [
  ["AK", "Alaska", 0, 0], ["ME", "Maine", 0, 10],
  ["WI", "Wisconsin", 1, 7], ["VT", "Vermont", 1, 9], ["NH", "New Hampshire", 1, 10],
  ["WA", "Washington", 2, 0], ["ID", "Idaho", 2, 1], ["MT", "Montana", 2, 2], ["ND", "North Dakota", 2, 3], ["MN", "Minnesota", 2, 4], ["IL", "Illinois", 2, 6], ["MI", "Michigan", 2, 7], ["NY", "New York", 2, 8], ["MA", "Massachusetts", 2, 9],
  ["OR", "Oregon", 3, 0], ["NV", "Nevada", 3, 1], ["WY", "Wyoming", 3, 2], ["SD", "South Dakota", 3, 3], ["IA", "Iowa", 3, 4], ["IN", "Indiana", 3, 5], ["OH", "Ohio", 3, 6], ["PA", "Pennsylvania", 3, 7], ["NJ", "New Jersey", 3, 8], ["CT", "Connecticut", 3, 9], ["RI", "Rhode Island", 3, 10],
  ["CA", "California", 4, 0], ["UT", "Utah", 4, 1], ["CO", "Colorado", 4, 2], ["NE", "Nebraska", 4, 3], ["MO", "Missouri", 4, 4], ["KY", "Kentucky", 4, 5], ["WV", "West Virginia", 4, 6], ["VA", "Virginia", 4, 7], ["MD", "Maryland", 4, 8], ["DE", "Delaware", 4, 9],
  ["AZ", "Arizona", 5, 1], ["NM", "New Mexico", 5, 2], ["KS", "Kansas", 5, 3], ["AR", "Arkansas", 5, 4], ["TN", "Tennessee", 5, 5], ["NC", "North Carolina", 5, 6], ["SC", "South Carolina", 5, 7], ["DC", "District of Columbia", 5, 8],
  ["OK", "Oklahoma", 6, 3], ["LA", "Louisiana", 6, 4], ["MS", "Mississippi", 6, 5], ["AL", "Alabama", 6, 6], ["GA", "Georgia", 6, 7],
  ["HI", "Hawaii", 7, 0], ["TX", "Texas", 7, 3], ["FL", "Florida", 7, 8],
].map(([abbr, name, row, col]) => ({
  abbr: abbr as string,
  name: name as string,
  row: row as number,
  col: col as number,
}));

export const US_STATE_GRID_ROWS = 8;
export const US_STATE_GRID_COLS = 11;

export const US_STATE_NAMES: Record<string, string> = Object.fromEntries(
  US_STATE_GRID.map((c) => [c.abbr, c.name]),
);

export function usStateName(abbr: string): string {
  return US_STATE_NAMES[abbr.toUpperCase()] ?? abbr;
}
