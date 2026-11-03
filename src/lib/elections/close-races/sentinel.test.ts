import { describe, expect, it } from "vitest";
import schedulePath from "../../../../data/elections/ga/schedule.json";
import { parseSchedule } from "./schedule";
import { digestEveryMinutes, digestMessage, digestStarted, morningDueMs, pollsCloseMs, pushesAtOnce, runIsStuck, sentinelActive } from "./sentinel";

const schedule = parseSchedule(schedulePath);

describe("what pushes at once", () => {
  it("holds local contest events for the digest", () => {
    expect(pushesAtOnce({ kind: "leader_change", level: "county" })).toBe(false);
    expect(pushesAtOnce({ kind: "tie", level: "school" })).toBe(false);
    expect(pushesAtOnce({ kind: "vote_decrease", level: "legislative", severity: "critical" })).toBe(false);
  });

  it("pushes federal and statewide contest events", () => {
    expect(pushesAtOnce({ kind: "leader_change", level: "federal" })).toBe(true);
    expect(pushesAtOnce({ kind: "tie", level: "statewide" })).toBe(true);
    expect(pushesAtOnce({ kind: "vote_decrease", level: "statewide", severity: "critical" })).toBe(true);
  });

  it("pushes system failures, and coverage only when it is broad", () => {
    expect(pushesAtOnce({ kind: "stale_state", severity: "critical" })).toBe(true);
    expect(pushesAtOnce({ kind: "heartbeat" })).toBe(true);
    expect(pushesAtOnce({ kind: "stale_county" })).toBe(false);
    expect(pushesAtOnce({ kind: "coverage", shortCount: 2 })).toBe(false);
    expect(pushesAtOnce({ kind: "coverage", shortCount: 16 })).toBe(true);
  });

  it("never pushes info alerts", () => {
    expect(pushesAtOnce({ kind: "merge", severity: "info" })).toBe(false);
  });
});

describe("stuck runs", () => {
  it("leaves a run that is still starting alone", () => {
    expect(runIsStuck({ heartbeatMinutes: null, runAgeMinutes: 5 })).toBe(false);
  });

  it("leaves a run with a recent heartbeat alone", () => {
    expect(runIsStuck({ heartbeatMinutes: 4, runAgeMinutes: 200 })).toBe(false);
    expect(runIsStuck({ heartbeatMinutes: 20, runAgeMinutes: 200 })).toBe(false);
  });

  it("flags a long-running worker whose heartbeat stopped or never began", () => {
    expect(runIsStuck({ heartbeatMinutes: 21, runAgeMinutes: 60 })).toBe(true);
    expect(runIsStuck({ heartbeatMinutes: null, runAgeMinutes: 15 })).toBe(true);
  });
});

describe("timing", () => {
  it("places polls close at 7 pm Eastern", () => {
    expect(new Date(pollsCloseMs("2026-11-03")).toISOString()).toBe("2026-11-04T00:00:00.000Z");
    expect(digestStarted("2026-11-03", new Date("2026-11-03T23:59:00Z"))).toBe(false);
    expect(digestStarted("2026-11-03", new Date("2026-11-04T00:00:00Z"))).toBe(true);
  });

  it("places the morning run at 7 am Eastern", () => {
    expect(new Date(morningDueMs("2026-11-03")).toISOString()).toBe("2026-11-04T12:00:00.000Z");
  });

  it("slows the digest overnight", () => {
    expect(digestEveryMinutes(new Date("2026-11-04T01:30:00Z"))).toBe(30);
    expect(digestEveryMinutes(new Date("2026-11-04T07:00:00Z"))).toBe(60);
    expect(digestEveryMinutes(new Date("2026-11-04T12:30:00Z"))).toBe(30);
  });

  it("keeps the sentinel on from the watch start to two days after the election", () => {
    expect(sentinelActive(schedule, new Date("2026-11-03T20:00:00Z"))).toBe(false);
    expect(sentinelActive(schedule, new Date("2026-11-03T21:00:00Z"))).toBe(true);
    expect(sentinelActive(schedule, new Date("2026-11-05T16:59:00Z"))).toBe(true);
    expect(sentinelActive(schedule, new Date("2026-11-05T17:00:00Z"))).toBe(false);
    expect(sentinelActive(schedule, new Date("2026-12-01T21:00:00Z"))).toBe(true);
  });
});

describe("digest text", () => {
  it("states progress, closest races, held alerts and unread cities", () => {
    const text = digestMessage({
      electionName: "Nov 3",
      contests: 1149,
      withVotes: 312,
      ranked: 180,
      countiesFetched: 159,
      heartbeatMinutes: 2.4,
      closest: [{ name: "County BOE - Post 2", county: "Hall County", marginVotes: 3, marginPct: 0.2 }],
      held: { leader_change: 41, tie: 0 },
      citiesWaiting: ["Norcross"],
      reportUrl: "https://example.com/r",
    });
    expect(text).toContain("312 of 1,149 contests have votes, 180 ranked");
    expect(text).toContain("Counties 159/159. Heartbeat 2 min ago");
    expect(text).toContain("3 votes: County BOE - Post 2 (Hall County)");
    expect(text).toContain("41 lead changes");
    expect(text).not.toContain("0 ties");
    expect(text).toContain("No results yet: Norcross");
  });
});
