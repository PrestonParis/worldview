import { describe, expect, it } from "vitest";
import { CELL, FAMILY_ORDER, SPACING, familyCentre, familyLayout } from "./family-layout";
import { ideologies } from "./ideologies";

describe("family layout", () => {
  const spots = familyLayout(null);

  it("places every tradition inside the plot", () => {
    expect(Object.keys(spots).sort()).toEqual(ideologies.map((i) => i.id).sort());
    for (const [id, s] of Object.entries(spots)) {
      for (const v of [s.x, s.y]) {
        expect(v, id).toBeGreaterThanOrEqual(0);
        expect(v, id).toBeLessThanOrEqual(100);
      }
    }
  });

  it("covers every family in the grid", () => {
    expect([...new Set(ideologies.map((i) => i.family))].sort()).toEqual([...FAMILY_ORDER].sort());
  });

  it("keeps each tradition inside its own family's cell", () => {
    for (const i of ideologies) {
      const n = FAMILY_ORDER.indexOf(i.family);
      const s = spots[i.id];
      expect(Math.floor(s.x / CELL), i.id).toBe(n % 3);
      expect(Math.floor(s.y / CELL), i.id).toBe(Math.floor(n / 3));
    }
  });

  // Every dot stays separately visible and clickable.
  it("never stacks two traditions", () => {
    const list = Object.entries(spots);
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        const d = Math.hypot(list[a][1].x - list[b][1].x, list[a][1].y - list[b][1].y);
        expect(d, `${list[a][0]} / ${list[b][0]}`).toBeGreaterThanOrEqual(SPACING * 1.4);
      }
    }
  });

  it("lays out the same way every time", () => {
    expect(familyLayout(null)).toEqual(spots);
  });

  it("moves the best fit in each family to its cluster's centre", () => {
    const order = [...ideologies].reverse().map((i) => i.id);
    const ranked = familyLayout(order);
    for (const family of FAMILY_ORDER) {
      const members = ideologies.filter((i) => i.family === family);
      const best = members.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))[0];
      const c = familyCentre(family);
      const dist = (id: string) => Math.hypot(ranked[id].x - c.x, ranked[id].y - c.y);
      for (const m of members) expect(dist(best.id), family).toBeLessThanOrEqual(dist(m.id));
    }
  });
});
