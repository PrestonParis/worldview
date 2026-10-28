import { describe, expect, it } from "vitest";
import state2024 from "./fixtures/2024-state.json";
import fulton2024 from "./fixtures/2024-fulton.json";
import appling2024 from "./fixtures/2024-appling.json";
import primary2026 from "./fixtures/2026-primary.json";
import primaryRunoff2026 from "./fixtures/2026-primary-runoff.json";
import decRunoff2025 from "./fixtures/2025-dec-runoff.json";
import pscRecount from "./fixtures/2026-psc-recount.json";
import julSpecial from "./fixtures/2026-jul-special.json";
import muniFulton from "./fixtures/2025-muni-fulton.json";
import muniDekalb from "./fixtures/2025-muni-dekalb.json";
import muniClayton from "./fixtures/2025-muni-clayton.json";
import mediaExport2024 from "./fixtures/2024-media-export.json";
import { parseMediaExport } from "./media-export";
import { electionKind, englishName, parseCandidateName, parseFeed, replacementElection } from "./parse";
import { classifyContest, municipalityOf } from "./level";
import { decisionRule } from "./rules";
import { compareByPercent, compareByVotes, computeMargin, resultStatus } from "./margin";
import { assembleContests, type CountyFeed } from "./merge";
import { evaluateContest, type EvaluatedContest } from "./evaluate";
import { closeRacesCsv, CLOSE_RACE_COLUMNS } from "./csv";
import type { ElectionKind, ParsedOption } from "./types";

const county = (slug: string, name: string, raw: unknown): CountyFeed => ({ slug, name, feed: parseFeed(raw) });

function evaluateAll(stateRaw: unknown, counties: CountyFeed[] = [], kind?: ElectionKind): EvaluatedContest[] {
  const state = parseFeed(stateRaw);
  const { contests } = assembleContests(state, counties);
  return contests.map((c) => evaluateContest(c, { electionKind: kind ?? electionKind(state.election.name) }));
}

const byName = (list: EvaluatedContest[], name: string) => {
  const found = list.find((c) => c.name === name);
  if (!found) throw new Error(`no contest ${name}`);
  return found;
};

const opt = (name: string, votes: number, extra: Partial<ParsedOption> = {}): ParsedOption => ({
  sourceId: name,
  name,
  party: null,
  incumbent: false,
  isWriteIn: false,
  votes,
  votesByMethod: {},
  ...extra,
});

