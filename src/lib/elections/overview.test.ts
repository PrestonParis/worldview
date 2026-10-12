import { describe, expect, it } from "vitest";
import { consensusRating, partyLetter, raceCode, resultStyle, RATING_STYLE, type RatingRow } from "./overview";
import type { Rating } from "../validation/raceRating";

describe("partyLetter", () => {
  it("reads fusion tickets as their major party", () => {
    expect(partyLetter("Working Families / Democrat")).toBe("D");
    expect(partyLetter("Constitution / Republican")).toBe("R");
  });

  it("matches whole party names, not first letters", () => {
    expect(partyLetter("Reform")).toBeNull();
    expect(partyLetter("Independence")).toBeNull();
    expect(partyLetter("Democratic-Farmer-Labor")).toBe("D");
    expect(partyLetter("REPUBLICAN PARTY")).toBe("R");
    expect(partyLetter("Independent")).toBe("I");
    expect(partyLetter("")).toBeNull();
  });
});

describe("raceCode", () => {
  it("keeps district codes and abbreviates states regardless of case", () => {
    expect(raceCode("MA-03")).toEqual({ code: "MA-03", stateAbbr: "MA" });
    expect(raceCode("ND-AL")).toEqual({ code: "ND-AL", stateAbbr: "ND" });
    expect(raceCode("District Of Columbia")).toEqual({ code: "DC", stateAbbr: "DC" });
    expect(raceCode("United States")).toEqual({ code: "US", stateAbbr: null });
  });
});

describe("resultStyle", () => {
  it("deepens with the margin", () => {
    expect(resultStyle("D", 2).fill).toBe(RATING_STYLE.lean_d.fill);
    expect(resultStyle("D", 10).fill).toBe(RATING_STYLE.likely_d.fill);
    expect(resultStyle("R", 30).fill).toBe(RATING_STYLE.safe_r.fill);
  });
});

describe("consensusRating", () => {
  const row = (source: string, rating: Rating, asOf = "2026-10-01"): RatingRow =>
    ({ source, rating, asOf });

  it("takes the median of the latest Cook, IE and Sabato calls", () => {
    const result = consensusRating([
      row("cook", "likely_d"),
      row("inside-elections", "lean_d"),
      row("sabato", "likely_d"),
      row("sabato", "tossup", "2026-08-01"), // older call is ignored
      row("starter-2026", "tossup"),
    ]);
    expect(result?.rating).toBe("likely_d");
    expect(result?.ratings.map((r) => r.source)).toEqual(["cook", "inside-elections", "sabato"]);
  });

  it("rounds an even split toward toss-up", () => {
    expect(consensusRating([row("cook", "lean_r"), row("sabato", "tossup")])?.rating).toBe("tossup");
    expect(consensusRating([row("cook", "likely_r"), row("sabato", "lean_r")])?.rating).toBe("lean_r");
  });

  it("falls back to other published, then inferred ratings", () => {
    expect(consensusRating([row("starter-2026", "lean_d"), row("inferred", "safe_r")])).toMatchObject({ rating: "lean_d", published: true });
    expect(consensusRating([row("inferred", "safe_r")])).toMatchObject({ rating: "safe_r", published: false });
    expect(consensusRating([])).toBeNull();
  });
});
