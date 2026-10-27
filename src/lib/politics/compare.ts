// The comparison workspace's analysis: how far apart traditions sit, where
// they agree, where they split, and what sets each apart. Pure.

import { axes } from "../quiz/axes";
import type { AxisGroup, AxisId, Ideology } from "../quiz/types";
import { BALANCED, pointsApart } from "./axis-language";

export interface AxisSpread {
  axis: AxisId;
  group: AxisGroup;
  values: number[]; // in the order of the traditions passed in
  spread: number; // max − min, 0…2
  mean: number;
}

export interface Distinctive {
  id: string;
  axis: AxisId;
  value: number;
  othersMean: number;
}

export interface TraditionComparison {
  rows: AxisSpread[];
  pairs: { a: string; b: string; points: number }[]; // RMS distance over all axes, 0–100
  shared: AxisSpread[];
  splits: AxisSpread[];
  distinctive: Distinctive[];
}

const SHARED_SPREAD = 0.35;

export function compareTraditions(traditions: Ideology[]): TraditionComparison {
  const rows: AxisSpread[] = axes.map((a) => {
    const values = traditions.map((t) => t.position[a.id]);
    return {
      axis: a.id,
      group: a.group,
      values,
      spread: Math.max(...values) - Math.min(...values),
      mean: values.reduce((s, v) => s + v, 0) / values.length,
    };
  });

  const pairs: TraditionComparison["pairs"] = [];
  for (let i = 0; i < traditions.length; i++)
    for (let j = i + 1; j < traditions.length; j++) {
      const rms = Math.sqrt(rows.reduce((s, r) => s + (r.values[i] - r.values[j]) ** 2, 0) / rows.length);
      pairs.push({ a: traditions[i].id, b: traditions[j].id, points: pointsApart(rms) });
    }

  const shared = rows
    .filter(
      (r) =>
        r.spread < SHARED_SPREAD &&
        r.values.every((v) => Math.abs(v) >= BALANCED && Math.sign(v) === Math.sign(r.mean)),
    )
    .sort((a, b) => Math.abs(b.mean) - Math.abs(a.mean) || a.spread - b.spread)
    .slice(0, 3);

  const splits = rows
    .filter((r) => r.spread >= SHARED_SPREAD)
    .sort((a, b) => b.spread - a.spread)
    .slice(0, 3);

  // With two traditions every split is mutual, so "distinctive" only means
  // something with three: the axis where one stands furthest from the others.
  const distinctive: Distinctive[] =
    traditions.length < 3
      ? []
      : traditions.map((t, i) => {
          let best: Distinctive | null = null;
          let bestDev = -1;
          for (const r of rows) {
            const others = r.values.filter((_, j) => j !== i);
            const othersMean = others.reduce((s, v) => s + v, 0) / others.length;
            // Only count it when the others roughly agree with each other.
            const othersSpread = Math.max(...others) - Math.min(...others);
            const dev = Math.abs(r.values[i] - othersMean) - othersSpread / 2;
            if (dev > bestDev) {
              bestDev = dev;
              best = { id: t.id, axis: r.axis, value: r.values[i], othersMean };
            }
          }
          return best!;
        });

  return { rows, pairs, shared, splits, distinctive };
}
