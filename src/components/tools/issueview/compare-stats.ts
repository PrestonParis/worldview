// Pure statistics behind the IssueView comparison: paired values, Pearson and
// Spearman correlation, and an ordinary least-squares fit with residuals.

import { pearson, spearman } from "@/lib/stats/correlation";

export interface CompareRow {
  geoid: string;
  values: (number | null)[];
}

export interface Pair {
  geoid: string;
  x: number;
  y: number;
}

// Places with a finite value on both columns.
export function pairs(rows: CompareRow[], i: number, j: number): Pair[] {
  const out: Pair[] = [];
  for (const row of rows) {
    const x = row.values[i];
    const y = row.values[j];
    if (x === null || x === undefined || y === null || y === undefined) continue;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({ geoid: row.geoid, x, y });
  }
  return out;
}

export interface LinearFit {
  slope: number;
  intercept: number;
  predict: (x: number) => number;
}

export function linearFit(xs: number[], ys: number[]): LinearFit | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = xs.reduce((t, v) => t + v, 0) / n;
  const my = ys.reduce((t, v) => t + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let k = 0; k < n; k++) {
    sxy += (xs[k] - mx) * (ys[k] - my);
    sxx += (xs[k] - mx) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  return { slope, intercept, predict: (x) => intercept + slope * x };
}

export interface PairStats {
  n: number;
  r: number | null;
  rho: number | null;
  fit: LinearFit | null;
  // Actual minus predicted y, by geoid.
  residuals: Map<string, number>;
}

export function pairStats(rows: CompareRow[], i: number, j: number): PairStats {
  const ps = pairs(rows, i, j);
  const xs = ps.map((p) => p.x);
  const ys = ps.map((p) => p.y);
  const fit = linearFit(xs, ys);
  const residuals = new Map<string, number>();
  if (fit) for (const p of ps) residuals.set(p.geoid, p.y - fit.predict(p.x));
  return { n: ps.length, r: pearson(xs, ys), rho: spearman(xs, ys), fit, residuals };
}

export interface MatrixCell {
  r: number | null;
  n: number;
}

// Pairwise Pearson r for every column pair; the diagonal is r = 1.
export function correlationMatrix(rows: CompareRow[], columns: number): MatrixCell[][] {
  const out: MatrixCell[][] = Array.from({ length: columns }, () => new Array<MatrixCell>(columns));
  for (let i = 0; i < columns; i++) {
    for (let j = i; j < columns; j++) {
      const ps = pairs(rows, i, j);
      const cell =
        i === j
          ? { r: ps.length ? 1 : null, n: ps.length }
          : { r: pearson(ps.map((p) => p.x), ps.map((p) => p.y)), n: ps.length };
      out[i][j] = cell;
      out[j][i] = cell;
    }
  }
  return out;
}

// Plain-language strength of |r|.
export function strength(r: number): string {
  const a = Math.abs(r);
  if (a >= 0.7) return "strong";
  if (a >= 0.4) return "moderate";
  if (a >= 0.2) return "weak";
  return "little or no";
}
