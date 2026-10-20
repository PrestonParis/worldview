// The quiz narrows a respondent down the way a conversation would: broad
// questions that tell the families apart first, then, once a respondent sits
// in a fairly specific group, the questions that divide that group's
// traditions. Both come from one rule: ask where the traditions a respondent
// could still be split most.
//
// Candidate weights come from a precision-weighted distance like the
// matcher's (results.ts), softened by a temperature so that early on, when
// little is measured, many traditions across many families stay in play.

import type { AxisState } from "./engine";
import { ideologies } from "./ideologies";
import { acceptedLens } from "./lenses";
import { axisIds, lensIds, type AxisId, type Lens, type Loadings } from "./types";

// Squared-distance scale over which a tradition's weight falls by e.
const TEMPERATURE = 0.03;
const SECONDARY = 0.5;
const LENS_GAP_SQ = 1.2 ** 2;
const LENS_PRECISION = 1 / 0.02;
// Response noise in posterior-variance units: an answer can't teach much
// about an axis that's already well measured.
const ITEM_NOISE = 0.05;

const cores = ideologies.map((i) => new Set<AxisId>(i.core ?? axisIds));

export function candidateWeights(axes: Record<AxisId, AxisState>, lens: Lens): number[] {
  const d2 = ideologies.map((ideology, n) => {
    let num = 0;
    let den = 0;
    for (const axis of axisIds) {
      const s = axes[axis];
      if (!s.answered) continue;
      const w = (cores[n].has(axis) ? 1 : SECONDARY) / (s.sd ** 2 + 0.01);
      num += w * (s.mean - ideology.position[axis]) ** 2;
      den += w;
    }
    for (const l of lensIds) {
      const value = lens[l];
      const accepted = acceptedLens(ideology, l);
      if (!value || !accepted) continue;
      num += LENS_PRECISION * (accepted.includes(value) ? 0 : LENS_GAP_SQ);
      den += LENS_PRECISION;
    }
    return den > 0 ? num / den : 0;
  });
  const best = Math.min(...d2);
  const raw = d2.map((d) => Math.exp(-(d - best) / TEMPERATURE));
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / total);
}

// How much an answer on this axis would split the candidates: the weighted
// spread of their positions (counting an axis outside a tradition's core at
// half), scaled by how much the respondent's own position is still unknown.
export function splitScore(axis: AxisId, weights: number[], axes: Record<AxisId, AxisState>): number {
  let wsum = 0;
  let mean = 0;
  ideologies.forEach((i, n) => {
    const w = weights[n] * (cores[n].has(axis) ? 1 : SECONDARY);
    wsum += w;
    mean += w * i.position[axis];
  });
  if (wsum === 0) return 0;
  mean /= wsum;
  let variance = 0;
  ideologies.forEach((i, n) => {
    const w = weights[n] * (cores[n].has(axis) ? 1 : SECONDARY);
    variance += w * (i.position[axis] - mean) ** 2;
  });
  variance /= wsum;
  const unknown = axes[axis].sd ** 2;
  return variance * (unknown / (unknown + ITEM_NOISE));
}

// The same for a question: each axis its options load, at the strongest
// loading any option gives it.
export function questionScore(options: { axes: Loadings }[], split: Partial<Record<AxisId, number>>): number {
  const strongest: Partial<Record<AxisId, number>> = {};
  for (const o of options) {
    for (const [axis, l] of Object.entries(o.axes) as [AxisId, { weight: number }][]) {
      strongest[axis] = Math.max(strongest[axis] ?? 0, l.weight);
    }
  }
  return (Object.entries(strongest) as [AxisId, number][]).reduce((sum, [axis, w]) => sum + w * (split[axis] ?? 0), 0);
}
