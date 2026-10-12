// Everything the /legislation overview shows, assembled server-side:
// Congress (bills, roll calls), polarization (Voteview DW-NOMINATE), the
// Supreme Court (SCDB), and executive orders (Federal Register). Each
// section degrades to empty when its dataset hasn't been imported yet.

import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { searchBills } from "@/lib/db/bills";
import { getEntityNames } from "@/lib/neo4j/entities";
import type { Series, SeriesPoint } from "@/components/charts/time-series-chart";
import type { RankedItem } from "@/components/charts/ranked-bars";

async function rows<T>(query: ReturnType<typeof sql>): Promise<T[]> {
  return (await db.execute(query)).rows as T[];
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

// The Nth Congress convenes in January of 1787 + 2N.
const congressYear = (congress: number) => 1787 + 2 * congress;
const congressLabel = (congress: number) => `${ordinal(congress)} Congress (${congressYear(congress)})`;

// ---------------------------------------------------------------- Congress

export interface PartySplit {
  yea: number;
  nay: number;
}

export interface RollCallSummary {
  id: string;
  date: string;
  chamber: string;
  rollNumber: number;
  question: string;
  result: string;
  billId: string | null;
  billNumber: string | null;
  billTitle: string | null;
  dem: PartySplit;
  rep: PartySplit;
  other: PartySplit;
  partyLine: boolean; // most Democrats and most Republicans voted opposite ways
}

async function loadCongress() {
  const [{ bills, total: billCount }, rollCallRows] = await Promise.all([
    searchBills({ pageSize: 6 }),
    rows<{
      id: string;
      date: string;
      chamber: string;
      roll_number: number;
      question: string | null;
      result: string | null;
      bill_id: string | null;
      bill_number: string | null;
      bill_title: string | null;
      party: string | null;
      position: string;
      n: number;
    }>(sql`
      select r.id, r.date::text, r.chamber, r.roll_number, r.question, r.result,
             b.id as bill_id, b.bill_number, b.title as bill_title,
             v.party, v.position::text, count(*)::int as n
      from roll_calls r
      left join bills b on b.id = r.bill_id
      left join votes v on v.roll_call_id = r.id
      group by r.id, b.id, v.party, v.position
      order by r.date desc, r.roll_number desc`),
  ]);

  const byId = new Map<string, RollCallSummary>();
  for (const r of rollCallRows) {
    let rc = byId.get(r.id);
    if (!rc) {
      rc = {
        id: r.id,
        date: r.date,
        chamber: r.chamber,
        rollNumber: r.roll_number,
        question: r.question ?? "",
        result: r.result ?? "",
        billId: r.bill_id,
        billNumber: r.bill_number,
        billTitle: r.bill_title,
        dem: { yea: 0, nay: 0 },
        rep: { yea: 0, nay: 0 },
        other: { yea: 0, nay: 0 },
        partyLine: false,
      };
      byId.set(r.id, rc);
    }
    if (r.position !== "yea" && r.position !== "nay") continue;
    const side = r.party === "D" ? rc.dem : r.party === "R" ? rc.rep : rc.other;
    side[r.position] += r.n;
  }
  const rollCalls = [...byId.values()];
  for (const rc of rollCalls) {
    const dem = Math.sign(rc.dem.yea - rc.dem.nay);
    const rep = Math.sign(rc.rep.yea - rc.rep.nay);
    rc.partyLine = dem !== 0 && rep !== 0 && dem !== rep;
  }
  const withVotes = rollCalls.filter((rc) => rc.dem.yea + rc.dem.nay + rc.rep.yea + rc.rep.nay > 0);

  const sponsorNames = await getEntityNames([...new Set(bills.map((b) => b.sponsorEntityId).filter((id): id is string => !!id))]);
  return {
    billCount,
    latestBills: bills.map((b) => ({
      id: b.id,
      billNumber: b.billNumber,
      title: b.title,
      status: b.status,
      chamber: b.chamber,
      introducedDate: b.introducedDate,
      latestActionText: b.latestActionText,
      sponsor: (b.sponsorEntityId && sponsorNames.get(b.sponsorEntityId)) || null,
    })),
    rollCalls: withVotes.slice(0, 12),
    rollCallCount: rollCalls.length,
    partyLineShare: withVotes.length ? withVotes.filter((rc) => rc.partyLine).length / withVotes.length : null,
    rollCallSpan: rollCalls.length ? { first: rollCalls.at(-1)!.date, last: rollCalls[0].date } : null,
  };
}

// ------------------------------------------------------------ Polarization

export interface IdeologyBin {
  x0: number;
  dem: number;
  rep: number;
  other: number;
}

const BIN = 0.1;

async function loadPolarization() {
  const [means, current] = await Promise.all([
    rows<{ congress: number; chamber: string; party_code: number; mean: number }>(sql`
      select congress, chamber, party_code, avg(nominate_dim1)::float8 as mean
      from member_ideology
      where chamber in ('House', 'Senate') and party_code in (100, 200) and nominate_dim1 is not null
      group by 1, 2, 3 order by 1`),
    rows<{ chamber: string; party_code: number; bin: number; n: number }>(sql`
      select chamber, party_code, least(greatest(floor(nominate_dim1 / ${BIN})::int, -10), 9) as bin, count(*)::int as n
      from member_ideology
      where congress = (select max(congress) from member_ideology)
        and chamber in ('House', 'Senate') and nominate_dim1 is not null
      group by 1, 2, 3`),
  ]);

  const series = (chamber: string): Series[] =>
    (
      [
        [100, "dem", "Democrats", 1, "var(--viz-dem)"],
        [200, "rep", "Republicans", 2, "var(--viz-rep)"],
      ] as const
    ).map(([code, id, label, slot, color]) => ({
      id,
      label,
      slot,
      color,
      points: means
        .filter((m) => m.chamber === chamber && m.party_code === code)
        .map((m): SeriesPoint => ({ x: congressYear(m.congress), label: congressLabel(m.congress), value: Math.round(m.mean * 1000) / 1000 })),
    }));

  const gap = (chamber: string): Series[] => {
    const byCongress = new Map<number, { dem?: number; rep?: number }>();
    for (const m of means.filter((m) => m.chamber === chamber)) {
      const e = byCongress.get(m.congress) ?? {};
      if (m.party_code === 100) e.dem = m.mean;
      else e.rep = m.mean;
      byCongress.set(m.congress, e);
    }
    const points = [...byCongress.entries()]
      .filter(([, e]) => e.dem !== undefined && e.rep !== undefined)
      .map(([c, e]): SeriesPoint => ({ x: congressYear(c), label: congressLabel(c), value: Math.round((e.rep! - e.dem!) * 1000) / 1000 }));
    return [{ id: `gap-${chamber}`, label: chamber, slot: chamber === "House" ? 1 : 3, points }];
  };

  const histogram = (chamber: string): IdeologyBin[] => {
    const bins = new Map<number, IdeologyBin>();
    for (const r of current.filter((r) => r.chamber === chamber)) {
      const b = bins.get(r.bin) ?? { x0: Math.round(r.bin * BIN * 10) / 10, dem: 0, rep: 0, other: 0 };
      if (r.party_code === 100) b.dem += r.n;
      else if (r.party_code === 200) b.rep += r.n;
      else b.other += r.n;
      bins.set(r.bin, b);
    }
    return [...bins.values()].sort((a, b) => a.x0 - b.x0);
  };

  const latest = means.at(-1)?.congress ?? null;
  const houseGap = gap("House")[0].points;
  return {
    latestCongress: latest,
    latestLabel: latest ? `${ordinal(latest)} Congress` : "",
    house: series("House"),
    senate: series("Senate"),
    gap: [...gap("House"), ...gap("Senate")],
    histogram: { House: histogram("House"), Senate: histogram("Senate") },
    houseGapNow: houseGap.at(-1) ?? null,
    houseGapFirst: houseGap[0] ?? null,
  };
}

// ------------------------------------------------------------ Supreme Court

// SCDB justice codes for display. Unlisted codes fall back to the code.
const JUSTICES: Record<string, string> = {
  JGRoberts: "John Roberts",
  CThomas: "Clarence Thomas",
  SAAlito: "Samuel Alito",
  SSotomayor: "Sonia Sotomayor",
  EKagan: "Elena Kagan",
  NMGorsuch: "Neil Gorsuch",
  BMKavanaugh: "Brett Kavanaugh",
  ACBarrett: "Amy Coney Barrett",
  KBJackson: "Ketanji Brown Jackson",
  SGBreyer: "Stephen Breyer",
  RBGinsburg: "Ruth Bader Ginsburg",
  AMKennedy: "Anthony Kennedy",
  AScalia: "Antonin Scalia",
};

export interface CourtCase {
  decided: string | null;
  name: string;
  citation: string | null;
  issue: string | null;
  direction: string | null;
  majority: number | null;
  minority: number | null;
}

async function loadCourt() {
  const [terms, justices, issues, latest] = await Promise.all([
    rows<{ term: number; n: number; con: number; lib: number; unanimous: number; close: number }>(sql`
      select term, count(*)::int as n,
             count(*) filter (where decision_direction = 'conservative')::int as con,
             count(*) filter (where decision_direction = 'liberal')::int as lib,
             count(*) filter (where minority_votes = 0)::int as unanimous,
             count(*) filter (where majority_votes = 5 and minority_votes = 4)::int as close
      from court_cases where term is not null group by 1 order by 1`),
    rows<{ justice: string; first: number; votes: number; con: number; lib: number; majority: number }>(sql`
      select v.justice, min(c.term)::int as first, count(*)::int as votes,
             count(*) filter (where v.direction = 'conservative')::int as con,
             count(*) filter (where v.direction = 'liberal')::int as lib,
             count(*) filter (where v.in_majority)::int as majority
      from case_votes v join court_cases c on c.id = v.case_id
      where v.justice in (
        select distinct v2.justice from case_votes v2 join court_cases c2 on c2.id = v2.case_id
        where c2.term = (select max(term) from court_cases))
      group by 1`),
    rows<{ issue: string; n: number }>(sql`
      select issue_area as issue, count(*)::int as n from court_cases
      where issue_area is not null and term >= (select max(term) - 9 from court_cases)
      group by 1 order by 2 desc`),
    rows<CourtCase>(sql`
      select decision_date::text as decided, case_name as name, us_cite as citation, issue_area as issue,
             decision_direction as direction, majority_votes as majority, minority_votes as minority
      from court_cases order by decision_date desc nulls last, case_name limit 12`),
  ]);

  const point = (t: (typeof terms)[number], value: number): SeriesPoint => ({ x: t.term, label: `${t.term} term`, value });
  const last = terms.at(-1);
  const recent = terms.slice(-10);
  const sum = (k: "n" | "unanimous" | "close") => recent.reduce((s, t) => s + t[k], 0);

  return {
    latestTerm: last?.term ?? null,
    decisions: [{ id: "n", label: "Decisions", slot: 1, points: terms.map((t) => point(t, t.n)) }] as Series[],
    conservativeShare: [
      {
        id: "con",
        label: "Conservative outcome",
        slot: 2,
        color: "var(--viz-rep)",
        points: terms.filter((t) => t.con + t.lib > 0).map((t) => point(t, Math.round((t.con / (t.con + t.lib)) * 1000) / 10)),
      },
    ] as Series[],
    splits: [
      { id: "unanimous", label: "Unanimous", slot: 3, points: terms.map((t) => point(t, t.unanimous)) },
      { id: "divided", label: "Divided, not 5–4", slot: 1, points: terms.map((t) => point(t, t.n - t.unanimous - t.close)) },
      { id: "close", label: "5–4", slot: 2, points: terms.map((t) => point(t, t.close)) },
    ] as Series[],
    justices: justices
      .filter((j) => j.con + j.lib > 0)
      .map((j) => ({
        label: JUSTICES[j.justice] ?? j.justice,
        value: Math.round((j.con / (j.con + j.lib)) * 1000) / 10,
        note: `since the ${j.first} term · in the majority ${Math.round((j.majority / j.votes) * 100)}% of the time`,
      }))
      .sort((a, b) => b.value - a.value) as RankedItem[],
    issues: issues.map((i) => ({ label: i.issue, value: i.n })) as RankedItem[],
    issueWindow: recent.length ? `${recent[0].term}–${recent.at(-1)!.term} terms` : "",
    latest,
    stats: last
      ? {
          term: last.term,
          decisions: last.n,
          unanimousShare: last.n ? (last.unanimous / last.n) * 100 : null,
          closeShare: last.n ? (last.close / last.n) * 100 : null,
          conservativeShare: last.con + last.lib ? (last.con / (last.con + last.lib)) * 100 : null,
          decadeUnanimousShare: sum("n") ? (sum("unanimous") / sum("n")) * 100 : null,
          decadeCloseShare: sum("n") ? (sum("close") / sum("n")) * 100 : null,
        }
      : null,
  };
}

// --------------------------------------------------------------- Executive

// Trump's two non-consecutive terms are counted separately.
const presidentTerm = sql`case when president = 'Donald Trump' and coalesce(signing_date, publication_date) >= '2025-01-20'
  then 'Donald Trump (2nd term)' when president = 'Donald Trump' then 'Donald Trump (1st term)' else president end`;

async function loadExecutive() {
  const [perYear, byPresident, latest] = await Promise.all([
    rows<{ year: number; n: number }>(sql`
      select extract(year from coalesce(signing_date, publication_date))::int as year, count(*)::int as n
      from executive_documents where subtype = 'executive_order' and coalesce(signing_date, publication_date) >= '1994-01-01'
      group by 1 order by 1`),
    rows<{ president: string; n: number; first: string; last: string }>(sql`
      select ${presidentTerm} as president, count(*)::int as n,
             min(coalesce(signing_date, publication_date))::text as first, max(coalesce(signing_date, publication_date))::text as last
      from executive_documents where subtype = 'executive_order' and president is not null
      group by 1 order by min(coalesce(signing_date, publication_date))`),
    rows<{ eo: string | null; title: string; signed: string | null; url: string | null; president: string | null }>(sql`
      select eo_number as eo, title, coalesce(signing_date, publication_date)::text as signed, html_url as url, president
      from executive_documents where subtype = 'executive_order'
      order by coalesce(signing_date, publication_date) desc, eo_number desc nulls last limit 10`),
  ]);

  // Orders per year in office, so a partial first term isn't undercounted.
  const days = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
  const presidents = byPresident.map((p) => ({
    label: p.president,
    value: p.n,
    // The Federal Register's online record starts in 1994, a year into Clinton's first term.
    note: `${Math.round(p.n / Math.max(days(p.first, p.last) / 365.25, 0.25))} per year in office${p.first < "1994-01-01" ? " · from 1994" : ""}`,
  })) as RankedItem[];
  const current = byPresident.at(-1);

  return {
    perYear: [
      { id: "eo", label: "Executive orders", slot: 1, points: perYear.map((p) => ({ x: p.year, label: String(p.year), value: p.n })) },
    ] as Series[],
    presidents,
    latest,
    current: current ? { president: current.president, count: current.n, since: current.first } : null,
    firstYear: perYear[0]?.year ?? null,
  };
}

export async function loadLegislation() {
  const [congress, polarization, court, executive] = await Promise.all([
    loadCongress(),
    loadPolarization(),
    loadCourt(),
    loadExecutive(),
  ]);
  return { congress, polarization, court, executive };
}

export type LegislationOverview = Awaited<ReturnType<typeof loadLegislation>>;
