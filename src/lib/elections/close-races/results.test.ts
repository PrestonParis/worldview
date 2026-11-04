import { describe, expect, it } from "vitest";
import { contestOutcome, outcomeChange, type OutcomeInput } from "./outcome";
import { breakdownMismatches, parseBreakdown, stateCountyMismatches, votedIn, watchesPrecincts } from "./precincts";
import { pairRunoffs, settledSeats, summarizeResults } from "./results";
import { SEAT_HOLDERS_FROM, withSeats, type ReportRow } from "./rows";
import { chamberSummaries, seatChange, seatKey } from "./seats";

const base: OutcomeInput = {
  resultStatus: "election_night_complete",
  decisionRule: "majority",
  voteFor: 1,
  totalVotes: 100,
  marginVotes: 10,
  leaderShare: 0.55,
  uncontested: false,
  flags: [],
  leaderName: "A",
  runnerUpName: "B",
  runnerUpVotes: 45,
  thirdVotes: null,
};

const kind = (over: Partial<OutcomeInput>) => contestOutcome({ ...base, ...over }).kind;

describe("outcome", () => {
  it("names no winner while a contest counts", () => {
    expect(kind({ resultStatus: "reporting" })).toBe("counting");
    expect(kind({ resultStatus: "no_results", totalVotes: 0 })).toBe("counting");
  });

  it("calls a winner apparent until certified", () => {
    expect(contestOutcome(base).label).toBe("Apparent winner");
    expect(contestOutcome({ ...base, resultStatus: "state_certified" }).label).toBe("Winner");
  });

  it("keeps a recount-range race elected", () => {
    expect(kind({ flags: ["recount_request_range"] })).toBe("elected");
  });

  it("names both runoff candidates, unless second place is tied", () => {
    const runoff = { ...base, flags: ["runoff_required"], leaderShare: 0.45, thirdVotes: 10 };
    expect(contestOutcome(runoff)).toMatchObject({ kind: "advancing_to_runoff", advancing: ["A", "B"], secondSlotTied: false });
    expect(contestOutcome({ ...runoff, thirdVotes: 45 })).toMatchObject({ kind: "advancing_to_runoff", advancing: ["A"], secondSlotTied: true });
  });

  it("calls an exact tie a tie", () => {
    expect(kind({ marginVotes: 0 })).toBe("tied");
    expect(kind({ marginVotes: 0, flags: ["runoff_required"], runnerUpVotes: 40, thirdVotes: 40 })).toBe("tied");
    // Tied for first with a third candidate behind: both advance.
    expect(kind({ marginVotes: 0, flags: ["runoff_required"], runnerUpVotes: 45, thirdVotes: 10 })).toBe("advancing_to_runoff");
  });

  it("reads ballot questions by the leading choice", () => {
    const q = { ...base, decisionRule: "referendum" as const };
    expect(contestOutcome({ ...q, leaderName: "Yes" })).toMatchObject({ kind: "passed", label: "Passing" });
    expect(contestOutcome({ ...q, leaderName: "No", resultStatus: "state_certified" })).toMatchObject({ kind: "failed", label: "Failed" });
    expect(kind({ ...q, marginVotes: 0 })).toBe("tied");
  });

  it("holds a below-50 municipal winner until its rule is sourced, not an above-50 one", () => {
    const city = { ...base, decisionRule: "unknown" as const };
    expect(kind({ ...city, leaderShare: 0.41 })).toBe("rule_unverified");
    expect(kind({ ...city, leaderShare: 0.51 })).toBe("elected");
  });

  it("recognises unopposed and empty contests", () => {
    expect(kind({ uncontested: true, marginVotes: null, runnerUpName: null })).toBe("unopposed");
    expect(kind({ flags: ["no_votes_reported"], totalVotes: 0, marginVotes: 0 })).toBe("no_votes");
  });
});

