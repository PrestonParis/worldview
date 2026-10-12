// One-dimensional beeswarm: every point keeps its x, and gets the y offset
// nearest the axis that doesn't overlap a circle already placed. Points are
// placed left to right, so only the circles within one diameter behind the
// current x can collide.

export function beeswarm(xs: number[], radius: number, padding = 1): number[] {
  const diameter = 2 * radius + padding;
  const order = xs.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x);
  const placed: { x: number; y: number }[] = [];
  const ys = new Array<number>(xs.length).fill(0);

  for (const { x, i } of order) {
    const near: { x: number; y: number }[] = [];
    for (let k = placed.length - 1; k >= 0 && x - placed[k].x < diameter; k--) near.push(placed[k]);

    const candidates = [0];
    for (const p of near) {
      const dy = Math.sqrt(diameter ** 2 - (x - p.x) ** 2);
      candidates.push(p.y + dy, p.y - dy);
    }
    candidates.sort((a, b) => Math.abs(a) - Math.abs(b));

    const fits = (y: number) => near.every((p) => (x - p.x) ** 2 + (y - p.y) ** 2 >= diameter ** 2 - 1e-6);
    const y = candidates.find(fits) ?? 0;
    ys[i] = y;
    placed.push({ x, y });
  }
  return ys;
}
