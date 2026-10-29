// Everything /israel shows that comes from the database: aid by fiscal year
// (crs-israel-aid, in current and inflation-adjusted dollars), goods trade
// with Israel and comparison partners (census-trade), UN votes (un-votes),
// money from the advocacy groups in INFLUENCE_GROUPS (money_flows), their
// lobbying (lobbying_registrations), and each member's vote on KEY_VOTES
// (roll_calls + votes). Hand-kept records are in ./records.

import { sql } from "drizzle-orm";
import type { Series, SeriesPoint } from "@/components/charts/time-series-chart";
import type { RankedItem } from "@/components/charts/ranked-bars";
import { db } from "@/lib/db/client";
import { datasetCoverage, getSeries, getSeriesMany, listDatasets, type Point } from "@/lib/db/stats";
import { dbFor } from "@/lib/db/stores";
import { fecPersonName } from "@/lib/db/moneyOverview";
import { publicEntityPath } from "@/lib/people/public";
import { INFLUENCE_GROUPS, KEY_VOTES, LOBBYING_CLIENTS } from "./records";

const AID = "crs-israel-aid";
const TRADE = "census-trade";
const UN = "un-votes";

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0) || 0;
const str = (v: unknown) => (v == null ? "" : String(v));
async function rows(query: ReturnType<typeof sql>, source?: string): Promise<Row[]> {
  return ((await (source ? await dbFor(source) : db).execute(query)).rows ?? []) as Row[];
}

const textArray = (values: string[]) => sql`${`{${values.map((v) => `"${v.replaceAll('"', '\\"')}"`).join(",")}}`}::text[]`;

const fyX = (period: string) => Number(period.replace(/^FY/, ""));
const fySeries = (points: Point[] | undefined, adjust: (fy: number) => number = () => 1): SeriesPoint[] =>
  (points ?? []).map((p) => ({ x: fyX(p.period), label: p.period.replace(/^FY/, "FY "), value: p.value * adjust(fyX(p.period)) }));

export const PRESIDENTS: { name: string; party: "D" | "R"; from: number; to: number }[] = [
  { name: "Truman", party: "D", from: 1949, to: 1953 },
  { name: "Eisenhower", party: "R", from: 1954, to: 1961 },
  { name: "Kennedy", party: "D", from: 1962, to: 1964 },
  { name: "Johnson", party: "D", from: 1965, to: 1969 },
  { name: "Nixon", party: "R", from: 1970, to: 1975 },
  { name: "Ford", party: "R", from: 1976, to: 1977 },
  { name: "Carter", party: "D", from: 1978, to: 1981 },
  { name: "Reagan", party: "R", from: 1982, to: 1989 },
  { name: "G.H.W. Bush", party: "R", from: 1990, to: 1993 },
  { name: "Clinton", party: "D", from: 1994, to: 2001 },
  { name: "G.W. Bush", party: "R", from: 2002, to: 2009 },
  { name: "Obama", party: "D", from: 2010, to: 2017 },
  { name: "Trump", party: "R", from: 2018, to: 2021 },
  { name: "Biden", party: "D", from: 2022, to: 2025 },
  { name: "Trump", party: "R", from: 2026, to: 2029 },
];
// Fiscal years are credited to the president whose budget they were (a
// president's first FY is the one starting the October after inauguration).

// Who was in office for most of each calendar year.
export const IN_OFFICE: [from: number, name: string][] = [
  [1945, "Truman"], [1953, "Eisenhower"], [1961, "Kennedy"], [1964, "Johnson"], [1969, "Nixon"], [1975, "Ford"], [1977, "Carter"],
  [1981, "Reagan"], [1989, "G.H.W. Bush"], [1993, "Clinton"], [2001, "G.W. Bush"], [2009, "Obama"], [2017, "Trump"], [2021, "Biden"], [2025, "Trump"],
];
export const inOffice = (year: number) => IN_OFFICE.findLast(([from]) => year >= from)?.[1] ?? "";

export interface UnVote {
  symbol: string;
  date: string;
  title: string;
  body: string;
  us: number | null;
  israel: number | null;
  yes: number;
  no: number;
  abstain: number;
}

