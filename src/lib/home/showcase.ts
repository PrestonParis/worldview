// Real samples for the homepage tool showcase: one small, deterministic
// record per tool, loaded once per page render (the homepage revalidates
// daily). Every figure here comes from the database or the quiz engine;
// nothing is written by hand except which records to feature.

import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { bills, elections, entities } from "../db/schema";
import { getEntity } from "../db/entities";
import { loadProfileBundle } from "../db/profile-records";
import { getCrossSection } from "../db/stats";
import { loadBillDocket, loadRaceDocket } from "../db/writ";
import { HANDICAPPERS, consensusRating } from "../elections/overview";
import { ratingLabel, type Rating } from "../validation/raceRating";
import { normalizeParty } from "../legislation/votingRecord";
import { publicEntityPath } from "../people/public";
import { FIPS_TO_ABBR } from "../geo/states";
import { summarizeGiving } from "../people/profile-model";
import { heroRoles, keyFacts, updatedOn } from "../people/profile-view";
import { writDocketHref } from "../tools/writ";
import { answerEvidence, GRID, PRIOR_SD, MAX_PER_AXIS, MIN_PER_AXIS, SD_TARGET, statementById } from "../quiz/engine";
import { computeResult, verdict, type Verdict } from "../quiz/results";
import { simulate } from "../quiz/sim";
import { atlasTraditionHref } from "../atlas/tradition-link";
import type { AxisId, IdeologyFamily } from "../quiz/types";
import type { BillDocket } from "../db/writ";
import type { Dataset } from "../db/stats/types";
import type { StateMeasure } from "@/components/home/state-map";

const settle = <T,>(promise: Promise<T>) => promise.then((value) => value, () => null);
const round = (value: number, places = 3) => Number(value.toFixed(places));

// ---------------------------------------------------------------- Atlas

export interface AtlasShowcase {
  axis: AxisId;
  grid: number[];
  prior: number[]; // log prior on the grid
  // Real bank statements on one axis, spanning it. likelihood[v + 3] is the
  // engine's log P(answer v | position) on the grid, for v = -3…+3.
  statements: { id: string; text: string; likelihood: number[][] }[];
  sdTarget: number;
  perAxis: [number, number];
  sample: AtlasSample;
}

export interface AtlasSample {
  answered: number;
  axes: { axis: AxisId; truth: number; mean: number; sd: number }[];
  maxMiss: number; // largest |estimate - truth| across the axes, 0–100 points
  verdict: Verdict;
  matches: {
    id: string;
    name: string;
    family: IdeologyFamily;
    match: number;
    closest: { axis: AxisId; gap: number }[];
    furthest: { axis: AxisId; gap: number }[];
  }[];
}

const TEASER_AXIS: AxisId = "redistribution";
// A guaranteed income (far end), a work-tested safety net (centre), a flat
// tax (the other side): three answers that triangulate a position.
const TEASER_STATEMENTS = ["redistribution.02", "redistribution.09", "redistribution.14"];

// The simulated respondent behind the sample report: a mixed profile so the
// report shows splits rather than a single tidy label. Answers come from
// sim.ts's response model at this "true" position, through the Profile
// checkpoint, with a fixed seed so the page is stable.
const SAMPLE_TRUTH: Record<AxisId, number> = {
  federalism: -0.3, executive: -0.4, liberty: -0.5, voting: -0.4, democracy: -0.9, violence: -0.8,
  ownership: 0.5, regulation: -0.1, redistribution: -0.2, trade: 0.5,
  engagement: -0.3, force: 0.2,
  social: 0.1, religion: -0.3, immigration: 0.3, justice: 0.2, identity: 0.4, race: -0.9,
  environment: -0.2, technology: 0.4,
};

let atlasCache: AtlasShowcase | null = null;

