import { sql } from "drizzle-orm";
import { db } from "./client";
import { industryLabel } from "../money/industries";
import { US_STATE_GRID } from "../money/us-states";
import { getEntitiesByIds } from "../neo4j/entities";
import type { Entity } from "../validation/entity";

// Every aggregate behind the /money views, as grouped SQL. Campaign money
// and outside spending are scoped to one FEC election cycle; lobbying runs on
// its own reporting years. Entity ids are resolved to display names here, so
// pages never render a bare id (or an "Unknown").

export interface MoneyTotal {
  id: string;
  name: string;
  total: number;
  count: number;
}

export interface MonthTotal {
  month: string; // "2026-03"
  total: number;
  count: number;
}

export interface LabeledTotal {
  label: string;
  total: number;
  count: number;
}

export interface CampaignCandidate {
  entityId: string;
  name: string;
  party: string; // FEC code: DEM, REP, …
  office: string; // "S" | "H" | "P"
  state: string;
  district: string;
  incumbentChallenge: string;
  receipts: number;
  disbursements: number;
  cashOnHand: number;
  individual: number;
  pac: number;
  party_: number;
  coverageEnd: string; // ISO date of the latest report, or ""
  raceKey: string; // Race.key, or "" when not on this cycle's ballot
}

export interface Race {
  key: string;
  label: string; // "Georgia Senate"
  state: string;
  office: string;
  district: string;
  special: boolean;
  electionId: string | null;
  candidates: CampaignCandidate[]; // by receipts, largest first
  raised: number;
  support: number;
  oppose: number;
}

export interface OutsideTarget {
  name: string;
  entityId: string | null;
  party: string;
  state: string;
  office: string;
  district: string;
  raceKey: string; // Race.key, or "" when not on this cycle's ballot
  support: number;
  oppose: number;
}

export interface RecipientDonor {
  recipientId: string;
  donorName: string;
  industry: string;
  total: number;
  count: number;
}

export interface CampaignMoney {
  cycle: number | null;
  cycles: number[];
  asOf: string; // latest candidate report in the cycle
  candidates: CampaignCandidate[];
  races: Race[]; // by total money (raised + outside), largest first
  outside: {
    support: number;
    oppose: number;
    filings: number;
    groups: number;
    lastDate: string;
    targets: OutsideTarget[];
    spenders: LabeledTotal[];
  };
}

export interface ContributionSummary {
  window: { from: string; to: string } | null;
  totals: { amount: number; count: number; donors: number; recipients: number; firstDate: string; lastDate: string };
  byMonth: MonthTotal[];
  topRecipients: MoneyTotal[];
  topDonors: MoneyTotal[];
  industries: LabeledTotal[]; // classified only
  unclassified: { total: number; count: number };
  donorTypes: { type: string; total: number; count: number }[]; // raw contribution_type
  topDonorsByRecipient: RecipientDonor[];
  partyByEntity: Record<string, string>;
}

export interface LobbyingSummary {
  total: number;
  filings: number;
  clients: number;
  firms: number;
  years: number[];
  latestYear: number | null;
  topClients: MoneyTotal[];
  topFirms: MoneyTotal[];
  issues: LabeledTotal[]; // total = filings naming the issue
}

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0) || 0;
const str = (v: unknown) => (v == null ? "" : String(v));
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : "");
async function rows(query: ReturnType<typeof sql>): Promise<Row[]> {
  return (await db.execute(query)).rows as Row[];
}

