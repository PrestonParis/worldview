import { and, desc, ilike, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db } from "./client";
import { elections, entities, votes } from "./schema";
import { countBills, getBill, searchBills } from "./bills";
import { listActions, listCommittees, listCosponsors, listRelations, listTextVersions } from "./billDetails";
import { countRollCalls, listRollCallsForBill } from "./rollCalls";
import { listVotesForRollCall } from "./votes";
import { listVoterRollCallVotes, votesByRollCall, type VoterRollCallVote } from "./votingRecord";
import { escapeLike, getEntitiesByIds, getEntity } from "./entities";
import { getElection, latestCycle } from "./elections";
import { listCandidaciesForElection, listCandidaciesForEntity, type EntityCandidacy } from "./candidacies";
import { areaBreakdowns, listResultsForElection } from "./electionResults";
import { ratingHistory } from "./raceRatings";
import { getCandidateFinanceForEntity, type CandidateFinance } from "./candidateFinance";
import { outsideSpendingByCandidate, type CandidateOutsideSpending } from "./independentExpenditures";
import { listRaces } from "./election-overview";
import { brokeWithParty, normalizeParty } from "../legislation/votingRecord";
import { consensusRating, type RaceSummary } from "../elections/overview";
import { dedupeCandidacies, normalizeCandidateName } from "../elections/display";
import { summarizeCandidacies, type Candidacy, type ElectionSummary } from "../validation/candidacy";
import { emptyTally, type VoteTally } from "../validation/vote";
import { ratingLean, type RaceRating } from "../validation/raceRating";
import type { AreaBreakdown } from "../validation/electionResult";
import type { Bill } from "../validation/bill";
import type { BillAction, BillCommittee, BillCosponsor, BillRelation, BillTextVersion } from "../validation/billDetail";
import type { Election } from "../validation/election";
import type { Entity } from "../validation/entity";
import type { RollCall } from "../validation/rollCall";

// Writ's loaders: everything about one bill, member, or race gathered into a
// single docket, the way subpoena.ts builds a case file for one entity.

const LEGISLATOR_TYPES = ["politician", "judge"];

export type PartyKey = "D" | "R" | "I" | "Other";

export interface WritRollCall extends RollCall {
  tally: VoteTally;
  byParty: Partial<Record<PartyKey, VoteTally>>;
}

export interface BillDocket {
  kind: "bill";
  bill: Bill;
  actions: BillAction[];
  cosponsors: BillCosponsor[];
  committees: BillCommittee[];
  relations: BillRelation[];
  textVersions: BillTextVersion[];
  rollCalls: WritRollCall[];
  entities: Record<string, Entity>;
}

export interface MemberVote extends VoterRollCallVote {
  broke: boolean;
}

export interface MemberDocket {
  kind: "member";
  entity: Entity;
  party: string;
  record: {
    total: number;
    decisive: number;
    broke: number;
    missed: number;
    partyLineRate: number | null;
  };
  policyAreas: { name: string; count: number }[];
  // Newest first, capped; the record stats above cover every vote.
  votes: MemberVote[];
  sponsored: Bill[];
  sponsoredTotal: number;
  candidacies: EntityCandidacy[];
}

export interface RaceCandidate {
  candidacy: Candidacy;
  name: string;
  entity: Entity | null;
  finance: CandidateFinance | null;
  outside: CandidateOutsideSpending | null;
  // Has a roll-call record, so a member docket exists for them.
  hasVotes: boolean;
}

export interface RaceDocket {
  kind: "race";
  election: Election;
  cycle: number;
  upcomingGeneral: boolean;
  candidates: RaceCandidate[];
  others: RaceCandidate[];
  summary: ElectionSummary;
  consensus: ReturnType<typeof consensusRating>;
  ratings: RaceRating[];
  areas: AreaBreakdown[];
}

export type WritDocket = BillDocket | MemberDocket | RaceDocket;

export interface WritResult {
  kind: "bill" | "member" | "race";
  id: string;
  label: string;
  detail: string;
}

export interface WritSearchResults {
  bills: WritResult[];
  members: WritResult[];
  races: WritResult[];
}

export interface WritDiscovery {
  recentBills: Bill[];
  races: RaceSummary[];
  cycle: number | null;
  members: { entity: Entity; votes: number }[];
  counts: { bills: number; rollCalls: number };
}

function partyKey(party: string | null | undefined): PartyKey {
  const letter = normalizeParty(party);
  return letter === "D" || letter === "R" || letter === "I" ? letter : "Other";
}

function toRecord(list: Entity[]): Record<string, Entity> {
  return Object.fromEntries(list.map((entity) => [entity.id, entity]));
}

async function entityIdsWithVotes(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db
    .selectDistinct({ id: votes.voterEntityId })
    .from(votes)
    .where(and(inArray(votes.voterEntityId, ids), isNotNull(votes.rollCallId)));
  return new Set(rows.map((row) => row.id));
}