export function atlasShowcase(): AtlasShowcase {
  if (atlasCache) return atlasCache;
  const statements = TEASER_STATEMENTS.flatMap((id) => {
    const statement = statementById.get(id);
    if (!statement) return [];
    const likelihood = [-3, -2, -1, 0, 1, 2, 3].map((value) =>
      (answerEvidence({ kind: "statement", id, value })[TEASER_AXIS] ?? GRID.map(() => 0)).map((l) => round(l)),
    );
    return [{ id, text: statement.text, likelihood }];
  });

  const { answers } = simulate({ truth: SAMPLE_TRUTH, noise: 0.8, skipRate: 0 }, "homepage-sample", 200, "standard");
  const result = computeResult(answers);
  const axes = result.axes.map((a) => ({ axis: a.axis, truth: SAMPLE_TRUTH[a.axis], mean: round(a.mean), sd: round(a.sd) }));
  atlasCache = {
    axis: TEASER_AXIS,
    grid: GRID.map((g) => round(g)),
    prior: GRID.map((t) => round(-(t * t) / (2 * PRIOR_SD * PRIOR_SD))),
    statements,
    sdTarget: SD_TARGET,
    perAxis: [MIN_PER_AXIS, MAX_PER_AXIS],
    sample: {
      answered: answers.length,
      axes,
      maxMiss: Math.round(Math.max(...axes.map((a) => Math.abs(a.mean - a.truth))) * 50),
      verdict: verdict(result.ideologies),
      matches: result.ideologies.slice(0, 3).map((m) => ({
        id: m.ideology.id,
        name: m.ideology.name,
        family: m.ideology.family,
        match: m.match,
        closest: m.comparisons.slice(0, 2).map((c) => ({ axis: c.axis, gap: round(c.gap) })),
        furthest: m.comparisons.slice(-2).reverse().map((c) => ({ axis: c.axis, gap: round(c.gap) })),
      })),
    },
  };
  return atlasCache;
}

// ---------------------------------------------------------------- Subpoena

export interface ProfileSample {
  name: string;
  href: string;
  imageUrl: string;
  roles: string[];
  summary: string;
  updated: string;
  facts: { label: string; value: string; note: string }[];
  tradition: { label: string; href: string | null; basis: string } | null;
  giving: {
    total: number;
    count: number;
    first: string;
    last: string;
    cycles: { cycle: number; total: number }[];
    top: { name: string; href: string; total: number }[];
  } | null;
  events: { date: string; title: string }[];
  quotes: { quote: string; date: string; datePrecision: "day" | "month" | "year"; venue: string; source: { publisher: string; url: string } | null }[];
}

export interface SubpoenaShowcase {
  profiles: ProfileSample[];
}

// Finished, reviewed dossiers from both sides of the donor class.
const SAMPLE_PROFILES = ["Peter Thiel", "George Soros"];

async function profileSample(name: string): Promise<ProfileSample | null> {
  const [row] = await db.select({ id: entities.id }).from(entities).where(eq(entities.name, name)).limit(1);
  const entity = row ? await getEntity(row.id) : null;
  if (!entity) return null;
  const bundle = await loadProfileBundle(entity);
  if (!bundle.editorial) return null;
  const href = publicEntityPath(entity);
  const giving = summarizeGiving(bundle.given);
  const own = bundle.events
    .filter((e) => e.subjectEntityId === entity.id && e.significance === 3 && e.status === "verified")
    .sort((a, b) => a.dateStart.localeCompare(b.dateStart));
  const featured = bundle.editorial.ideas.featuredQuotes
    .flatMap((key) => bundle.statements.filter((st) => st.key === key))
    .concat(bundle.statements)
    .filter((st, i, all) => st.quote && st.verbatim && all.indexOf(st) === i);
  const tradition = bundle.editorial.ideas.traditions[0];
  return {
    name: entity.name,
    href,
    imageUrl: entity.imageUrl ?? "",
    roles: heroRoles(bundle).map((r) => r.label).slice(0, 3),
    summary: bundle.editorial.summary,
    updated: updatedOn(bundle),
    facts: keyFacts(bundle, href).map(({ label, value, note }) => ({ label, value, note })),
    tradition: tradition
      ? { label: tradition.label, href: atlasTraditionHref(tradition.atlasId), basis: tradition.basis }
      : null,
    giving: giving.count
      ? {
          total: giving.total,
          count: giving.count,
          first: giving.first.slice(0, 10),
          last: giving.last.slice(0, 10),
          cycles: [...giving.byCycle].sort((a, b) => a.cycle - b.cycle).map((c) => ({ cycle: c.cycle, total: c.total })),
          top: [...giving.byRecipient].sort((a, b) => b.total - a.total).slice(0, 3).map((r) => {
            const recipient = bundle.entities.get(r.entityId);
            const recipientName = recipient?.name ?? "Unknown";
            return { name: recipientName, href: publicEntityPath({ id: r.entityId, name: recipientName }), total: r.total };
          }),
        }
      : null,
    // The start of the story and its latest turns.
    events: (own.length > 5 ? [...own.slice(0, 2), ...own.slice(-3)] : own).map((e) => ({ date: e.dateStart, title: e.title })),
    quotes: featured.slice(0, 2).map((st) => {
      const source = bundle.sources.get(st.sourceId);
      return {
        quote: st.quote,
        date: st.date,
        datePrecision: st.datePrecision,
        venue: st.venue,
        source: source?.url ? { publisher: source.publisher || source.title, url: source.url } : null,
      };
    }),
  };
}

