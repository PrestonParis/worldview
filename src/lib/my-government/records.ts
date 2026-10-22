import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { publicEntityPath } from "../people/public";
import type { OfficialRecord } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BIOGUIDE = /^[A-Z]\d{6}$/;

export function parseRecordKeys(params: URLSearchParams): { entityIds: string[]; bioguideIds: string[] } {
  const list = (key: string, pattern: RegExp) =>
    [...new Set((params.get(key) ?? "").split(",").filter((v) => pattern.test(v)))].slice(0, 60);
  return { entityIds: list("e", UUID), bioguideIds: list("b", BIOGUIDE) };
}

// What Worldview holds on each official a lookup returned, in one round trip:
// where their profile is, and the few numbers worth putting on a card.
// Federal officials arrive with only a Bioguide id, so both keys resolve.
export async function loadOfficialRecords(entityIds: string[], bioguideIds: string[]): Promise<OfficialRecord[]> {
  if (!entityIds.length && !bioguideIds.length) return [];
  const list = (values: string[]) => (values.length ? sql.join(values.map((v) => sql`${v}`), sql`, `) : sql`null`);

  const result = await db.execute<{
    id: string;
    name: string;
    bioguide: string | null;
    cycle: number | null;
    receipts: number | null;
    cash: number | null;
    bills: number;
    votes: number;
    nominate: number | null;
    race_id: string | null;
    race_name: string | null;
    race_date: string | null;
  }>(sql`
    with ids as (
      select id from entities where id::text in (${list(entityIds)})
      union
      select entity_id from entity_identifiers where scheme = 'bioguide' and value in (${list(bioguideIds)})
    )
    select e.id, e.name,
      (select value from entity_identifiers i where i.entity_id = e.id and i.scheme = 'bioguide' limit 1) as bioguide,
      fin.cycle, fin.total_receipts::float8 as receipts, fin.cash_on_hand::float8 as cash,
      (select count(*) from bills b where b.sponsor_entity_id = e.id)::int as bills,
      (select count(*) from votes v where v.voter_entity_id = e.id and v.roll_call_id is not null)::int as votes,
      (select m.nominate_dim1 from member_ideology m where m.entity_id = e.id and m.nominate_dim1 is not null
        order by m.congress desc limit 1) as nominate,
      race.id as race_id, race.name as race_name, race.election_date as race_date
    from ids
    join entities e on e.id = ids.id
    left join lateral (
      select cycle, total_receipts, cash_on_hand from candidate_finance f
      where f.entity_id = e.id and f.total_receipts > 0 order by cycle desc limit 1
    ) fin on true
    left join lateral (
      select el.id, el.name, el.election_date from candidacies c join elections el on el.id = c.election_id
      where c.candidate_entity_id = e.id and not c.withdrew
        and coalesce(c.status, '') not in ('withdrew', 'lost_primary')
        and el.election_date >= now() - interval '1 day'
      order by el.election_date limit 1
    ) race on true`);

  return result.rows.map((row) => ({
    entityId: row.id,
    bioguideId: row.bioguide,
    profilePath: publicEntityPath({ id: row.id, name: row.name }),
    finance: row.receipts ? { cycle: row.cycle!, receipts: row.receipts, cashOnHand: row.cash } : null,
    billsSponsored: row.bills,
    rollCallVotes: row.votes,
    nominate: row.nominate,
    nextRace: row.race_id ? { id: row.race_id, name: row.race_name!, date: new Date(row.race_date!).toISOString() } : null,
  }));
}