describe("parse", () => {
  it("splits incumbent and party markers off candidate names", () => {
    expect(parseCandidateName("Mack Jackson (I) (Dem)")).toEqual({ name: "Mack Jackson", incumbent: true, party: "D" });
    expect(parseCandidateName('Helmut "Love" Domagalski')).toEqual({ name: 'Helmut "Love" Domagalski', incumbent: false, party: null });
    expect(parseCandidateName("Patrick \"Pat\" Labat (I) (Dem)").name).toBe('Patrick "Pat" Labat');
  });

  it("keeps the English half of bilingual contest names", () => {
    const feed = parseFeed(decRunoff2025);
    expect(feed.contests[0].name).toBe("State House of Representatives - District 106");
    expect(englishName("Sales and Use Tax")).toBe("Sales and Use Tax");
    expect(englishName("Judge, State Court / Para Juez, Tribunal Estatal del Condado de Gwinnett (Colvin)")).toBe("Judge, State Court (Colvin)");
    expect(englishName("Judge - Superior Court - Gwinnett Judicial Circuit (Cason)/ Para Juez (Cason)")).toBe("Judge - Superior Court - Gwinnett Judicial Circuit (Cason)");
  });

  it("reads election kinds from SOS names", () => {
    expect(electionKind("November General Election")).toBe("general");
    expect(electionKind("May 19, 2026 - General Primary")).toBe("primary");
    expect(electionKind("June 16th, 2026 General Primary Runoff")).toBe("runoff");
    expect(electionKind("RECOUNT - May 19th, 2026 PSC District 3-REP")).toBe("recount");
    expect(electionKind("July 28th, 2026 - Special Election")).toBe("special");
  });

  it("switches a waiting watch only to the one listed election of its kind on the date", () => {
    const listed = [
      { id: "2026NovGen", date: "2026-11-03", name: "November 3, 2026 General Election", kind: "general" as const },
      { id: "11032026Special", date: "2026-11-03", name: "November 3, 2026 Special Election", kind: "special" as const },
      { id: "GeneralPrimary51926", date: "2026-05-19", name: "May 19, 2026 - General Primary", kind: "primary" as const },
    ];
    const want = { id: "11032026GeneralAndSpecialElection", date: "2026-11-03", kind: "general" as const };
    expect(replacementElection(listed, want)?.id).toBe("2026NovGen");
    expect(replacementElection([...listed, { ...want, name: "General" }], want)).toBeNull();
    expect(replacementElection([...listed, { ...listed[0], id: "2026NovGen2" }], want)).toBeNull();
    expect(replacementElection(listed, { ...want, date: null })).toBeNull();
    expect(replacementElection(listed, { ...want, date: "2026-12-01" })).toBeNull();
  });

  it("parses votes by method and county headers", () => {
    const feed = parseFeed(state2024);
    const president = feed.contests.find((c) => c.name === "President of the US")!;
    const trump = president.options.find((o) => o.name === "Donald J. Trump")!;
    expect(trump.party).toBe("R");
    expect(Object.values(trump.votesByMethod).reduce((a, b) => a + b, 0)).toBe(trump.votes);
    expect(feed.localityElections).toHaveLength(2);
    expect(feed.localities.map((l) => l.shortName)).toEqual(["appling-county-ga", "fulton-county-ga"]);
  });

  it("takes the primary party from the contest", () => {
    const feed = parseFeed(primary2026);
    const senate = feed.contests.find((c) => c.name === "US Senate - Rep")!;
    expect(senate.primaryParty).toBe("R");
    expect(senate.options.every((o) => o.party === "R")).toBe(true);
  });

  it("detects ballot questions", () => {
    const feed = parseFeed(state2024);
    expect(feed.contests.find((c) => c.name === "Proposed Constitutional Amendment 2")!.isReferendum).toBe(true);
    expect(feed.contests.find((c) => c.name === "President of the US")!.isReferendum).toBe(false);
  });
});

describe("level", () => {
  const cls = (name: string, fromCounty = false, isReferendum = false) => classifyContest(name, { fromCounty, isReferendum }).level;
  it("classifies state-feed contests", () => {
    expect(cls("President of the US")).toBe("federal");
    expect(cls("US House of Representatives - District 1")).toBe("federal");
    expect(cls("State House of Representatives - District 128")).toBe("legislative");
    expect(cls("District Attorney - Chattahoochee Judicial Circuit")).toBe("judicial");
    expect(cls("Governor - Dem")).toBe("statewide");
    expect(cls("PSC - District 3 - Rep")).toBe("statewide");
  });
  it("classifies county-feed contests", () => {
    expect(cls("Sheriff", true)).toBe("county");
    expect(cls("Clerk of Superior Court", true)).toBe("county");
    expect(cls("County Commission - District 2", true)).toBe("county");
    expect(cls("Board of Education District 3", true)).toBe("school");
    expect(cls("East Point City Council - Ward B At Large (SE)", true)).toBe("municipal");
    expect(cls("Councilmember - Graham", true)).toBe("municipal");
    expect(cls("Appling Ad Valorem Tax", true, true)).toBe("referendum");
  });
  it("finds the municipality", () => {
    expect(municipalityOf("Atlanta Mayor")).toBe("Atlanta");
    expect(municipalityOf("City of College Park Homestead Exemption")).toBe("College Park");
    expect(municipalityOf("City Council (Jonesboro)")).toBe("Jonesboro");
    // Nov 3 2026 special-election names
    expect(municipalityOf("Spec Alapaha City Council - Post 4")).toBe("Alapaha");
    expect(municipalityOf("Special Molena City Council - Post 2")).toBe("Molena");
    expect(municipalityOf("SPECIAL City of LaGrange Council Member - District 2C")).toBe("LaGrange");
    expect(municipalityOf("Councilmember - At Large (Gordon Special)")).toBe("Gordon");
    expect(municipalityOf("Mayor (Special)")).toBeNull();
    expect(municipalityOf("Special City Council - District 2")).toBeNull();
    expect(municipalityOf("Mayor - Bloomingdale")).toBe("Bloomingdale");
    expect(municipalityOf("Fairburn City Council At Large")).toBe("Fairburn");
    expect(municipalityOf("Councilmember - Graham")).toBe("Graham");
    expect(municipalityOf("Sales and Use Tax")).toBeNull();
  });
});