describe("outcome changes", () => {
  const was = (kind: Parameters<typeof outcomeChange>[0]["kind"], inRecountRange = false) => ({ kind, inRecountRange });
  it("reports a settled contest crossing a line", () => {
    expect(outcomeChange(was("elected"), was("advancing_to_runoff"))).toBe("winner → runoff");
    expect(outcomeChange(was("passed"), was("failed"))).toBe("passing → failing");
    expect(outcomeChange(was("elected"), was("elected", true))).toBe("entered recount-request range");
    expect(outcomeChange(was("elected", true), was("elected"))).toBe("left recount-request range");
  });
  it("stays quiet about first results and no change", () => {
    expect(outcomeChange(was("counting"), was("elected"))).toBeNull();
    expect(outcomeChange(was("elected"), was("elected"))).toBeNull();
  });
});

describe("precincts", () => {
  const raw = {
    summaryResults: { ballotOptions: [{ name: [{ text: "Soo Hong (I) (Rep)" }], voteCount: 30 }, { name: [{ text: "Chris Luchey (Dem)" }], voteCount: 40 }] },
    breakdownResults: [
      { precinct: { name: [{ text: "Duluth G" }] }, voteTotal: 30, ballotOptions: [{ name: [{ text: "Soo Hong (I) (Rep)" }], voteCount: 10 }, { name: [{ text: "Chris Luchey (Dem)" }], voteCount: 20 }] },
      { precinct: { name: [{ text: "Berkeley A" }] }, voteTotal: 40, ballotOptions: [{ name: [{ text: "Soo Hong (I) (Rep)" }], voteCount: 20 }, { name: [{ text: "Chris Luchey (Dem)" }], voteCount: 20 }] },
    ],
  };
  it("reads rows under clean candidate names and checks they add up", () => {
    const rows = parseBreakdown(raw);
    expect(rows[0]).toEqual({ precinct: "Duluth G", totalVotes: 30, votes: { "Soo Hong": 10, "Chris Luchey": 20 } });
    expect(breakdownMismatches(raw, rows)).toEqual([]);
    rows[0].votes["Soo Hong"] = 9;
    expect(breakdownMismatches(raw, rows)).toEqual(["Soo Hong: contest 30, precincts 29"]);
    expect(breakdownMismatches({}, [])).toEqual([]);
  });
  it("places a contest only when few precincts voted on it", () => {
    expect(votedIn([{ precinct: "Byromville", totalVotes: 20 }, { precinct: "Vienna", totalVotes: 0 }])).toEqual(["Byromville"]);
    expect(votedIn([1, 2, 3, 4].map((n) => ({ precinct: `P${n}`, totalVotes: 5 })))).toEqual([]);
    expect(votedIn([{ precinct: "Georgetown", totalVotes: 0 }])).toEqual([]);
  });
  it("watches close and unplaced contests, not comfortable named ones", () => {
    const base = { flags: [], level: "county", scope: "county", municipality: null, rule: "majority", marginPct: 20 };
    expect(watchesPrecincts({ ...base, level: "referendum", scope: "state" })).toBe(false);
    expect(watchesPrecincts({ ...base, level: "referendum" })).toBe(true);
    expect(watchesPrecincts(base)).toBe(false);
    expect(watchesPrecincts({ ...base, marginPct: 0.8 })).toBe(true);
    expect(watchesPrecincts({ ...base, flags: ["runoff_required"] })).toBe(true);
    expect(watchesPrecincts({ ...base, level: "municipal" })).toBe(true);
    expect(watchesPrecincts({ ...base, level: "municipal", municipality: "Ashburn", rule: "majority" })).toBe(false);
  });
  it("flags state totals that don't equal a complete set of counties", () => {
    const c = { name: "US Senate", scope: "state", totalUnits: 2, options: [{ name: "A", votes: 10 }], areas: [{ options: [{ name: "A", votes: 4 }] }, { options: [{ name: "A", votes: 6 }] }] };
    expect(stateCountyMismatches([c])).toEqual([]);
    expect(stateCountyMismatches([{ ...c, options: [{ name: "A", votes: 11 }] }])).toEqual(["US Senate — A: state 11, counties 10"]);
    // Counties still missing: nothing to compare yet.
    expect(stateCountyMismatches([{ ...c, totalUnits: 3, options: [{ name: "A", votes: 99 }] }])).toEqual([]);
  });
});

