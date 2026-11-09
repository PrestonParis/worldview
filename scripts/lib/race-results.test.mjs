import { describe, expect, it } from "vitest";
import {
  assertFeedComplete,
  decideCall,
  decideFlip,
  matchNominee,
  onePartyLeft,
  parseNytRace,
  raceKeyFromNytId,
} from "./race-results.mjs";
import { parseCandidates } from "./wiki-races.mjs";

const feedRace = (overrides = {}) => ({
  nyt_id: "GA-G-S-2026-11-03",
  type: "General",
  race_call_status: "called",
  tabulation_method: "single-round",
  uncontested: false,
  certified: false,
  outcome: { won: ["ossoff-j"], advanced_to_runoff: [], called_by: ["ap"], gained: false },
  candidate_metadata: {
    "ossoff-j": { first_name: "Jon", last_name: "Ossoff", incumbent: true, party: { nyt_id: "DEM", name: "Democrat" } },
    "collins-m": { first_name: "Mike", last_name: "Collins", incumbent: false, party: { nyt_id: "GOP", name: "Republican" } },
    total_writeins: { first_name: null, last_name: "Total Write-ins", party: { nyt_id: "OTH" } },
  },
  reporting_units: [
    {
      level: "state",
      eevp: 99,
      total_votes: 1000,
      provider_updated_at: "2026-11-04T21:46:20Z",
      candidates: [
        { nyt_id: "ossoff-j", votes: { total: 600 } },
        { nyt_id: "collins-m", votes: { total: 400 } },
        { nyt_id: "total_writeins", votes: { total: 0 } },
      ],
    },
  ],
  ...overrides,
});

describe("raceKeyFromNytId", () => {
  it("maps statewide races, specials and districts to the scaffold's keys", () => {
    expect(raceKeyFromNytId("GA-G-S-2026-11-03", "General")).toEqual({ prefix: "senate", key: "GA" });
    expect(raceKeyFromNytId("AL-G-G-2026-11-03", "General")).toEqual({ prefix: "governor", key: "AL" });
    expect(raceKeyFromNytId("FL-S_W-S-2026-11-03", "Special General")).toEqual({ prefix: "senate", key: "FL:special" });
    expect(raceKeyFromNytId("AL-G-H-1-2026-11-03", "General")).toEqual({ prefix: "house", key: "AL-01" });
    expect(raceKeyFromNytId("LA-L-H-5-2026-11-03", "Nonpartisan Election")).toEqual({ prefix: "house", key: "LA-05" });
  });

  it("uses -AL for one-seat states", () => {
    expect(raceKeyFromNytId("DE-G-H-1-2026-11-03", "General")?.key).toBe("DE-AL");
    expect(raceKeyFromNytId("AK-G-H-1-2026-11-03", "General")?.key).toBe("AK-AL");
  });

  it("skips the national House row", () => {
    expect(raceKeyFromNytId("US-G-H-2026-11-03", "General")).toBeNull();
  });
});

describe("parseNytRace", () => {
  it("reads the call, the count and the candidates", () => {
    const race = parseNytRace(feedRace());
    expect(race).toMatchObject({ key: "GA", callStatus: "called", winnerId: "ossoff-j", reportingPct: 99, totalVotes: 1000, gained: false });
    expect(race.candidates[0]).toMatchObject({ name: "Jon Ossoff", party: "DEM", votes: 600, incumbent: true, writeIn: false });
    expect(race.candidates[2].writeIn).toBe(true);
  });

  it("reads uncalled and runoff races with no winner", () => {
    const counting = parseNytRace(feedRace({ race_call_status: "too_early", outcome: { won: [], advanced_to_runoff: [], called_by: [], gained: null } }));
    expect(counting).toMatchObject({ callStatus: "counting", winnerId: null, gained: null });
    const runoff = parseNytRace(feedRace({ race_call_status: "runoff", outcome: { won: [], advanced_to_runoff: ["ossoff-j", "collins-m"], called_by: ["ap"], gained: null } }));
    expect(runoff).toMatchObject({ callStatus: "runoff", winnerId: null, runoffIds: ["ossoff-j", "collins-m"] });
  });

  it("flags ranked-choice counting", () => {
    expect(parseNytRace(feedRace({ tabulation_method: "ranked-choice" })).rankedChoice).toBe(true);
  });
});