describe("rules", () => {
  const base = { voteFor: 1, isReferendum: false, electionKind: "general" as const, municipality: null };
  it("uses majority by default and plurality for President", () => {
    expect(decisionRule({ ...base, name: "Sheriff", level: "county" }).rule).toBe("majority");
    expect(decisionRule({ ...base, name: "President of the US", level: "federal" }).rule).toBe("plurality");
  });
  it("leaves municipal rules unknown until sourced", () => {
    const args = { ...base, name: "Atlanta Mayor", level: "municipal" as const, municipality: "Atlanta" };
    expect(decisionRule(args).rule).toBe("unknown");
    expect(decisionRule({ ...args, municipalRules: { atlanta: { rule: "majority", source: "charter" } } }).rule).toBe("majority");
  });
  it("handles multi-seat, referendum and runoff rounds", () => {
    expect(decisionRule({ ...base, name: "Council", level: "municipal", voteFor: 3 }).rule).toBe("top_n");
    expect(decisionRule({ ...base, name: "Q", level: "referendum", isReferendum: true }).rule).toBe("referendum");
    expect(decisionRule({ ...base, name: "Lt Gov", level: "statewide", electionKind: "runoff" }).rule).toBe("plurality");
  });
});

describe("margin", () => {
  it("ranks the 2024 general by raw votes: HD 128 then HD 105", () => {
    const contests = evaluateAll(state2024).filter((c) => c.margin.rankable);
    const rows = contests.map((c) => ({ name: c.name, marginVotes: c.margin.marginVotes, marginPct: c.margin.marginPct }));
    const order = [...rows].sort(compareByVotes).map((r) => r.name);
    expect(order.slice(0, 2)).toEqual([
      "State House of Representatives - District 128",
      "State House of Representatives - District 105",
    ]);
    const hd128 = byName(contests, "State House of Representatives - District 128");
    expect(hd128.margin.marginVotes).toBe(48);
    expect(hd128.flags).toContain("recount_request_range");
    expect(hd128.flags).toContain("near_runoff");
    expect(hd128.status).toBe("state_certified");
  });

  it("orders vote and percent rankings differently when they disagree", () => {
    const rows = [
      { name: "big", marginVotes: 900, marginPct: 0.2 },
      { name: "small", marginVotes: 40, marginPct: 3 },
    ];
    expect([...rows].sort(compareByVotes)[0].name).toBe("small");
    expect([...rows].sort(compareByPercent)[0].name).toBe("big");
  });

  it("puts exact ties first and names no winner", () => {
    const m = computeMargin({ options: [opt("A", 100), opt("B", 100), opt("C", 5)], voteFor: 1, rule: "majority", threshold: 0.5 });
    expect(m.marginVotes).toBe(0);
    expect(m.flags).toContain("tie");
    expect(m.ranked.some((o) => o.isApparentWinner)).toBe(false);
    expect(m.ranked.some((o) => o.isCurrentLeader)).toBe(false);
    const rows = [
      { name: "one", marginVotes: 1, marginPct: 0.01 },
      { name: "tie", marginVotes: 0, marginPct: 0 },
    ];
    expect([...rows].sort(compareByVotes)[0].name).toBe("tie");
  });

  it("uses the last winner vs first loser for vote-for-N", () => {
    const contests = assembleContests(parseFeed({ election: {}, ballotItems: [] }), [county("fulton-county-ga", "Fulton County", muniFulton)]).contests.map((c) =>
      evaluateContest(c, { electionKind: "general" }),
    );
    const council = byName(contests, "Fairburn City Council At Large");
    // 1780, 1335, 1180 | 1097 …
    expect(council.rule).toBe("top_n");
    expect(council.margin.cutoffWinner!.name).toBe("Ulysses Smallwood");
    expect(council.margin.cutoffLoser!.name).toBe("Nancy Juarez Sanchez");
    expect(council.margin.marginVotes).toBe(83);
    expect(council.margin.ranked.filter((o) => o.isApparentWinner)).toHaveLength(3);
    expect(council.flags).not.toContain("runoff_required");
  });

  it("measures ballot questions as Yes vs No without recount flags", () => {
    const a = byName(evaluateAll(state2024), "Statewide Referendum Question A");
    expect(a.rule).toBe("referendum");
    expect(a.margin.marginVotes).toBeGreaterThan(0);
    expect(a.flags).not.toContain("recount_request_range");
  });

  it("flags a majority contest under 50% as runoff required", () => {
    const primary = evaluateAll(primary2026);
    expect(byName(primary, "Lieutenant Governor - Dem").flags).toContain("runoff_required");
    expect(byName(primary, "Governor - Dem").flags).not.toContain("runoff_required");
  });

  it("never flags runoffs in a runoff round", () => {
    const runoff = evaluateAll(primaryRunoff2026);
    for (const c of runoff) expect(c.flags).not.toContain("runoff_required");
  });

  it("marks unsourced municipal rules instead of claiming a runoff", () => {
    const contests = assembleContests(parseFeed({ election: {}, ballotItems: [] }), [county("fulton-county-ga", "Fulton County", fulton2024)]).contests.map((c) =>
      evaluateContest(c, { electionKind: "general" }),
    );
    const eastPoint = byName(contests, "East Point City Council - Ward B At Large (SE)");
    expect(eastPoint.rule).toBe("unknown");
    expect(eastPoint.flags).toContain("runoff_rule_unverified");
    expect(eastPoint.flags).not.toContain("runoff_required");
  });

  it("keeps uncontested and zero-result contests out of the ranking", () => {
    const contests = assembleContests(parseFeed({ election: {}, ballotItems: [] }), [county("fulton-county-ga", "Fulton County", fulton2024)]).contests.map((c) =>
      evaluateContest(c, { electionKind: "general" }),
    );
    const sheriff = byName(contests, "Sheriff");
    expect(sheriff.margin.uncontested).toBe(true);
    expect(sheriff.margin.rankable).toBe(false);
    const empty = computeMargin({ options: [opt("A", 0), opt("B", 0)], voteFor: 1, rule: "majority", threshold: 0.5 });
    expect(empty.rankable).toBe(false);
    expect(empty.flags).toEqual([]);
  });

  it("counts write-ins in the total but not as candidates", () => {
    const m = computeMargin({ options: [opt("A", 90), opt("Write-in", 10, { isWriteIn: true })], voteFor: 1, rule: "majority", threshold: 0.5 });
    expect(m.uncontested).toBe(true);
    expect(m.totalVotes).toBe(100);
  });

  it("handles the PSC recount and a jungle special", () => {
    const [psc] = evaluateAll(pscRecount);
    expect(psc.margin.marginVotes).toBe(389682 - 386640);
    expect(psc.flags).toContain("recount_request_range");
    expect(psc.status).toBe("unofficial_complete");
    const [special] = evaluateAll(julSpecial);
    expect(special.flags).toContain("runoff_required");
  });
});

