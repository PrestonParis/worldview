// The Supreme Court half of the People & Power landscape: the sitting
// justices (scripts/import-supreme-court.mjs), who appointed them, and how
// they vote — each justice's share of votes on the conservative side of a
// case, as the Supreme Court Database codes each decision's direction.
// Degrades to null until the import has run.

import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { getEntitiesByIds } from "@/lib/db/entities";
import { parseEntityMetadata, publicEntityPath } from "./public";

const COURT = "Supreme Court of the United States";
// Terms that count as a justice's current voting record.
const RECENT_TERMS = 5;

export type AppointingParty = "R" | "D";

export interface CourtRecord {
  /** % of directional votes on the conservative side, latest RECENT_TERMS terms. */
  recentShare: number | null;
  careerShare: number | null;
  /** % of votes cast with the majority, career. */
  majorityRate: number | null;
  votes: number;
  firstTerm: number | null;
}

export interface CourtJustice {
  id: string;
  name: string;
  href: string;
  imageUrl: string | null;
  seat: "chief" | "associate";
  office: string;
  /** 0 for the Chief Justice, then associates by date seated. */
  seniority: number;
  appointedBy: string;
  appointingParty: AppointingParty | null;
  confirmed: string;
  seated: string;
  senateVote: string;
  born: number | null;
  prior: string;
  record: CourtRecord | null;
}

export interface CourtComposition {
  /** Seniority order: the Chief Justice, then associates. */
  justices: CourtJustice[];
  /** Appointing presidents, most justices first. */
  byPresident: { president: string; party: AppointingParty | null; count: number; since: string }[];
  latestTerm: number | null;
  recentFrom: number | null;
  /** The middle justice by recent conservative share. */
  medianId: string | null;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

function partyOf(value: unknown): AppointingParty | null {
  const p = str(value).toLowerCase();
  if (p.startsWith("republican")) return "R";
  if (p.startsWith("democrat")) return "D";
  return null;
}

export async function loadCourtComposition(): Promise<CourtComposition | null> {
  const seats = (
    await db.execute(sql`
      select x.source_entity_id::text as id, x.valid_from as seated
      from entity_edges x join entities c on c.id = x.target_entity_id
      where x.rel_type = 'serves-in' and x.valid_to = '' and c.name = ${COURT}
        and x.source_key like 'scotus:%'`)
  ).rows as { id: string; seated: string }[];
  if (seats.length === 0) return null;

  const [entities, votes] = await Promise.all([
    getEntitiesByIds(seats.map((s) => s.id)),
    db.execute(sql`
      with latest as (select max(term) as term from court_cases)
      select v.justice_entity_id::text as id,
             min(c.term)::int as first,
             count(*)::int as votes,
             count(*) filter (where v.in_majority)::int as majority,
             count(*) filter (where v.direction = 'conservative')::int as con,
             count(*) filter (where v.direction in ('conservative', 'liberal'))::int as directional,
             count(*) filter (where v.direction = 'conservative' and c.term > latest.term - ${RECENT_TERMS})::int as recent_con,
             count(*) filter (where v.direction in ('conservative', 'liberal') and c.term > latest.term - ${RECENT_TERMS})::int as recent_directional,
             max(latest.term)::int as latest
      from case_votes v join court_cases c on c.id = v.case_id cross join latest
      where v.justice_entity_id in (
        select x.source_entity_id from entity_edges x join entities ct on ct.id = x.target_entity_id
        where x.rel_type = 'serves-in' and x.valid_to = '' and ct.name = ${COURT})
      group by 1`),
  ]);
  const voteRows = votes.rows as {
    id: string;
    first: number;
    votes: number;
    majority: number;
    con: number;
    directional: number;
    recent_con: number;
    recent_directional: number;
    latest: number;
  }[];
  const recordById = new Map(voteRows.map((v) => [v.id, v]));
  const latestTerm = voteRows[0]?.latest ?? null;

  const justices = entities.map((entity) => {
    const meta = parseEntityMetadata(entity.metadata);
    const v = recordById.get(entity.id);
    const seat: CourtJustice["seat"] = meta.seat === "chief" ? "chief" : "associate";
    return {
      id: entity.id,
      name: entity.name,
      href: publicEntityPath(entity),
      imageUrl: entity.imageUrl || null,
      seat,
      office: str(meta.office) || entity.description || "",
      seniority: 0,
      appointedBy: str(meta.appointedBy),
      appointingParty: partyOf(meta.appointingParty),
      confirmed: str(meta.confirmed),
      seated: str(meta.seated) || seats.find((s) => s.id === entity.id)?.seated || "",
      senateVote: str(meta.senateVote),
      born: typeof meta.born === "number" ? meta.born : null,
      prior: str(meta.priorPosition),
      record: v
        ? {
            recentShare: pct(v.recent_con, v.recent_directional),
            careerShare: pct(v.con, v.directional),
            majorityRate: pct(v.majority, v.votes),
            votes: v.votes,
            firstTerm: v.first,
          }
        : null,
    } satisfies CourtJustice;
  });

  // Seniority: the Chief Justice first whatever their date, then by seat date.
  justices.sort((a, b) => (a.seat === "chief" ? -1 : b.seat === "chief" ? 1 : a.seated.localeCompare(b.seated)));
  justices.forEach((j, i) => (j.seniority = i));

  const presidents = new Map<string, CourtComposition["byPresident"][number]>();
  for (const j of justices) {
    const p = presidents.get(j.appointedBy) ?? { president: j.appointedBy, party: j.appointingParty, count: 0, since: j.seated };
    p.count++;
    if (j.seated < p.since) p.since = j.seated;
    presidents.set(j.appointedBy, p);
  }
  const byPresident = [...presidents.values()].sort(
    (a, b) => (a.party ?? "").localeCompare(b.party ?? "") * -1 || b.count - a.count || a.since.localeCompare(b.since),
  );

  const placed = justices
    .filter((j) => j.record?.recentShare != null)
    .sort((a, b) => a.record!.recentShare! - b.record!.recentShare!);
  const medianId = placed.length % 2 === 1 ? placed[(placed.length - 1) / 2].id : null;

  return {
    justices,
    byPresident,
    latestTerm,
    recentFrom: latestTerm ? latestTerm - RECENT_TERMS + 1 : null,
    medianId,
  };
}
