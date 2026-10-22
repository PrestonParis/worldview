import { describe, expect, it } from "vitest";
import { PROFILE_QUESTIONS, philosophyById, philosophyProfiles } from "./philosophies";
import { axisIds, lensIds } from "../quiz/types";
import { allTraditions } from "../quiz/ideologies";
import { BOOKS } from "./history/books";

describe("Atlas philosophy catalog", () => {
  it("gives every quiz tradition and umbrella label one permanent profile", () => {
    expect(philosophyProfiles).toHaveLength(allTraditions.length);
    for (const ideology of allTraditions) expect(philosophyById.get(ideology.id)?.ideology).toBe(ideology);
  });

  it("describes every axis exactly once in the written profile", () => {
    const covered = PROFILE_QUESTIONS.flatMap((q) => q.axes);
    expect([...covered].sort()).toEqual([...axisIds].sort());
  });

  it("classifies and explains every profile", () => {
    for (const profile of philosophyProfiles) {
      expect(profile.scopes.length).toBeGreaterThan(0);
      expect(profile.questions).toHaveLength(PROFILE_QUESTIONS.length);
      expect(profile.lenses).toHaveLength(lensIds.length);
    }
  });

  it("gives every profile a full history", () => {
    for (const { ideology, history } of philosophyProfiles) {
      expect(history, ideology.id).toBeDefined();
      expect(history.origins.when.length, ideology.id).toBeGreaterThan(0);
      expect(history.origins.where.length, ideology.id).toBeGreaterThan(0);
      expect(history.origins.founders.length, ideology.id).toBeGreaterThan(0);
      expect(history.figures, ideology.id).toHaveLength(3);
      expect(new Set(history.figures).size, ideology.id).toBe(3);
      expect(history.comparisons.length, ideology.id).toBeGreaterThanOrEqual(3);
      expect(history.comparisons.length, ideology.id).toBeLessThanOrEqual(4);
      for (const c of history.comparisons) {
        expect(c.government.length, ideology.id).toBeGreaterThan(0);
        expect(c.about.length, `${ideology.id}: ${c.government}`).toBeGreaterThan(80);
        expect(c.years, `${ideology.id}: ${c.government}`).toMatch(/\d/);
        expect(["adopted", "analogue", "precursor"], `${ideology.id}: ${c.government}`).toContain(c.kind);
      }
      expect(new Set(history.comparisons.map((c) => c.government)).size, ideology.id).toBe(history.comparisons.length);
      expect(history.texts.length, ideology.id).toBeGreaterThanOrEqual(1);
      expect(history.timeline.length, ideology.id).toBeGreaterThanOrEqual(4);
      expect(history.timeline.length, ideology.id).toBeLessThanOrEqual(6);
      expect(history.practice.length, ideology.id).toBeGreaterThanOrEqual(1);
      for (const t of history.texts) if (t.href) expect(t.href, ideology.id).toMatch(/^https:\/\//);
      expect(history.books.length, ideology.id).toBeGreaterThanOrEqual(3);
      expect(history.books.length, ideology.id).toBeLessThanOrEqual(5);
      const titles = history.books.map((b) => b.title);
      expect(new Set(titles).size, ideology.id).toBe(titles.length);
      for (const b of history.books) {
        expect(history.texts.map((t) => t.title), ideology.id).not.toContain(b.title);
        expect(b.year, `${ideology.id}: ${b.title}`).toMatch(/^\d{4}$/);
        expect(["introduction", "history", "ideas"], `${ideology.id}: ${b.title}`).toContain(b.kind);
      }
    }
  });

  it("keys every book list to a real tradition", () => {
    for (const id of Object.keys(BOOKS)) expect(philosophyById.has(id), id).toBe(true);
  });

  it("lists the Groyper movement's figures without Casey or Woods", () => {
    expect(philosophyById.get("groyper")!.history.figures).toEqual(["Nick Fuentes", "E. Michael Jones", "Joel Webbon"]);
  });

  it("keeps each timeline in chronological order", () => {
    const start = (year: string) => Number(year.match(/\d{3,4}/)![0]);
    for (const { ideology, history } of philosophyProfiles) {
      const years = history.timeline.map((t) => start(t.year));
      expect(years, ideology.id).toEqual([...years].sort((a, b) => a - b));
    }
  });
});