describe("result status", () => {
  it("moves from no results to certified", () => {
    const base = { scope: "state" as const, isOfficial: false };
    expect(resultStatus({ ...base, totalVotes: 0, reportingUnits: 0, totalUnits: 159 })).toBe("no_results");
    expect(resultStatus({ ...base, totalVotes: 10, reportingUnits: 12, totalUnits: 159 })).toBe("reporting");
    expect(resultStatus({ ...base, totalVotes: 10, reportingUnits: 159, totalUnits: 159 })).toBe("unofficial_complete");
    expect(resultStatus({ ...base, totalVotes: 10, reportingUnits: 159, totalUnits: 159, isOfficial: true })).toBe("state_certified");
    expect(resultStatus({ ...base, scope: "county", totalVotes: 10, reportingUnits: 9, totalUnits: 9, isOfficial: true })).toBe("county_certified");
    expect(resultStatus({ ...base, totalVotes: 10, reportingUnits: 9, totalUnits: 9, override: "recount_pending" })).toBe("recount_pending");
  });
});

describe("contest keys", () => {
  const item = (id: string, name: string, candidates: [string, string | null][]) => ({
    id,
    parentId: null,
    name: [{ text: name }],
    voteFor: [{ text: "Vote for 1" }],
    reportingStatus: { reportingUnits: 0, totalUnits: 10 },
    summaryResults: {
      ballotOptions: candidates.map(([n, party], i) => ({ id: `${id}-${i}`, name: [{ text: n }], voteCount: 0, party: party ? { abbreviation: party } : null })),
    },
  });
  const keys = (isPrimary: boolean, items: unknown[]) =>
    assembleContests(parseFeed({ election: { isPrimary }, ballotItems: items }), []).contests.map((c) => `${c.name}|${c.options[0].name}|${c.key}`).sort();

  it("keys a party's primary by party, whatever the feed order or contest ids", () => {
    const rep = (id: string) => item(id, "State Senate - District 7", [["Aizaz Shahbaz Shaikh", "Rep"]]);
    const dem = (id: string) => item(id, "State Senate - District 7", [["Ruwa Romman", "Dem"], ["Astrid S. Ross", "Dem"]]);
    const api = keys(true, [rep("a1"), dem("a2")]);
    expect(api).toEqual(keys(true, [dem("x9"), rep("x8")]));
    expect(api.map((k) => k.split("|")[2])).toEqual(["state-senate-district-7-r", "state-senate-district-7-d"]);
  });

  it("infers the primary party from the candidates when the name has none", () => {
    const feed = parseFeed({ election: { isPrimary: true }, ballotItems: [item("a", "State House - District 97", [["Jacques Laurent", "Dem"], ["Jyot Singh", "Dem"]])] });
    expect(feed.contests[0].primaryParty).toBe("D");
  });

  it("keys a same-named general contest by its candidates", () => {
    const regular = (id: string) => item(id, "Board of Education District 3", [["Ann Lee", null], ["Bo Diaz", null]]);
    const special = (id: string) => item(id, "Board of Education District 3", [["Cy Moss", null], ["Di Park", null]]);
    const a = keys(false, [regular("1"), special("2")]);
    expect(a).toEqual(keys(false, [special("9"), regular("8")]));
    expect(new Set(a.map((k) => k.split("|")[2])).size).toBe(2);
    expect(a.every((k) => k.includes("~c"))).toBe(true);
  });
});

