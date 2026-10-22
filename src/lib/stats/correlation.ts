// Correlation helpers shared by the quiz analytics and IssueView.

// Pearson r, or null with fewer than 3 pairs or a constant column (r is
// undefined there, not zero).
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  let mx = 0;
  let my = 0;
  for (let k = 0; k < n; k++) {
    mx += xs[k];
    my += ys[k];
  }
  mx /= n;
  my /= n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let k = 0; k < n; k++) {
    const dx = xs[k] - mx;
    const dy = ys[k] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)));
}

// 1-based ranks, ties sharing their average rank.
export function ranks(values: number[]): number[] {
  const order = values.map((v, k) => [v, k] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(values.length);
  for (let start = 0; start < order.length;) {
    let end = start;
    while (end + 1 < order.length && order[end + 1][0] === order[start][0]) end++;
    const avg = (start + end) / 2 + 1;
    for (let k = start; k <= end; k++) out[order[k][1]] = avg;
    start = end + 1;
  }
  return out;
}

// Spearman rho: Pearson r of the ranks, so it measures any monotonic link and
// one extreme place can't dominate it.
export function spearman(xs: number[], ys: number[]): number | null {
  return pearson(ranks(xs), ranks(ys));
}