// FEC names arrive as "LAST, FIRST MIDDLE" in capitals.
export function fecPersonName(raw: string): string {
  const [last, first] = raw.split(",").map((s) => s.trim());
  const name = first ? `${first} ${last}` : raw;
  return name.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

// Candidates created by the FEC importers keep FEC's "LAST, FIRST" capitals.
export function entityDisplayName(e: Entity): string {
  return e.type === "politician" && e.name === e.name.toUpperCase() ? fecPersonName(e.name) : e.name;
}

async function namesFor(ids: string[]): Promise<Map<string, string>> {
  const entities = await getEntitiesByIds(ids);
  return new Map(entities.map((e) => [e.id, entityDisplayName(e)]));
}

const STATE_NAMES = new Map(US_STATE_GRID.map((s) => [s.abbr, s.name]));
const STATE_ABBRS = new Map(US_STATE_GRID.map((s) => [s.name, s.abbr]));
const officeCode = (office: string) => (/senate/i.test(office) ? "S" : /house/i.test(office) ? "H" : /president/i.test(office) ? "P" : office);
export const stateName = (abbr: string) => STATE_NAMES.get(abbr) ?? abbr;

function seatLabel(state: string, office: string, district: string): string {
  const seat =
    office === "S" ? "Senate" : office === "H" ? (district && district !== "00" ? `House District ${Number(district)}` : "House At-Large") : office === "P" ? "President" : office;
  return [stateName(state), seat].filter(Boolean).join(" ");
}
const seatKey = (state: string, office: string, district: string) => `${state}-${office}-${office === "H" ? district || "00" : "00"}`;

// FEC two-year cycle window: the 2026 cycle is 2025-01-01 … 2026-12-31.
export function cycleWindow(cycle: number) {
  return { from: `${cycle - 1}-01-01`, to: `${cycle}-12-31` };
}

export async function listMoneyCycles(): Promise<number[]> {
  const r = await rows(sql`select cycle c from candidate_finance union select cycle from independent_expenditures order by 1 desc`);
  return r.map((x) => num(x.c)).filter(Boolean);
}

// ?cycle=2024 when that cycle has data, otherwise the latest.
export function resolveCycle(requested: string | string[] | undefined, cycles: number[]): number | null {
  const n = Number(Array.isArray(requested) ? requested[0] : requested);
  return cycles.includes(n) ? n : (cycles[0] ?? null);
}

export async function loadCampaignMoney(cycle: number | null): Promise<CampaignMoney> {
  const cycles = await listMoneyCycles();
  const empty: CampaignMoney = {
    cycle,
    cycles,
    asOf: "",
    candidates: [],
    races: [],
    outside: { support: 0, oppose: 0, filings: 0, groups: 0, lastDate: "", targets: [], spenders: [] },
  };
  if (cycle == null) return empty;

  const [finRows, electionRows, candidacyRows, ieRows, spenderRows, ieTotals] = await Promise.all([
    rows(sql`select entity_id, party, office, state, district, incumbent_challenge,
                    total_receipts, total_disbursements, cash_on_hand,
                    individual_contributions, pac_contributions, party_contributions, coverage_end_date
             from candidate_finance where cycle = ${cycle}
             order by total_receipts desc nulls last`),
    rows(sql`select id, jurisdiction, office, election_type from elections
             where cycle = ${cycle} and election_type in ('general', 'special')`),
    // Every candidacy (any cycle) of the campaigns filing this cycle.
    rows(sql`select ca.candidate_entity_id eid, e.id, e.cycle, e.office, e.jurisdiction, e.election_type
             from candidacies ca join elections e on e.id = ca.election_id
             where ca.candidate_entity_id in (select entity_id from candidate_finance where cycle = ${cycle})`),
    rows(sql`select candidate_name, max(candidate_entity_id::text) eid, max(candidate_party) party,
                    max(candidate_state) state, max(candidate_office) office, max(candidate_district) district,
                    sum(case when support_oppose = 'S' then amount else 0 end) support,
                    sum(case when support_oppose = 'O' then amount else 0 end) oppose
             from independent_expenditures
             where cycle = ${cycle} and candidate_name is not null
             group by 1 order by sum(amount) desc`),
    rows(sql`select committee_name k, sum(amount) total, count(*) n from independent_expenditures
             where cycle = ${cycle} and committee_name is not null
             group by 1 order by 2 desc limit 15`),
    rows(sql`select count(*) n, count(distinct committee_id) groups, max(expenditure_date) last
             from independent_expenditures where cycle = ${cycle}`),
  ]);

  const names = await namesFor(finRows.map((r) => str(r.entity_id)));

  // One row per campaign; a candidate filed under two FEC ids is merged.
  const byEntity = new Map<string, CampaignCandidate>();
  let asOf = "";
  for (const r of finRows) {
    const id = str(r.entity_id);
    const end = iso(r.coverage_end_date);
    if (end > asOf) asOf = end;
    const prev = byEntity.get(id);
    if (prev) {
      prev.receipts += num(r.total_receipts);
      prev.disbursements += num(r.total_disbursements);
      prev.cashOnHand += num(r.cash_on_hand);
      prev.individual += num(r.individual_contributions);
      prev.pac += num(r.pac_contributions);
      prev.party_ += num(r.party_contributions);
      continue;
    }
    byEntity.set(id, {
      entityId: id,
      name: names.get(id) ?? "Unnamed candidate",
      party: str(r.party),
      office: str(r.office),
      state: str(r.state),
      district: str(r.district),
      incumbentChallenge: str(r.incumbent_challenge),
      receipts: num(r.total_receipts),
      disbursements: num(r.total_disbursements),
      cashOnHand: num(r.cash_on_hand),
      individual: num(r.individual_contributions),
      pac: num(r.pac_contributions),
      party_: num(r.party_contributions),
      coverageEnd: end,
      raceKey: "",
    });
  }
  const candidates = [...byEntity.values()].sort((a, b) => b.receipts - a.receipts);

  // Place each campaign in this cycle's race. A candidacy only counts when
  // its office matches the FEC filing (a House nominee's entity can't put a
  // Senate committee into a House race). A campaign whose candidacies are
  // all in other cycles (a sitting senator not up this year) is in no race.
  // Otherwise a Senate campaign joins its state's only Senate election, and
  // anything left falls back to a state/office/district seat key.
  const elections = new Map(
    electionRows.map((r) => [
      str(r.id),
      { office: officeCode(str(r.office)), state: STATE_ABBRS.get(str(r.jurisdiction)) ?? "", special: str(r.election_type) === "special" },
    ]),
  );
  const senateByState = new Map<string, string[]>();
  const seatToRace = new Map<string, string>();
  for (const [id, e] of elections) {
    if (e.office !== "S" || !e.state) continue;
    senateByState.set(e.state, [...(senateByState.get(e.state) ?? []), id]);
    if (!e.special) seatToRace.set(seatKey(e.state, "S", "00"), id);
  }
  const candidaciesOf = new Map<string, Row[]>();
  for (const r of candidacyRows) candidaciesOf.set(str(r.eid), [...(candidaciesOf.get(str(r.eid)) ?? []), r]);

  for (const c of candidates) {
    const all = candidaciesOf.get(c.entityId) ?? [];
    const match = all
      .filter((r) => elections.has(str(r.id)) && officeCode(str(r.office)) === c.office)
      .sort((a, b) => Number(str(b.election_type) === "general") - Number(str(a.election_type) === "general"))[0];
    if (match) {
      c.raceKey = str(match.id);
      if (c.office === "H") seatToRace.set(seatKey(c.state, c.office, c.district), c.raceKey);
    } else if (all.length > 0 && all.every((r) => num(r.cycle) !== cycle)) {
      c.raceKey = "";
    } else if (c.office === "S" && senateByState.get(c.state)?.length === 1) {
      c.raceKey = senateByState.get(c.state)![0];
    } else {
      c.raceKey = seatKey(c.state, c.office, c.district);
    }
  }

  const races = new Map<string, Race>();
  for (const c of candidates) {
    if (!c.raceKey) continue;
    c.raceKey = seatToRace.get(c.raceKey) ?? c.raceKey;
    let race = races.get(c.raceKey);
    if (!race) {
      const election = elections.get(c.raceKey);
      race = {
        key: c.raceKey,
        label: `${seatLabel(c.state, c.office, c.district)}${election?.special ? " (special)" : ""}`,
        state: c.state,
        office: c.office,
        district: c.district,
        special: election?.special ?? false,
        electionId: election ? c.raceKey : null,
        candidates: [],
        raised: 0,
        support: 0,
        oppose: 0,
      };
      races.set(c.raceKey, race);
    }
    race.candidates.push(c);
    race.raised += c.receipts;
  }

  const targets: OutsideTarget[] = ieRows.map((r) => {
    const entityId = str(r.eid) || null;
    const state = str(r.state);
    const office = str(r.office);
    const district = str(r.district);
    const known = entityId ? byEntity.get(entityId) : undefined;
    const fallback = seatKey(state, office, district);
    return {
      name: known?.name ?? fecPersonName(str(r.candidate_name)),
      entityId,
      party: str(r.party) || known?.party || "",
      state,
      office,
      district,
      raceKey: known?.raceKey || (seatToRace.get(fallback) ?? fallback),
      support: num(r.support),
      oppose: num(r.oppose),
    };
  });
  for (const t of targets) {
    let race = races.get(t.raceKey);
    if (!race) {
      race = {
        key: t.raceKey,
        label: seatLabel(t.state, t.office, t.district),
        state: t.state,
        office: t.office,
        district: t.district,
        special: false,
        electionId: null,
        candidates: [],
        raised: 0,
        support: 0,
        oppose: 0,
      };
      races.set(t.raceKey, race);
    }
    race.support += t.support;
    race.oppose += t.oppose;
  }

  return {
    cycle,
    cycles,
    asOf,
    candidates,
    races: [...races.values()].sort((a, b) => b.raised + b.support + b.oppose - (a.raised + a.support + a.oppose)),
    outside: {
      support: targets.reduce((s, t) => s + t.support, 0),
      oppose: targets.reduce((s, t) => s + t.oppose, 0),
      filings: num(ieTotals[0]?.n),
      groups: num(ieTotals[0]?.groups),
      lastDate: iso(ieTotals[0]?.last),
      targets,
      spenders: spenderRows.map((r) => ({ label: str(r.k), total: num(r.total), count: num(r.n) })),
    },
  };
}

export async function loadContributionSummary(cycle: number | null): Promise<ContributionSummary> {
  const window = cycle == null ? null : cycleWindow(cycle);
  const inWindow = window && cycle != null ? sql`and date >= ${window.from} and date < ${`${cycle + 1}-01-01`}` : sql``;
  const [totalsRows, monthRows, recipientRows, donorRows, industryRows, typeRows, recipientDonorRows, partyRows] = await Promise.all([
    rows(sql`select coalesce(sum(amount),0) amount, count(*) n,
                    count(distinct donor_entity_id) donors, count(distinct recipient_entity_id) recipients,
                    min(date) first, max(date) last
             from contributions where currency = 'USD' ${inWindow}`),
    rows(sql`select to_char(date_trunc('month', date), 'YYYY-MM') m, sum(amount) total, count(*) n
             from contributions where currency = 'USD' ${inWindow}
             group by 1 order by 1`),
    rows(sql`select recipient_entity_id id, sum(amount) total, count(*) n from contributions
             where currency = 'USD' ${inWindow} group by 1 order by 2 desc limit 25`),
    rows(sql`select donor_entity_id id, sum(amount) total, count(*) n from contributions
             where currency = 'USD' ${inWindow} group by 1 order by 2 desc limit 25`),
    rows(sql`select donor_industry k, sum(amount) total, count(*) n from contributions
             where currency = 'USD' ${inWindow} group by 1 order by 2 desc`),
    rows(sql`select contribution_type k, sum(amount) total, count(*) n from contributions
             where currency = 'USD' ${inWindow} group by 1 order by 2 desc`),
    rows(sql`select rid, did, ind, total, n from (
               select recipient_entity_id rid, donor_entity_id did, max(donor_industry) ind,
                      sum(amount) total, count(*) n,
                      row_number() over (partition by recipient_entity_id order by sum(amount) desc) rk
               from contributions where currency = 'USD' ${inWindow} group by 1, 2
             ) t where rk <= 8`),
    rows(sql`select distinct on (entity_id) entity_id id, party from candidate_finance order by entity_id, cycle desc`),
  ]);

  const names = await namesFor([
    ...recipientRows.map((r) => str(r.id)),
    ...donorRows.map((r) => str(r.id)),
    ...recipientDonorRows.map((r) => str(r.did)),
  ]);
  const nameOf = (id: string) => names.get(id) ?? "Unnamed committee";
  const moneyTotal = (r: Row): MoneyTotal => ({ id: str(r.id), name: nameOf(str(r.id)), total: num(r.total), count: num(r.n) });
  const t = totalsRows[0] ?? {};
  const unclassified = industryRows.find((r) => !r.k);

  return {
    window,
    totals: {
      amount: num(t.amount),
      count: num(t.n),
      donors: num(t.donors),
      recipients: num(t.recipients),
      firstDate: iso(t.first),
      lastDate: iso(t.last),
    },
    byMonth: monthRows.map((r) => ({ month: str(r.m), total: num(r.total), count: num(r.n) })),
    topRecipients: recipientRows.map(moneyTotal),
    topDonors: donorRows.map(moneyTotal),
    industries: industryRows.filter((r) => r.k).map((r) => ({ label: industryLabel(str(r.k)), total: num(r.total), count: num(r.n) })),
    unclassified: { total: num(unclassified?.total), count: num(unclassified?.n) },
    donorTypes: typeRows.map((r) => ({ type: str(r.k), total: num(r.total), count: num(r.n) })),
    topDonorsByRecipient: recipientDonorRows.map((r) => ({
      recipientId: str(r.rid),
      donorName: nameOf(str(r.did)),
      industry: r.ind ? industryLabel(str(r.ind)) : "",
      total: num(r.total),
      count: num(r.n),
    })),
    partyByEntity: Object.fromEntries(partyRows.map((r) => [str(r.id), str(r.party)])),
  };
}

export async function loadLobbyingSummary(): Promise<LobbyingSummary> {
  const [totals, clients, firms, issues] = await Promise.all([
    rows(sql`select coalesce(sum(amount),0) total, count(*) n, count(distinct client_entity_id) clients,
                    count(distinct registrant_entity_id) firms, array_agg(distinct year) years
             from lobbying_registrations`),
    rows(sql`select client_entity_id id, sum(amount) total, count(*) n from lobbying_registrations
             group by 1 order by 2 desc nulls last limit 15`),
    rows(sql`select registrant_entity_id id, sum(amount) total, count(*) n from lobbying_registrations
             group by 1 order by 2 desc nulls last limit 15`),
    rows(sql`select coalesce(nullif(issue_label, ''), issue_code) k, count(distinct registration_id) n
             from lobbying_issues where coalesce(nullif(issue_label, ''), issue_code) is not null
             group by 1 order by 2 desc limit 15`),
  ]);
  const names = await namesFor([...clients, ...firms].map((r) => str(r.id)));
  // A ranking row whose client or firm can't be named is dropped rather
  // than shown as "Unknown".
  const named = (list: Row[]): MoneyTotal[] =>
    list
      .filter((r) => names.has(str(r.id)) && num(r.total) > 0)
      .map((r) => ({ id: str(r.id), name: names.get(str(r.id))!, total: num(r.total), count: num(r.n) }));
  const years = ((totals[0]?.years as number[] | null) ?? []).filter((y) => y != null).map(Number).sort();
  return {
    total: num(totals[0]?.total),
    filings: num(totals[0]?.n),
    clients: num(totals[0]?.clients),
    firms: num(totals[0]?.firms),
    years,
    latestYear: years.at(-1) ?? null,
    topClients: named(clients),
    topFirms: named(firms),
    issues: issues.map((r) => ({ label: str(r.k), total: num(r.n), count: num(r.n) })),
  };
}