describe("merge", () => {
  const assembled = () =>
    assembleContests(parseFeed({ election: {}, ballotItems: [] }), [
      county("fulton-county-ga", "Fulton County", muniFulton),
      county("dekalb-county-ga", "DeKalb County", muniDekalb),
      county("clayton-county-ga", "Clayton County", muniClayton),
    ]);

  it("merges Atlanta races across counties by candidates even when names differ", () => {
    const { contests, warnings } = assembled();
    const council = contests.filter((c) => c.options.some((o) => o.name === "Michael Julian Bond"));
    expect(council).toHaveLength(1);
    expect(council[0].scope).toBe("multi_county");
    expect(council[0].counties).toEqual(["dekalb-county-ga", "fulton-county-ga"]);
    expect(council[0].options.find((o) => o.name === "Michael Julian Bond")!.votes).toBe(53412 + 5401);
    expect(warnings.some((w) => w.includes("different names"))).toBe(true);
    const mayor = contests.filter((c) => c.name === "Atlanta Mayor");
    expect(mayor).toHaveLength(1);
    expect(mayor[0].options.find((o) => o.name === "Andre Dickens")!.votes).toBe(79107 + 9432);
  });

  it("merges a city ballot question but not a generic one", () => {
    const { contests } = assembled();
    expect(contests.filter((c) => c.name === "City of College Park Homestead Exemption")).toHaveLength(1);
    expect(contests.find((c) => c.name === "City of College Park Homestead Exemption")!.options.find((o) => o.name === "Yes")!.votes).toBe(1731 + 45);
    expect(contests.find((c) => c.name === "Sales and Use Tax")!.scope).toBe("county");
  });

  it("merges a question named for a city after a dash (Social Circle spans Newton and Walton)", () => {
    const question = (yes: number, no: number) => ({
      election: { isOfficialResults: true },
      ballotItems: [
        {
          id: `q${yes}`,
          parentId: null,
          name: [{ text: "Sunday Package Sales - Social Circle" }],
          voteFor: [{ text: "Vote for 1" }],
          reportingStatus: { reportingUnits: 1, totalUnits: 1 },
          summaryResults: { ballotOptions: [{ id: "y", name: [{ text: "Yes" }], voteCount: yes }, { id: "n", name: [{ text: "No" }], voteCount: no }] },
        },
      ],
    });
    const { contests } = assembleContests(parseFeed({ election: {}, ballotItems: [] }), [
      county("newton-county-ga", "Newton County", question(1, 1)),
      county("walton-county-ga", "Walton County", question(1645, 875)),
    ]);
    expect(contests).toHaveLength(1);
    const ev = evaluateContest(contests[0], { electionKind: "general" });
    expect(ev.municipality).toBe("Social Circle");
    expect(ev.margin.marginVotes).toBe(1646 - 876);
    expect(ev.flags).not.toContain("tie");
  });

  it("leaves generic questions in unrelated counties separate and says so", () => {
    const generic = () => ({ election: {}, ballotItems: [{ ...muniClayton.ballotItems.find((b) => b.name[0].text === "Sales and Use Tax")! }] });
    const { contests, warnings } = assembleContests(parseFeed({ election: {}, ballotItems: [] }), [
      county("clayton-county-ga", "Clayton County", generic()),
      county("rabun-county-ga", "Rabun County", generic()),
    ]);
    expect(contests).toHaveLength(2);
    expect(warnings.some((w) => w.includes("overrides.merge"))).toBe(true);
    const forced = assembleContests(parseFeed({ election: {}, ballotItems: [] }), [
      county("clayton-county-ga", "Clayton County", generic()),
      county("rabun-county-ga", "Rabun County", generic()),
    ], { merge: ["Sales and Use Tax"] });
    expect(forced.contests).toHaveLength(1);
  });

  it("keeps merged keys stable when vote counts change", () => {
    const first = assembled().contests.find((c) => c.name === "Atlanta Mayor")!.key;
    const bumped = structuredClone(muniDekalb);
    bumped.ballotItems[0].summaryResults.ballotOptions[0].voteCount += 500_000;
    const again = assembleContests(parseFeed({ election: {}, ballotItems: [] }), [
      county("fulton-county-ga", "Fulton County", muniFulton),
      county("dekalb-county-ga", "DeKalb County", bumped),
    ]).contests.find((c) => c.options.some((o) => o.name === "Andre Dickens"))!.key;
    expect(again).toBe(first);
  });

  it("respects split overrides", () => {
    const { contests } = assembleContests(
      parseFeed({ election: {}, ballotItems: [] }),
      [county("fulton-county-ga", "Fulton County", muniFulton), county("dekalb-county-ga", "DeKalb County", muniDekalb)],
      { split: ["Atlanta Mayor"] },
    );
    expect(contests.filter((c) => c.options.some((o) => o.name === "Andre Dickens"))).toHaveLength(2);
  });

  it("turns county slices of state contests into area rows", () => {
    const state = parseFeed(state2024);
    const { contests } = assembleContests(state, [
      county("fulton-county-ga", "Fulton County", fulton2024),
      county("appling-county-ga", "Appling County", appling2024),
    ]);
    const president = contests.find((c) => c.name === "President of the US")!;
    expect(president.areas.map((a) => a.countySlug)).toEqual(["appling-county-ga", "fulton-county-ga"]);
    expect(contests.filter((c) => c.name === "President of the US")).toHaveLength(1);
    expect(contests.some((c) => c.name === "Appling Ad Valorem Tax" && c.scope === "county")).toBe(true);
  });
});