async function subpoenaShowcase(): Promise<SubpoenaShowcase | null> {
  const profiles = (await Promise.all(SAMPLE_PROFILES.map((name) => settle(profileSample(name))))).filter(
    (p): p is ProfileSample => p !== null,
  );
  return profiles.length ? { profiles } : null;
}

// ---------------------------------------------------------------- Writ

export type StageStatus = "done" | "current" | "upcoming";

export interface BillStage {
  key: string;
  label: string;
  status: StageStatus;
  date: string | null;
  detail: string | null;
}

export interface BillSample {
  id: string;
  number: string;
  title: string;
  congress: number | null;
  chamber: string;
  sponsor: string | null;
  committees: string[];
  policyArea: string;
  latest: { date: string; text: string };
  stages: BillStage[];
  href: string;
}

export interface RaceSample {
  title: string;
  date: string;
  status: string;
  href: string;
  candidates: { name: string; party: string; incumbent: boolean; votes: number | null }[];
  ratings: { source: string; rating: Rating; label: string; asOf: string }[];
  consensus: { rating: Rating; label: string } | null;
}

export interface WritShowcase {
  bills: BillSample[];
  race: RaceSample | null;
  electionsHref: string;
}

// An enacted law and a bill still moving, both with recorded floor votes.
const WRIT_BILLS = ["119-hr-6644", "119-hr-227"];
const WRIT_RACE = { cycle: 2026, jurisdiction: "Georgia", office: "U.S. Senate", electionType: "general" } as const;

const VOTE = /Yea-Nay Vote\.\s*(\d+)\s*-\s*(\d+)/;
const YEAS_NAYS = /Yeas and Nays:\s*(\d+)\s*-\s*(\d+)/;