describe("decideCall", () => {
  const race = parseNytRace(feedRace());
  const counting = parseNytRace(feedRace({ race_call_status: "too_early", outcome: { won: [] } }));

  it("calls when the feed calls and Wikipedia agrees", () => {
    expect(decideCall(race, "Jon Ossoff")).toEqual({ callStatus: "called", winnerId: "ossoff-j", issue: null });
  });

  it("blocks the call when Wikipedia names someone else", () => {
    expect(decideCall(race, "Mike Collins")).toEqual({ callStatus: "counting", winnerId: null, issue: "conflict" });
  });

  it("does not show a Wikipedia-only call", () => {
    expect(decideCall(counting, "Jon Ossoff")).toEqual({ callStatus: "counting", winnerId: null, issue: "wiki-only" });
  });

  it("calls from the feed alone when Wikipedia has not marked it yet", () => {
    expect(decideCall(race, null)).toEqual({ callStatus: "called", winnerId: "ossoff-j", issue: "feed-only" });
  });
});

describe("assertFeedComplete", () => {
  it("refuses a truncated feed", () => {
    expect(() => assertFeedComplete("house", 200, 435)).toThrow(/nothing written/);
    expect(() => assertFeedComplete("house", 435, 435)).not.toThrow();
  });
});

describe("matchNominee", () => {
  const row = (name, party, incumbent = false) => ({ name, party, incumbent });

  it("matches on surname despite a nickname", () => {
    const rows = [row("Michael Collins", "Republican"), row("Jon Ossoff", "Democratic")];
    expect(matchNominee({ name: "Mike Collins", last: "Collins", party: "GOP" }, rows)).toBe(rows[0]);
  });

  it("uses the incumbent flag to separate namesakes", () => {
    const rows = [row("Dan J. Sullivan", "Republican"), row("Dan Sullivan", "Republican", true)];
    expect(matchNominee({ name: "Dan Sullivan", last: "Sullivan", party: "GOP", incumbent: true }, rows)).toBe(rows[1]);
  });

  it("accepts a one-letter surname difference only with the same first name and party", () => {
    const rows = [row("Maria Rodriquez", "Republican")];
    expect(matchNominee({ name: "Maria Rodriguez", last: "Rodriguez", party: "GOP" }, rows)).toBe(rows[0]);
    expect(matchNominee({ name: "Ana Rodriguez", last: "Rodriguez", party: "GOP" }, rows)).toBeNull();
    expect(matchNominee({ name: "Maria Rodriguez", last: "Rodriguez", party: "DEM" }, rows)).toBeNull();
  });

  it("treats one person imported twice as one match", () => {
    const rows = [row("Gabe Firment", "Republican"), row("Gabe Firment", "Republican")];
    expect(matchNominee({ name: "Gabe Firment", last: "Firment", party: "GOP" }, rows)).toBe(rows[0]);
  });

  it("returns null rather than guess", () => {
    const rows = [row("Ann Smith", "Democratic"), row("Bob Smith", "Democratic")];
    expect(matchNominee({ name: "Cal Smith", last: "Smith", party: "DEM" }, rows)).toBeNull();
    expect(matchNominee({ name: "Rebecca Bextel", last: "Bextel", party: "CST" }, rows)).toBeNull();
  });
});

describe("decideFlip", () => {
  it("prefers the feed, falls back to Wikipedia, and waits for a call", () => {
    expect(decideFlip("called", true, "Incumbent re-elected.")).toBe(true);
    expect(decideFlip("called", null, "Incumbent lost re-election. Democratic gain.")).toBe(true);
    expect(decideFlip("called", null, "Incumbent re-elected.")).toBe(false);
    expect(decideFlip("called", null, "")).toBeNull();
    expect(decideFlip("counting", true, "")).toBeNull();
  });
});

describe("onePartyLeft", () => {
  it("names the party when every candidate shares one", () => {
    const candidates = [{ party: "DEM", votes: 5 }, { party: "DEM", votes: 4 }, { party: "GOP", votes: 0, writeIn: true }];
    expect(onePartyLeft({ candidates })).toBe("DEM");
    expect(onePartyLeft({ candidates: [{ party: "DEM", votes: 5 }, { party: "GOP", votes: 4 }] })).toBeNull();
  });
});

describe("wiki winners", () => {
  it("marks {{aye}} candidates", () => {
    const raw = `*{{Party stripe|Democratic Party (US)}}{{aye}} '''[[Chris Coons]]''' (Democratic)\n*{{Party stripe|Republican Party (US)}}Michael Katz (Republican)`;
    expect(parseCandidates(raw).map((candidate) => [candidate.name, candidate.won ?? false])).toEqual([["Chris Coons", true], ["Michael Katz", false]]);
  });
});
