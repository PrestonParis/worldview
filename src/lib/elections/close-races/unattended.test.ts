import { describe, expect, it } from "vitest";
import schedulePath from "../../../../data/elections/ga/schedule.json";
import { cityContest, extractVotes, pageText, resultLinks, type CityConfig } from "./city";
import { coverageRecords, feedContests, newBaselineContests, type BaselineContest } from "./coverage";
import { evaluateContest } from "./evaluate";
import { electionKind, parseFeed, replacementElection } from "./parse";
import { activeElections, parseSchedule, scheduledOn } from "./schedule";

const schedule = parseSchedule(schedulePath);
const norcross = scheduledOn(schedule, "2026-11-03")!.cities[0] as CityConfig;
const contests = (...names: string[]): BaselineContest[] => names.map((n) => ({ key: n.toLowerCase(), name: n }));

describe("schedule", () => {
  it("covers the Nov 3 general and the Dec 1 runoff", () => {
    expect(scheduledOn(schedule, "2026-11-03")?.kind).toBe("general");
    expect(scheduledOn(schedule, "2026-12-01")).toMatchObject({ kind: "runoff", id: null });
  });

  it("is active from the watch start to stopAfter", () => {
    expect(activeElections(schedule, new Date("2026-11-03T20:00:00Z"))).toHaveLength(0);
    expect(activeElections(schedule, new Date("2026-11-03T20:20:00Z")).map((e) => e.date)).toEqual(["2026-11-03"]);
    expect(activeElections(schedule, new Date("2026-12-02T03:00:00Z")).map((e) => e.date)).toEqual(["2026-12-01"]);
    expect(activeElections(schedule, new Date("2026-12-21T17:00:00Z"))).toHaveLength(0);
  });

  it("reads SOS id abbreviations for runoffs", () => {
    expect(electionKind("2020DecStateRun")).toBe("runoff");
    expect(electionKind("2022DecGenRun")).toBe("runoff");
    expect(electionKind("December2nd2025Runoffs")).toBe("runoff");
    expect(electionKind("11032026GeneralAndSpecialElection")).toBe("general");
  });

  it("switches a placeholder to the runoff SOS lists, never to another kind", () => {
    const listed = [
      { id: "2026DecGenRun", date: "2026-12-01", name: "December 1, 2026 General Election Runoff", kind: "runoff" as const },
      { id: "2026DecRecount", date: "2026-12-01", name: "PSC Recount", kind: "recount" as const },
    ];
    expect(replacementElection(listed, { id: "scheduled-2026-12-01-runoff", date: "2026-12-01", kind: "runoff" })?.id).toBe("2026DecGenRun");
    expect(replacementElection(listed.slice(1), { id: "scheduled-2026-12-01-runoff", date: "2026-12-01", kind: "runoff" })).toBeNull();
  });
});

describe("coverage from the baseline", () => {
  it("adds new contests to the baseline and never drops one", () => {
    const base = contests("Governor", "Sheriff");
    expect(newBaselineContests(base, contests("Governor", "Sheriff", "Coroner"))).toEqual(contests("Coroner"));
    expect(newBaselineContests(base, contests("Governor"))).toEqual([]);
    expect(newBaselineContests(undefined, contests("Governor"))).toEqual(contests("Governor"));
  });

  it("marks a county partial when a baseline contest leaves its feed, missing when the feed is gone", () => {
    const baseline = new Map([
      ["a-county-ga", contests("Governor", "Sheriff")],
      ["b-county-ga", contests("Governor")],
      ["c-county-ga", contests("Governor")],
    ]);
    const rows = coverageRecords({
      electionId: "E",
      baseline,
      counties: [
        { slug: "a-county-ga", name: "A County", contests: contests("Governor") },
        { slug: "b-county-ga", name: "B County", contests: contests("Governor") },
        { slug: "c-county-ga", name: "C County", contests: null },
      ],
    });
    expect(rows.map((r) => [r.jurisdiction_name, r.status, r.observed_count, r.expected_count])).toEqual([
      ["A County", "partial", 1, 2],
      ["B County", "complete", 1, 1],
      ["C County", "missing", 0, 1],
    ]);
    expect(rows[0].notes).toContain("Sheriff");
  });

  it("counts one baseline entry per distinct contest name in a feed", () => {
    const feed = parseFeed({ election: { name: "x", electionDate: "2026-11-03" }, ballotItems: [{ id: "1", name: "Governor" }, { id: "2", name: "Governor" }, { id: "3", name: "Sheriff" }] });
    expect(feedContests(feed).map((c) => c.name)).toEqual(["Governor", "Sheriff"]);
  });

  it("lists city-run elections as municipalities", () => {
    const [row] = coverageRecords({
      electionId: "E",
      baseline: new Map(),
      counties: [],
      cities: [{ id: "norcross", name: "Norcross", resultsUrl: "https://example.test", source: null, expected: 1, tracked: 1, note: "no results posted yet" }],
    });
    expect(row).toMatchObject({ jurisdiction_id: "municipality:norcross", jurisdiction_type: "municipality", status: "complete" });
    expect(row.notes).toBe("runs its own election; no results posted yet");
  });
});

describe("city results", () => {
  const candidates = ["Jeffrey Allen", "Bucky Johnson"];
  const notice =
    "The following candidates qualified during the official qualifying period held September 14–16, 2026: Jeffrey Allen Bucky Johnson The election will be held Tuesday, November 3, 2026, to fill the remainder of the unexpired City Council term.";

  it("reads nothing from a candidate notice", () => {
    expect(extractVotes(notice, candidates)).toBeNull();
  });

  it("reads a results table posted next to the notice", () => {
    const html = `<p>${notice}</p><h2>Unofficial Results</h2><table><tr><td>Jeffrey Allen</td><td>1,204</td><td>51.3%</td></tr><tr><td>Bucky Johnson</td><td>1,143</td><td>48.7%</td></tr></table>`;
    const votes = extractVotes(pageText(html), candidates);
    expect(votes && Object.fromEntries(votes)).toEqual({ "Jeffrey Allen": 1204, "Bucky Johnson": 1143 });
  });

  it("reads last-name-first lines and skips percentages printed first", () => {
    const votes = extractVotes("Results: Allen, Jeffrey 52.1% 640 votes; Johnson, Bucky 47.9% 588 votes", candidates);
    expect(votes && Object.fromEntries(votes)).toEqual({ "Jeffrey Allen": 640, "Bucky Johnson": 588 });
  });

  it("needs every candidate", () => {
    expect(extractVotes("Jeffrey Allen 640", candidates)).toBeNull();
  });

  it("finds linked result documents", () => {
    const html = '<a href="/DocumentCenter/View/99/Election-Results">Election Results</a> <a href="/agenda.pdf">Agenda</a>';
    expect(resultLinks(html, "https://norcrossga.net/elections")).toEqual(["https://norcrossga.net/DocumentCenter/View/99/Election-Results"]);
  });

  it("evaluates a city contest as a municipal race with no results until votes arrive", () => {
    const contest = norcross.contests[0];
    const before = evaluateContest(cityContest(norcross, contest, null, null), { electionKind: "general" });
    expect(before).toMatchObject({ level: "municipal", municipality: "Norcross", status: "no_results", countySlug: "gwinnett-county-ga" });
    const after = evaluateContest(cityContest(norcross, contest, new Map([["Jeffrey Allen", 1204], ["Bucky Johnson", 1143]]), "2026-11-04T01:00:00Z"), { electionKind: "general" });
    expect(after.status).toBe("reporting");
    expect(after.margin).toMatchObject({ rankable: true, marginVotes: 61 });
  });
});