describe("media export fallback", () => {
  it("lands on the same contest keys and numbers as the JSON API", () => {
    const api = assembleContests(parseFeed(state2024), [
      county("fulton-county-ga", "Fulton County", fulton2024),
      county("appling-county-ga", "Appling County", appling2024),
    ]).contests;
    const { state, counties } = parseMediaExport(mediaExport2024, { isOfficial: true });
    expect(counties.map((c) => c.slug).sort()).toEqual(["appling-county-ga", "fulton-county-ga"]);
    const fallback = assembleContests(state, counties).contests;
    for (const key of ["state-house-of-representatives-district-128", "president-of-the-us", "fulton-county-ga:sheriff"]) {
      const a = api.find((c) => c.key === key)!;
      const b = fallback.find((c) => c.key === key)!;
      expect(b, key).toBeDefined();
      expect(b.options.map((o) => [o.name, o.votes]).sort()).toEqual(a.options.map((o) => [o.name, o.votes]).sort());
    }
    const president = fallback.find((c) => c.key === "president-of-the-us")!;
    expect(president.areas.map((a) => a.countySlug)).toEqual(["appling-county-ga", "fulton-county-ga"]);
    expect(evaluateContest(fallback.find((c) => c.key === "state-house-of-representatives-district-128")!, { electionKind: "general" }).margin.marginVotes).toBe(48);
  });
});

