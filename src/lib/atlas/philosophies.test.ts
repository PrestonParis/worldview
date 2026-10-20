import { describe, expect, it } from "vitest";
import { PROFILE_QUESTIONS, philosophyById, philosophyProfiles } from "./philosophies";
import { axisIds, lensIds } from "../quiz/types";
import { allTraditions } from "../quiz/ideologies";

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
      expect(history.figures.length, ideology.id).toBeGreaterThanOrEqual(2);
      expect(history.texts.length, ideology.id).toBeGreaterThanOrEqual(1);
      expect(history.timeline.length, ideology.id).toBeGreaterThanOrEqual(4);
      expect(history.timeline.length, ideology.id).toBeLessThanOrEqual(6);
      expect(history.practice.length, ideology.id).toBeGreaterThanOrEqual(1);
      for (const t of history.texts) if (t.href) expect(t.href, ideology.id).toMatch(/^https:\/\//);
    }
  });

  it("keeps each timeline in chronological order", () => {
    const start = (year: string) => Number(year.match(/\d{3,4}/)![0]);
    for (const { ideology, history } of philosophyProfiles) {
      const years = history.timeline.map((t) => start(t.year));
      expect(years, ideology.id).toEqual([...years].sort((a, b) => a - b));
    }
  });
});