// ---------------------------------------------------------------- search

export async function searchWrit(query: string): Promise<WritSearchResults> {
  const q = query.trim();
  if (!q) return { bills: [], members: [], races: [] };
  const like = `%${escapeLike(q)}%`;
  const hasVotes = sql`exists (select 1 from ${votes} where ${votes.voterEntityId} = ${entities.id} and ${votes.rollCallId} is not null)`;

  const [billPage, memberRows, raceRows] = await Promise.all([
    searchBills({ q, pageSize: 8 }),
    db
      .select({ id: entities.id, name: entities.name, type: entities.type, hasVotes: sql<boolean>`${hasVotes}` })
      .from(entities)
      .where(and(inArray(entities.type, LEGISLATOR_TYPES), ilike(entities.name, like)))
      .orderBy(
        desc(hasVotes),
        sql`case when lower(${entities.name}) like ${`${escapeLike(q.toLowerCase())}%`} then 0 else 1 end`,
        entities.name,
      )
      .limit(8),
    db
      .select({
        id: elections.id,
        name: elections.name,
        office: elections.office,
        jurisdiction: elections.jurisdiction,
        cycle: elections.cycle,
      })
      .from(elections)
      .where(or(ilike(elections.name, like), ilike(elections.jurisdiction, like), ilike(elections.office, like)))
      .orderBy(desc(elections.electionDate))
      .limit(8),
  ]);

  return {
    bills: billPage.bills.map((bill) => ({ kind: "bill", id: bill.id, label: bill.billNumber, detail: bill.title })),
    members: memberRows.map((row) => ({
      kind: "member",
      id: row.id,
      label: row.name,
      detail: row.hasVotes ? "Voting record" : row.type === "judge" ? "Judge" : "Politician",
    })),
    races: raceRows.map((row) => ({
      kind: "race",
      id: row.id,
      label: `${row.jurisdiction} ${row.office}`,
      detail: row.cycle ? String(row.cycle) : row.name,
    })),
  };
}

// ---------------------------------------------------------------- bill

export async function loadBillDocket(id: string): Promise<BillDocket | null> {
  const [bill, actions, cosponsors, committees, relations, textVersions, rollCalls] = await Promise.all([
    getBill(id),
    listActions(id),
    listCosponsors(id),
    listCommittees(id),
    listRelations(id),
    listTextVersions(id),
    listRollCallsForBill(id),
  ]);
  if (!bill) return null;

  const rollCallVotes = await Promise.all(rollCalls.map((rollCall) => listVotesForRollCall(rollCall.id)));
  const writRollCalls = rollCalls.map((rollCall, index): WritRollCall => {
    const tally = emptyTally();
    const byParty: Partial<Record<PartyKey, VoteTally>> = {};
    for (const vote of rollCallVotes[index]) {
      tally[vote.position]++;
      const key = partyKey(vote.party);
      (byParty[key] ??= emptyTally())[vote.position]++;
    }
    return { ...rollCall, tally, byParty };
  });

  const related = await getEntitiesByIds([bill.sponsorEntityId ?? "", ...cosponsors.map((c) => c.entityId)]);
  return {
    kind: "bill",
    bill,
    actions,
    cosponsors,
    committees,
    relations,
    textVersions,
    rollCalls: writRollCalls,
    entities: toRecord(related),
  };
}

// ---------------------------------------------------------------- member

const MEMBER_VOTE_LIMIT = 150;

export async function loadMemberDocket(entityId: string): Promise<MemberDocket | null> {
  const [entity, voterVotes, sponsoredPage, candidacies] = await Promise.all([
    getEntity(entityId),
    listVoterRollCallVotes(entityId),
    searchBills({ sponsorEntityId: entityId, pageSize: 25 }),
    listCandidaciesForEntity(entityId),
  ]);
  if (!entity) return null;

  const allVotes = await votesByRollCall(voterVotes.map((vote) => vote.rollCallId));
  const rows: MemberVote[] = voterVotes.map((vote) => ({
    ...vote,
    broke: brokeWithParty({ voterEntityId: entityId, position: vote.position, party: vote.party }, allVotes.get(vote.rollCallId) ?? []),
  }));
  const decisive = rows.filter((row) => row.position === "yea" || row.position === "nay");
  const broke = decisive.filter((row) => row.broke).length;

  const areaCounts = new Map<string, number>();
  for (const row of rows) if (row.policyArea) areaCounts.set(row.policyArea, (areaCounts.get(row.policyArea) ?? 0) + 1);

  return {
    kind: "member",
    entity,
    party: normalizeParty(rows.find((row) => row.party)?.party ?? ""),
    record: {
      total: rows.length,
      decisive: decisive.length,
      broke,
      missed: rows.filter((row) => row.position === "absent").length,
      partyLineRate: decisive.length ? 1 - broke / decisive.length : null,
    },
    policyAreas: [...areaCounts]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    votes: rows.slice(0, MEMBER_VOTE_LIMIT),
    sponsored: sponsoredPage.bills,
    sponsoredTotal: sponsoredPage.total,
    candidacies,
  };
}