// The stages a bill has passed through, from its action log. Optional
// stages (resolving differences) appear only when they happened.
export function billStages(docket: BillDocket): BillStage[] {
  const { bill, actions, rollCalls } = docket;
  const sorted = [...actions].sort((a, b) => a.date.localeCompare(b.date));
  const first = (test: (text: string, type: string) => boolean) => sorted.find((a) => test(a.text, a.actionType)) ?? null;
  const origin = bill.chamber === "Senate" ? "Senate" : "House";
  const other = origin === "House" ? "Senate" : "House";
  const day = (date: string | undefined | null) => (date ? date.slice(0, 10) : null);

  const floorVote = (chamber: string, date: string | null, text: string) => {
    const roll = rollCalls.find((r) => r.chamber === chamber && day(r.date) === date && r.result.toLowerCase().startsWith("pass"));
    if (roll) return `Passed ${roll.tally.yea}–${roll.tally.nay} on roll call ${roll.rollNumber}`;
    const vote = VOTE.exec(text) ?? YEAS_NAYS.exec(text);
    if (vote) return `Passed ${vote[1]}–${vote[2]}`;
    if (/Unanimous Consent/i.test(text)) return "Passed by unanimous consent";
    if (/voice vote/i.test(text)) return "Passed by voice vote";
    return "Passed";
  };

  const committee = first((text, type) => type === "Committee" && /Reported|Ordered to be Reported/.test(text));
  const committeeVote = committee && YEAS_NAYS.exec(committee.text);
  const passedOrigin = first((text) => text.startsWith(`Passed/agreed to in ${origin}`) || text.startsWith(`Passed ${origin}`));
  const passedOther = first((text) => text.startsWith(`Passed/agreed to in ${other}`) || text.startsWith(`Passed ${other}`));
  const resolving = sorted.filter((a) => a.actionType === "ResolvingDifferences");
  const presented = first((text) => text.startsWith("Presented to President"));
  const law = first((text, type) => type === "BecameLaw" || text.startsWith("Became Public Law"));
  const unsigned = first((text) => /unsigned/i.test(text) && /Archivist/i.test(text));
  const signed = first((text) => text.startsWith("Signed by President"));

  const stages: Omit<BillStage, "status">[] = [
    { key: "introduced", label: "Introduced", date: day(bill.introducedDate), detail: `In the ${origin}` },
    {
      key: "committee", label: "Committee", date: day(committee?.date),
      detail: committee ? (committeeVote ? `Reported after a ${committeeVote[1]}–${committeeVote[2]} committee vote` : "Reported by committee") : null,
    },
    { key: "origin", label: `Passed ${origin}`, date: day(passedOrigin?.date), detail: passedOrigin ? floorVote(origin, day(passedOrigin.date), passedOrigin.text) : null },
    { key: "other", label: `Passed ${other}`, date: day(passedOther?.date), detail: passedOther ? floorVote(other, day(passedOther.date), passedOther.text) : null },
    ...(resolving.length ? [{
      key: "resolving", label: "Chambers agree", date: day(resolving.at(-1)!.date),
      detail: `${resolving.length} ${resolving.length === 1 ? "action" : "actions"} resolving differences between the chambers`,
    }] : []),
    { key: "president", label: "To the President", date: day(presented?.date), detail: presented ? "Presented to the President" : null },
    {
      key: "law", label: "Became law", date: day(law?.date),
      detail: law ? `${law.text.replace(/\.$/, "")}${unsigned && !signed ? ", without the President's signature" : ""}` : null,
    },
  ];
  // Done up to the last stage with a date; the next one is where it stands.
  const reached = stages.reduce((last, stage, index) => (stage.date ? index : last), -1);
  return stages.map((stage, index) => ({
    ...stage,
    // A stage skipped on the way (a committee discharged) still counts as passed.
    status: index <= reached ? "done" : index === reached + 1 ? "current" : "upcoming",
  }));
}

async function billSample(externalId: string): Promise<BillSample | null> {
  const [row] = await db.select({ id: bills.id }).from(bills).where(eq(bills.externalId, externalId));
  if (!row) return null;
  const docket = await loadBillDocket(row.id);
  if (!docket) return null;
  const { bill } = docket;
  const latest = [...docket.actions].sort((a, b) => b.date.localeCompare(a.date))[0];
  const sponsor = bill.sponsorEntityId ? docket.entities[bill.sponsorEntityId]?.name ?? null : null;
  return {
    id: bill.id,
    number: bill.billNumber,
    title: bill.title,
    congress: bill.congress,
    chamber: bill.chamber ?? "House",
    sponsor,
    committees: [...new Set(docket.committees.map((c) => c.name.replace(/ Committee$/, "")))],
    policyArea: bill.policyArea,
    latest: { date: (latest?.date ?? bill.latestActionDate).slice(0, 10), text: latest?.text ?? bill.latestActionText },
    stages: billStages(docket),
    href: writDocketHref("bill", bill.id),
  };
}