export interface MemberVotes {
  id: string;
  name: string;
  party: string;
  chamber: string;
  href: string;
  votes: Record<string, string>; // KEY_VOTES id → yea | nay | present | absent
  received: number; // from INFLUENCE_GROUPS committees, all cycles loaded
  supportedBy: number; // independent expenditures for them
  opposedBy: number; // independent expenditures against them
}

export async function loadIsrael() {
  const committees = INFLUENCE_GROUPS.flatMap((g) => g.committees);
  const [aid, cpi, datasets, groupTotals, targets, lobbying, voteRows, partyRows] = await Promise.all([
    getSeriesMany(AID, ["total", "military", "economic", "missile_defense", "md_arrow", "md_arrow_3", "md_davids_sling", "md_iron_dome", "md_iron_beam"], "country", "ISR"),
    getSeries("fred-economy", "cpi"),
    listDatasets({ topic: "foreign-relations" }),
    rows(sql`select committee_id, cycle, kind, sum(total) total, count(*) n from money_flows
             where committee_id = any(${textArray(committees)}) group by 1, 2, 3`),
    // Every candidate these committees gave to or spent on, with the entity
    // their FEC id resolves to.
    rows(sql`select mf.committee_id, mf.candidate_id, mf.kind, mf.cycle, mf.total,
                    c.name fec_name, c.party, c.office, c.state, c.district,
                    e.id entity_id, e.name entity_name
             from money_flows mf
             left join fec_candidates c on c.candidate_id = mf.candidate_id
             left join entity_identifiers i on i.scheme = 'fec_candidate' and i.value = mf.candidate_id
             left join entities e on e.id = i.entity_id
             where mf.committee_id = any(${textArray(committees)})`),
    rows(sql`select upper(c.name) client, r.year, sum(r.amount) total, count(*) n
             from lobbying_registrations r join entities c on c.id = r.client_entity_id
             where upper(c.name) = any(${textArray(LOBBYING_CLIENTS.map(([, client]) => client))})
             group by 1, 2 order by 2`),
    rows(sql`select rc.external_id, v.position, v.party, e.id, e.name, rc.chamber
             from roll_calls rc join votes v on v.roll_call_id = rc.id join entities e on e.id = v.voter_entity_id
             where rc.external_id = any(${textArray(KEY_VOTES.map((v) => v.id))})`),
    rows(sql`select rc.external_id, v.party, v.position, count(*) n
             from roll_calls rc join votes v on v.roll_call_id = rc.id
             where rc.external_id = any(${textArray(KEY_VOTES.map((v) => v.id))}) group by 1, 2, 3`),
  ]);
  if (!aid.total?.length) return null;

  // ---- Aid, nominal and in dollars of the latest fiscal year (FY CPI average).
  const fyCpi = new Map<number, number[]>();
  for (const p of cpi) {
    const [y, m] = p.period.split("-").map(Number);
    const fy = m >= 10 ? y + 1 : y;
    fyCpi.set(fy, [...(fyCpi.get(fy) ?? []), p.value]);
  }
  const cpiAvg = new Map([...fyCpi].filter(([, v]) => v.length === 12).map(([fy, v]) => [fy, v.reduce((a, b) => a + b, 0) / 12]));
  const lastFy = fyX(aid.total.at(-1)!.period);
  const baseFy = cpiAvg.has(lastFy) ? lastFy : Math.max(...cpiAvg.keys());
  const real = (fy: number) => (cpiAvg.has(fy) ? cpiAvg.get(baseFy)! / cpiAvg.get(fy)! : NaN);

  const stack = (adjust?: (fy: number) => number): Series[] => [
    { id: "military", label: "Military aid", slot: 1, points: fySeries(aid.military, adjust) },
    { id: "missile_defense", label: "Missile defense", slot: 2, points: fySeries(aid.missile_defense, adjust) },
    { id: "economic", label: "Economic aid", slot: 3, points: fySeries(aid.economic, adjust) },
  ];
  const sum = (pts: Point[], adjust: (fy: number) => number = () => 1) => pts.reduce((s, p) => s + p.value * adjust(fyX(p.period)), 0);
  const totalNominal = sum(aid.total);
  const totalReal = sum(aid.total, real);
  const at = (pts: Point[], fy: number) => pts.find((p) => p.period === `FY${fy}`)?.value ?? 0;

  const byPresident = PRESIDENTS.flatMap((p) => {
    const pts = aid.total.filter((a) => fyX(a.period) >= p.from && fyX(a.period) <= p.to);
    if (!pts.length) return [];
    const years = pts.length;
    return [{ ...p, years, nominal: sum(pts), real: sum(pts, real), perYearReal: sum(pts, real) / years, lastFy: fyX(pts.at(-1)!.period) }];
  });

  const missileDefense: RankedItem[] = [
    ["md_iron_dome", "Iron Dome"],
    ["md_davids_sling", "David's Sling"],
    ["md_arrow", "Arrow II"],
    ["md_arrow_3", "Arrow III"],
    ["md_iron_beam", "Iron Beam"],
  ]
    .map(([k, label]) => ({ label, value: sum(aid[k] ?? []), note: "FY2006 onward" }))
    .sort((a, b) => b.value - a.value);

  // ---- Trade with Israel and comparison partners (calendar years).
  const partners = ["ISR", "EGY", "JOR", "SAU", "UKR", "TWN"] as const;
  const tradeByPartner = await Promise.all(partners.map((iso) => getSeriesMany(TRADE, ["exports", "imports", "balance"], "country", iso)));
  const annual = (pts: Point[]) => pts.filter((p) => /^\d{4}$/.test(p.period) && (p.metadata?.months ?? 12) === 12);
  const israelTrade = tradeByPartner[0];
  const yearSeries = (pts: Point[]) => annual(pts).map((p) => ({ x: Number(p.period), label: p.period, value: p.value }));
  const trade: Series[] = [
    { id: "exports", label: "U.S. exports to Israel", slot: 1, points: yearSeries(israelTrade.exports) },
    { id: "imports", label: "U.S. imports from Israel", slot: 3, points: yearSeries(israelTrade.imports) },
  ];
  const tradeBalance: Series[] = [{ id: "balance", label: "U.S. balance with Israel", slot: 1, points: yearSeries(israelTrade.balance) }];
  const latestTradeYear = annual(israelTrade.exports).at(-1)?.period ?? null;
  const partial = israelTrade.exports.filter((p) => /^\d{4}$/.test(p.period)).at(-1);
  const NAMES: Record<string, string> = { ISR: "Israel", EGY: "Egypt", JOR: "Jordan", SAU: "Saudi Arabia", UKR: "Ukraine", TWN: "Taiwan" };
  const tradeCompare = partners.map((iso, i) => {
    const t = tradeByPartner[i];
    const exp = annual(t.exports).find((p) => p.period === latestTradeYear)?.value ?? null;
    const imp = annual(t.imports).find((p) => p.period === latestTradeYear)?.value ?? null;
    return { iso, name: NAMES[iso], exports: exp, imports: imp, total: exp !== null && imp !== null ? exp + imp : null };
  }).sort((a, b) => (b.total ?? 0) - (a.total ?? 0));

  // ---- UN votes: General Assembly agreement between the U.S. and Israel.
  const unRows = await rows(
    sql`select geoid, period, period_start, value, metadata->>'title' title, metadata->>'body' body,
               (metadata->>'yes')::int yes, (metadata->>'no')::int no_, (metadata->>'abstain')::int abstain
        from area_stats where source = ${UN} and metric = 'vote' and geo_level = 'country' and geoid in ('USA', 'ISR')`,
    UN,
  );
  const unBySymbol = new Map<string, UnVote>();
  for (const r of unRows) {
    const symbol = str(r.period);
    const v = unBySymbol.get(symbol) ?? {
      symbol,
      date: str(r.period_start).slice(0, 10),
      title: str(r.title),
      body: str(r.body),
      us: null,
      israel: null,
      yes: num(r.yes),
      no: num(r.no_),
      abstain: num(r.abstain),
    };
    if (r.geoid === "USA") v.us = num(r.value);
    else v.israel = num(r.value);
    unBySymbol.set(symbol, v);
  }
  const unVotes = [...unBySymbol.values()].sort((a, b) => b.date.localeCompare(a.date));
  const ga = unVotes.filter((v) => v.body === "General Assembly" && v.us !== null && v.israel !== null);
  const byDecade = new Map<number, { both: number; same: number; usNoIsraelNo: number; usNo: number }>();
  for (const v of ga) {
    const d = Math.floor(Number(v.date.slice(0, 4)) / 5) * 5;
    const b = byDecade.get(d) ?? { both: 0, same: 0, usNoIsraelNo: 0, usNo: 0 };
    b.both++;
    if (v.us === v.israel) b.same++;
    if (v.us === -1) b.usNo++;
    if (v.us === -1 && v.israel === -1) b.usNoIsraelNo++;
    byDecade.set(d, b);
  }
  const unAgreement: Series[] = [
    {
      id: "same",
      label: "U.S. voted the same as Israel",
      slot: 1,
      points: [...byDecade]
        .filter(([, b]) => b.both >= 10)
        .sort((a, b) => a[0] - b[0])
        .map(([d, b]) => ({ x: d, label: `${d}–${d + 4}`, value: (b.same / b.both) * 100 })),
    },
  ];
  const unWorld = ga.length
    ? {
        votes: ga.length,
        usNoShare: (ga.filter((v) => v.us === -1).length / ga.length) * 100,
        isolated: ga.filter((v) => v.us === -1 && v.no <= 10).length,
        since: ga.at(-1)!.date.slice(0, 4),
      }
    : null;

  // ---- Influence: each group's totals by cycle, and who it backed or opposed.
  const groupOf = new Map(INFLUENCE_GROUPS.flatMap((g) => g.committees.map((c) => [c, g.short])));
  const cycles = [...new Set(groupTotals.map((r) => num(r.cycle)))].sort();
  const groups = INFLUENCE_GROUPS.map((g) => {
    const mine = groupTotals.filter((r) => groupOf.get(str(r.committee_id)) === g.short);
    const total = (kind: string, cycle?: number) =>
      mine.filter((r) => r.kind === kind && (cycle === undefined || num(r.cycle) === cycle)).reduce((s, r) => s + num(r.total), 0);
    return {
      ...g,
      contributions: total("contribution"),
      support: total("ie_support"),
      oppose: total("ie_oppose"),
      byCycle: cycles.map((c) => ({ cycle: c, contributions: total("contribution", c), support: total("ie_support", c), oppose: total("ie_oppose", c) })),
    };
  });

  type Field = "contributions" | "support" | "oppose";
  const recipients = new Map<string, { name: string; party: string; office: string; state: string; href: string | null; contributions: number; support: number; oppose: number; groups: Record<Field, Set<string>> }>();
  for (const r of targets) {
    const key = str(r.entity_id) || str(r.candidate_id);
    const raw = str(r.entity_name) || str(r.fec_name);
    // FEC-created entities keep FEC's "LAST, FIRST" capitals.
    const name = (raw && raw === raw.toUpperCase() ? fecPersonName(raw) : raw) || str(r.candidate_id);
    const t = recipients.get(key) ?? {
      name,
      party: str(r.party),
      office: str(r.office),
      state: str(r.state) + (r.office === "H" && r.district ? `-${str(r.district)}` : ""),
      href: r.entity_id ? publicEntityPath({ id: str(r.entity_id), name: str(r.entity_name) }) : null,
      contributions: 0,
      support: 0,
      oppose: 0,
      groups: { contributions: new Set<string>(), support: new Set<string>(), oppose: new Set<string>() },
    };
    const field: Field | null = r.kind === "contribution" ? "contributions" : r.kind === "ie_support" ? "support" : r.kind === "ie_oppose" ? "oppose" : null;
    if (!field) continue;
    t[field] += num(r.total);
    t.groups[field].add(groupOf.get(str(r.committee_id)) ?? "");
    recipients.set(key, t);
  }
  const people = [...recipients.entries()].map(([key, t]) => ({
    key,
    ...t,
    groups: Object.fromEntries(Object.entries(t.groups).map(([f, s]) => [f, [...s].filter(Boolean)])) as Record<Field, string[]>,
  }));
  const topOpposed = people.filter((p) => p.oppose > 0).sort((a, b) => b.oppose - a.oppose).slice(0, 8);
  const topSupported = people.filter((p) => p.support > 0).sort((a, b) => b.support - a.support).slice(0, 8);
  const topContributions = people.filter((p) => p.contributions > 0).sort((a, b) => b.contributions - a.contributions).slice(0, 8);

  // ---- Key votes, by party and by member.
  const partySplit = Object.fromEntries(
    KEY_VOTES.map((kv) => {
      const mine = partyRows.filter((r) => r.external_id === kv.id);
      const count = (party: string, position: string) => mine.filter((r) => r.party === party && r.position === position).reduce((s, r) => s + num(r.n), 0);
      return [kv.id, { D: { yea: count("D", "yea"), nay: count("D", "nay") }, R: { yea: count("R", "yea"), nay: count("R", "nay") }, I: { yea: count("I", "yea"), nay: count("I", "nay") } }];
    }),
  );
  const moneyByEntity = new Map(people.filter((p) => p.href).map((p) => [p.key, p]));
  const members = new Map<string, MemberVotes>();
  for (const r of voteRows) {
    const id = str(r.id);
    const m = members.get(id) ?? {
      id,
      name: str(r.name),
      party: str(r.party),
      chamber: str(r.chamber),
      href: publicEntityPath({ id, name: str(r.name) }),
      votes: {},
      received: moneyByEntity.get(id)?.contributions ?? 0,
      supportedBy: moneyByEntity.get(id)?.support ?? 0,
      opposedBy: moneyByEntity.get(id)?.oppose ?? 0,
    };
    m.votes[str(r.external_id)] = str(r.position);
    if (r.chamber === "Senate") m.chamber = "Senate";
    members.set(id, m);
  }

  const cov = await datasetCoverage(datasets.map((d) => d.slug));
  return {
    aid: {
      nominal: stack(),
      real: stack(real),
      totalNominal,
      totalReal,
      baseFy,
      firstFy: fyX(aid.total[0].period),
      lastFy,
      latest: { total: at(aid.total, lastFy), military: at(aid.military, lastFy), missileDefense: at(aid.missile_defense, lastFy) },
      fy2024: at(aid.total, 2024),
      since2023: [2024, 2025].reduce((s, fy) => s + at(aid.total, fy), 0),
      byPresident,
      missileDefense,
      spark: aid.total.slice(-20).map((p) => p.value),
    },
    trade: { series: trade, balance: tradeBalance, latestYear: latestTradeYear, compare: tradeCompare, partial: partial && partial.period !== latestTradeYear ? { year: partial.period, months: num(partial.metadata?.months) } : null, latest: { exports: israelTrade.exports.find((p) => p.period === latestTradeYear)?.value ?? null, imports: israelTrade.imports.find((p) => p.period === latestTradeYear)?.value ?? null } },
    un: { votes: unVotes.slice(0, 400), agreement: unAgreement, world: unWorld, count: unVotes.length },
    influence: {
      groups,
      cycles,
      topOpposed,
      topSupported,
      topContributions,
      lobbying: LOBBYING_CLIENTS.map(([label, client]) => ({
        label,
        years: lobbying.filter((r) => str(r.client) === client).map((r) => ({ year: num(r.year), total: num(r.total), filings: num(r.n) })),
      })).filter((l) => l.years.length),
    },
    votes: { partySplit, members: [...members.values()].sort((a, b) => a.name.localeCompare(b.name)) },
    datasets: datasets.map((d) => ({ ...d, coverage: cov[d.slug] ?? null })),
  };
}

export type IsraelData = NonNullable<Awaited<ReturnType<typeof loadIsrael>>>;