describe("seats", () => {
  it("keys seats by office and district, however the feed words it", () => {
    expect(seatKey("State House of Representatives - District 103")).toBe("ga_house:103");
    expect(seatKey("State Senate - District 7")).toBe("ga_senate:7");
    expect(seatKey("Special State Senate - District 21")).toBe("ga_senate:21");
    expect(seatKey("US House of Representatives - District 14")).toBe("us_house:14");
    expect(seatKey("PSC - District 3")).toBe("statewide:psc-3");
    expect(seatKey("Lieutenant Governor")).toBe("statewide:lieutenant-governor");
    expect(seatKey("US Senate")).toBe("statewide:us-senate");
    expect(seatKey("County Commission - District 2")).toBeNull();
  });

  it("marks a seat changed only when both parties are known", () => {
    const holder = { party: "R", name: "X", source: "s" };
    expect(seatChange("D", holder).change).toBe("gained");
    expect(seatChange("R", holder).change).toBe("held");
    expect(seatChange("D", undefined).change).toBe("unknown");
    expect(seatChange(null, holder).change).toBeNull();
  });
});

const row = (name: string, over: Partial<ReportRow> = {}): ReportRow =>
  ({
    id: name,
    name,
    key: name,
    sourceElectionId: "e",
    electionDate: SEAT_HOLDERS_FROM,
    scope: "state",
    level: "legislative",
    county: null,
    counties: [],
    primaryParty: null,
    voteFor: 1,
    leaderName: "A",
    leaderParty: "D",
    leaderIncumbent: false,
    leaderVotes: 60,
    runnerUpName: "B",
    runnerUpParty: "R",
    runnerUpIncumbent: false,
    runnerUpVotes: 40,
    thirdVotes: null,
    totalVotes: 100,
    marginVotes: 20,
    marginPct: 20,
    leaderShare: 0.6,
    decisionRule: "majority",
    resultStatus: "election_night_complete",
    flags: [],
    uncontested: false,
    trailingIncumbent: null,
    seat: null,
    outcome: { kind: "elected", label: "Apparent winner", advancing: [], secondSlotTied: false },
    ...over,
  }) as ReportRow;

const H = (d: number) => `State House of Representatives - District ${d}`;
const runoffOutcome = { kind: "advancing_to_runoff" as const, label: "Runoff", advancing: ["A", "B"], secondSlotTied: false };

describe("chamber totals", () => {
  it("leaves a runoff out of both columns and nets flips against prior holders", () => {
    const holders = { "ga_house:1": { party: "R", name: "x", source: "s" }, "ga_house:2": { party: "D", name: "y", source: "s" }, "ga_house:3": { party: "R", name: "z", source: "s" } };
    const rows = [
      row(H(1)),
      row(H(2), { flags: ["recount_request_range"] }),
      row(H(3), { leaderParty: "R", flags: ["runoff_required"], leaderShare: 0.45 }),
    ];
    const house = chamberSummaries(rows, holders)[0];
    expect(house.parties).toEqual([{ party: "D", seats: 2, recountRange: 1, net: 1 }]);
    expect(house.undecided).toBe(1);
    expect(house.runoffs).toBe(1);
    expect(house.missing).toBe(177);
  });

  it("withholds net change when a decided seat has no known holder", () => {
    const house = chamberSummaries([row(H(1))], {})[0];
    expect(house.parties[0].net).toBeNull();
  });

  it("credits a seat settled in a later round", () => {
    const holders = { "ga_house:3": { party: "R", name: "z", source: "s" } };
    const general = row(H(3), { flags: ["runoff_required"], leaderShare: 0.45 });
    const house = chamberSummaries([general], holders, new Map([["ga_house:3", "D"]]))[0];
    expect(house.parties).toEqual([{ party: "D", seats: 1, recountRange: 0, net: 1 }]);
    expect(house.undecided).toBe(0);
  });
});

