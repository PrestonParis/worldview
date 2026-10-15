import type { AxisId, ChoiceOption, Condition, ItemModel, Lens, Loadings, Statement } from "../types";

// Choice option shorthand.
export function o(
  id: string,
  text: string,
  stance: string,
  axes: Loadings = {},
  lens?: Lens,
): ChoiceOption {
  return lens ? { id, text, stance, axes, lens } : { id, text, stance, axes };
}

// Checklist item: checked scores as `yes`, unchecked as `no`. Both sides
// should load the same axes; an axis only one side loads is ignored.
export function item(id: string, text: string, yesStance: string, yes: Loadings, noStance: string, no: Loadings): ChoiceOption {
  return { id, text, stance: yesStance, axes: yes, unchecked: { stance: noStance, axes: no } };
}

// The exclusive "None of these" box every checklist ends with. It carries no
// loadings of its own: choosing it just leaves every other item unchecked.
export const noneOfThese: ChoiceOption = { id: "none", text: "None of these", stance: "none of these", axes: {}, exclusive: true };

// "Question q was answered with one of these options."
export function when(q: string, ...ids: string[]): Condition {
  return { q, in: ids };
}

// Shorthand for a statement written for one axis (weight 1), with optional
// side loadings on others. Centre statements (location 0) are compromise
// claims and default to the ideal-point model; everything else is
// directional unless overridden.
export function st(
  id: string,
  location: number,
  text: string,
  side?: Loadings,
  model: ItemModel = location === 0 ? "ideal" : "directional",
): Statement {
  const axis = id.split(".")[0] as AxisId;
  return { id, text, model, axes: { [axis]: { location, weight: 1 }, ...side } };
}

// Loadings from [axis, location, weight] tuples, for choice options.
export function L(...entries: [AxisId, number, number][]): Loadings {
  return Object.fromEntries(entries.map(([a, location, weight]) => [a, { location, weight }]));
}

// Side loading shorthand: on(axis, location, weight).
export function on(axis: AxisId, location: number, weight = 0.5): Loadings {
  return { [axis]: { location, weight } };
}