// ---------------------------------------------------------------- race

export async function loadRaceDocket(electionId: string): Promise<RaceDocket | null> {
  const [election, candidacyRows, resultRows, ratings] = await Promise.all([
    getElection(electionId),
    listCandidaciesForElection(electionId),
    listResultsForElection(electionId),
    ratingHistory(electionId),
  ]);
  if (!election) return null;

  const candidateIds = candidacyRows.map((candidacy) => candidacy.candidateEntityId);
  const [candidateEntities, withVotes] = await Promise.all([
    getEntitiesByIds(candidateIds),
    entityIdsWithVotes(candidateIds),
  ]);
  const entityById = new Map(candidateEntities.map((entity) => [entity.id, entity]));
  const nameFor = (id: string) => entityById.get(id)?.name ?? "Unknown";
  const candidacies = dedupeCandidacies(candidacyRows, nameFor);

  const upcomingGeneral = election.status === "scheduled" && election.electionType === "general";
  const nominees = candidacies.filter(
    (c) => !c.withdrew && (c.status === "nominee" || c.status === "primary_winner"),
  );
  const active = upcomingGeneral
    ? nominees
    : candidacies.filter((c) => !c.withdrew && c.status !== "lost_primary");
  const others = candidacies.filter((c) => !active.includes(c));
  const cycle = election.cycle ?? new Date(election.electionDate).getUTCFullYear();

  const [financeRows, outside] = await Promise.all([
    Promise.all(active.map((c) => getCandidateFinanceForEntity(c.candidateEntityId, cycle))),
    outsideSpendingByCandidate(active.map((c) => c.candidateEntityId), cycle),
  ]);

  const toCandidate = (candidacy: Candidacy, finance: CandidateFinance | null = null): RaceCandidate => ({
    candidacy,
    name: normalizeCandidateName(nameFor(candidacy.candidateEntityId)),
    entity: entityById.get(candidacy.candidateEntityId) ?? null,
    finance,
    outside: outside.get(candidacy.candidateEntityId) ?? null,
    hasVotes: withVotes.has(candidacy.candidateEntityId),
  });

  return {
    kind: "race",
    election,
    cycle,
    upcomingGeneral,
    candidates: active
      .map((c, index) => toCandidate(c, financeRows[index]))
      .sort((a, b) => (b.candidacy.votes ?? 0) - (a.candidacy.votes ?? 0) || Number(b.candidacy.incumbent) - Number(a.candidacy.incumbent)),
    others: others.map((c) => toCandidate(c)),
    summary: summarizeCandidacies(candidacies),
    consensus: consensusRating(ratings.map((r) => ({ source: r.source, rating: r.rating, asOf: r.asOf }))),
    ratings,
    areas: areaBreakdowns(resultRows).sort((a, b) => b.total - a.total),
  };
}

// ---------------------------------------------------------------- discovery

export async function getWritDiscovery(): Promise<WritDiscovery> {
  const cycle = await latestCycle();
  const [billPage, raceGroups, voterRows, billCount, rollCallCount] = await Promise.all([
    searchBills({ pageSize: 8 }),
    cycle ? Promise.all((["senate", "governor", "house"] as const).map((office) => listRaces(cycle, office))) : [],
    db
      .select({ id: votes.voterEntityId, count: sql<number>`count(*)::int` })
      .from(votes)
      .where(isNotNull(votes.rollCallId))
      .groupBy(votes.voterEntityId)
      .orderBy(desc(sql`count(*)`))
      .limit(12),
    countBills(),
    countRollCalls(),
  ]);

  // Closest contests first: scheduled races ordered by how near the
  // consensus rating sits to a toss-up.
  const closeness = (race: RaceSummary) => (race.rating ? Math.abs(ratingLean(race.rating)) : 4);
  const races = raceGroups
    .flat()
    .filter((race) => race.status === "scheduled")
    .sort((a, b) => closeness(a) - closeness(b) || a.code.localeCompare(b.code))
    .slice(0, 12);

  const memberEntities = toRecord(await getEntitiesByIds(voterRows.map((row) => row.id)));
  return {
    recentBills: billPage.bills,
    races,
    cycle,
    members: voterRows
      .filter((row) => memberEntities[row.id])
      .map((row) => ({ entity: memberEntities[row.id], votes: row.count })),
    counts: { bills: billCount, rollCalls: rollCallCount },
  };
}

export async function loadWritDocket(selection: {
  bill?: string;
  member?: string;
  race?: string;
}): Promise<WritDocket | null> {
  if (selection.bill) return loadBillDocket(selection.bill);
  if (selection.member) return loadMemberDocket(selection.member);
  if (selection.race) return loadRaceDocket(selection.race);
  return null;
}