describe("withSeats", () => {
  const holders = { "ga_house:1": { party: "R", name: "x", source: "s" } };
  it("records a flip for a decided seat", () => {
    expect(withSeats([row(H(1))], holders)[0].seat).toEqual({ key: "ga_house:1", priorParty: "R", priorName: "x", change: "gained" });
  });
  it("skips primaries and earlier elections, which fill no seat in the file", () => {
    expect(withSeats([row(H(1), { primaryParty: "R" })], holders)[0].seat).toBeNull();
    expect(withSeats([row(H(1), { electionDate: "2026-05-19" })], holders)[0].seat).toBeNull();
  });
});

describe("runoff pairing", () => {
  const general = row(H(151), { leaderName: "Mike Cheokas", runnerUpName: "Ethan Wolfe", outcome: runoffOutcome, seat: { key: "ga_house:151", priorParty: "R", priorName: "x", change: null } });

  it("matches the two candidates in either order, whatever the contest is called", () => {
    const runoff = row("House Dist 151 Runoff", { leaderName: "Ethan Wolfe", runnerUpName: "Mike Cheokas", leaderParty: "D" });
    const pairs = pairRunoffs([general], [runoff]);
    expect(pairs.get(general.id)?.id).toBe(runoff.id);
    expect(settledSeats([general], pairs).get("ga_house:151")).toBe("D");
  });

  it("doesn't pair other candidates, or another county's race", () => {
    expect(pairRunoffs([general], [row("x", { leaderName: "Mike Cheokas", runnerUpName: "Someone" })]).size).toBe(0);
    expect(pairRunoffs([general], [row("x", { leaderName: "Mike Cheokas", runnerUpName: "Ethan Wolfe", county: "Bibb County" })]).size).toBe(0);
  });

  it("leaves a seat unsettled while its runoff is still counting", () => {
    const counting = row("r", { leaderName: "Ethan Wolfe", runnerUpName: "Mike Cheokas", outcome: { kind: "counting", label: "Counting", advancing: [], secondSlotTied: false } });
    expect(settledSeats([general], pairRunoffs([general], [counting])).size).toBe(0);
  });
});

describe("summary", () => {
  it("sorts contests into what's open and what changed", () => {
    const rows = withSeats(
      [
        row(H(1)),
        row(H(2), { flags: ["recount_request_range"], marginVotes: 27, trailingIncumbent: { name: "Inc", party: "R" } }),
        row(H(3), { outcome: runoffOutcome, flags: ["runoff_required"] }),
      ],
      { "ga_house:1": { party: "D", name: "x", source: "s" }, "ga_house:2": { party: "R", name: "y", source: "s" }, "ga_house:3": { party: "R", name: "z", source: "s" } },
    );
    const s = summarizeResults(rows, { kind: "general", holders: {} });
    expect(s.runoffs.map((r) => r.row.name)).toEqual([H(3)]);
    expect(s.recountRange.map((r) => r.name)).toEqual([H(2)]);
    expect(s.flips.map((r) => r.name)).toEqual([H(2)]);
    expect(s.defeatedIncumbents.map((r) => r.name)).toEqual([H(2)]);
    expect(s.levels).toEqual([{ level: "legislative", contests: 3, decided: 2, uncontested: 0, open: 1 }]);
    // Too few seats to be a chamber's election: a special for one district.
    expect(s.chambers).toEqual([]);
  });
});