describe("csv", () => {
  it("writes one header and quotes cells that need it", () => {
    const csv = closeRacesCsv([
      {
        id: "x",
        rank: 1,
        name: 'Race, "quoted"',
        level: "county",
        county: "Fulton County",
        counties: ["fulton-county-ga"],
        municipality: null,
        electionKind: "general",
        primaryParty: null,
        voteFor: 1,
        leaderName: "A",
        leaderParty: "D",
        leaderIncumbent: true,
        leaderVotes: 10,
        runnerUpName: "B",
        runnerUpParty: "R",
        runnerUpIncumbent: false,
        runnerUpVotes: 9,
        totalVotes: 19,
        marginVotes: 1,
        marginPct: 5.263,
        leaderShare: 0.526,
        decisionRule: "majority",
        reportingUnits: 3,
        totalUnits: 3,
        resultStatus: "unofficial_complete",
        flags: ["near_runoff"],
        marginChange: null,
        sourceUpdatedAt: null,
        ingestedAt: null,
        electionId: null,
      },
    ]);
    const [header, line] = csv.trim().split("\n");
    expect(header.split(",")).toHaveLength(CLOSE_RACE_COLUMNS.length);
    expect(line.startsWith('1,"Race, ""quoted""",county')).toBe(true);
  });
});