async function raceSample(): Promise<RaceSample | null> {
  const [row] = await db
    .select({ id: elections.id })
    .from(elections)
    .where(and(
      eq(elections.cycle, WRIT_RACE.cycle),
      eq(elections.jurisdiction, WRIT_RACE.jurisdiction),
      eq(elections.office, WRIT_RACE.office),
      eq(elections.electionType, WRIT_RACE.electionType),
    ));
  if (!row) return null;
  const docket = await loadRaceDocket(row.id);
  if (!docket) return null;
  const consensus = consensusRating(docket.ratings.map((r) => ({ source: r.source, rating: r.rating, asOf: r.asOf })));
  const sourceLabel = new Map(HANDICAPPERS.map((h) => [h.id, h.label]));
  return {
    title: `${docket.election.jurisdiction} ${docket.election.office}`,
    date: docket.election.electionDate.slice(0, 10),
    status: docket.election.status,
    href: writDocketHref("race", docket.election.id),
    candidates: docket.candidates.slice(0, 4).map((c) => ({
      name: c.name,
      party: normalizeParty(c.candidacy.party),
      incumbent: Boolean(c.candidacy.incumbent),
      votes: c.candidacy.votes ?? null,
    })),
    ratings: (consensus?.ratings ?? []).map((r) => ({ source: sourceLabel.get(r.source) ?? r.source, rating: r.rating, label: ratingLabel(r.rating), asOf: r.asOf })),
    consensus: consensus?.published ? { rating: consensus.rating, label: ratingLabel(consensus.rating) } : null,
  };
}

async function writShowcase(): Promise<WritShowcase | null> {
  const [billRows, race] = await Promise.all([Promise.all(WRIT_BILLS.map((id) => settle(billSample(id)))), settle(raceSample())]);
  const samples = billRows.filter((bill): bill is BillSample => bill !== null);
  if (!samples.length && !race) return null;
  return { bills: samples, race, electionsHref: "/elections" };
}

// ---------------------------------------------------------------- IssueView

// State metrics beyond the ones the homepage map already loads.
const ISSUE_METRICS = [
  { source: "census-acs1-social", metric: "median_household_income" },
  { source: "census-acs1-housing", metric: "median_home_value" },
  { source: "census-acs1-health", metric: "uninsured_rate" },
  { source: "census-acs1-social", metric: "bachelors_plus_share" },
];

async function issueMeasures(datasets: Dataset[]): Promise<StateMeasure[]> {
  const bySlug = new Map(datasets.map((d) => [d.slug, d]));
  const sections = await Promise.all(ISSUE_METRICS.map((s) => settle(getCrossSection(s.source, s.metric, "state"))));
  return ISSUE_METRICS.flatMap((s, i) => {
    const section = sections[i];
    const dataset = bySlug.get(s.source);
    const def = dataset?.metrics[s.metric];
    if (!section?.period || !section.values.length || !dataset || !def) return [];
    const values: Record<string, number | null> = {};
    for (const v of section.values) {
      const abbr = FIPS_TO_ABBR[v.geoid];
      if (abbr && abbr !== "PR" && v.value !== null && v.value > -900) values[abbr] = v.value;
    }
    return [{
      key: `${s.source}:${s.metric}`,
      label: def.label ?? s.metric,
      unit: def.unit ?? "",
      period: section.period,
      source: "Census ACS",
      href: `/issueview/compare?level=state&series=${s.source}:${s.metric}@${section.period}`,
      values,
    }];
  });
}

// ---------------------------------------------------------------- all

export interface Showcase {
  atlas: AtlasShowcase | null;
  subpoena: SubpoenaShowcase | null;
  writ: WritShowcase | null;
  issueMeasures: StateMeasure[];
}

export async function loadShowcase(datasets: Dataset[]): Promise<Showcase> {
  const [subpoena, writ, measures] = await Promise.all([
    settle(subpoenaShowcase()),
    settle(writShowcase()),
    settle(issueMeasures(datasets)),
  ]);
  let atlas: AtlasShowcase | null = null;
  try {
    atlas = atlasShowcase();
  } catch (error) {
    console.error("[home:atlasShowcase]", error);
  }
  return { atlas, subpoena, writ, issueMeasures: measures ?? [] };
}

