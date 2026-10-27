// Places FEC committees and companies on a side of the People graph, for the
// organizations no curated list or party field covers
// (src/lib/graph/lean.ts reads what this writes). In order:
//
//   1. party      the committee's FEC party affiliation is DEM/DFL or REP
//                 (state and national parties, most candidate committees)
//   2. sponsor    a leadership PAC or campaign committee takes its
//                 candidate's FEC party
//   3. money      at least 75% of the money it spent helping candidates,
//                 2022-2026, went to one party's candidates: contributions,
//                 coordinated spending and independent expenditures
//                 supporting them. Spending against a candidate doesn't
//                 count — in a primary it attacks the spender's own party
//                 (Cornyn's committee against Paxton), and money_flows
//                 doesn't say which race it was.
//                 Needs $2,500+; bipartisan givers stay unplaced.
//   4. company    the same test over the company's connected PAC
//                 (fec_committees.connected_org) and its own recorded
//                 donations to politicians.
//
// Writes metadata.lean ("liberal" | "conservative"), metadata.leanBasis
// (one plain sentence) and, for money placements, metadata.leanTotal (the
// dollars behind it), and clears both from anything that no longer
// qualifies, so it's safe to re-run after every FEC import.
//
// Usage: node scripts/classify-entity-lean.mjs [--dry-run]
//        ENV_FILE=.env.cloud node scripts/classify-entity-lean.mjs

import { chunk, flag, runImport } from "./lib/bulk.mjs";

const DRY_RUN = flag("dry-run");
const SHARE = 0.75;
const MIN_TOTAL = 2_500;
const MIN_CANDIDATES = 1;

const LEAN_BY_FEC_PARTY = { DEM: "liberal", DFL: "liberal", REP: "conservative" };
const PARTY_NAME = { liberal: "Democratic", conservative: "Republican" };
const PARTY_PLURAL = { liberal: "Democrats", conservative: "Republicans" };

const dollars = (n) => `$${Math.round(n).toLocaleString("en-US")}`;

// Help per committee, in dollars, for each side.
const HELP_SQL = `
  select m.committee_id,
    sum(case when c.party in ('DEM', 'DFL') then m.total else 0 end)::float8 as d,
    sum(case when c.party = 'REP' then m.total else 0 end)::float8 as r,
    count(distinct m.candidate_id)::int as k
  from money_flows m join fec_candidates c using (candidate_id)
  where m.kind <> 'ie_oppose'
  group by 1`;

function fromMoney({ d, r, k }, subject) {
  const total = d + r;
  if (total < MIN_TOTAL || k < MIN_CANDIDATES) return null;
  const lean = d >= SHARE * total ? "liberal" : r >= SHARE * total ? "conservative" : null;
  if (!lean) return null;
  const share = Math.round(((lean === "liberal" ? d : r) / total) * 100);
  return {
    lean,
    total: Math.round(total),
    basis: `${share}% of the ${dollars(total)} ${subject} spent on ${k} federal ${k === 1 ? "candidate" : "candidates"} in 2022–2026 went to ${PARTY_PLURAL[lean]} (FEC).`,
  };
}

runImport("classify-entity-lean", async (pg) => {
  const help = new Map((await pg.query(HELP_SQL)).rows.map((row) => [row.committee_id, row]));

  // Every committee entity with its FEC record; one entity can hold several
  // committee ids, and the first that places it wins.
  const { rows: committees } = await pg.query(`
    select i.entity_id, f.committee_id, f.party, f.designation, c.party as candidate_party, c.name as candidate_name
    from entity_identifiers i
    join fec_committees f on f.committee_id = i.value
    left join fec_candidates c on c.candidate_id = f.candidate_id
    where i.scheme = 'fec_committee'
    order by i.entity_id, f.last_cycle desc`);

  const placed = new Map();
  const tally = { party: 0, sponsor: 0, money: 0, company: 0 };
  for (const row of committees) {
    if (placed.has(row.entity_id)) continue;
    const byParty = LEAN_BY_FEC_PARTY[row.party];
    if (byParty) {
      placed.set(row.entity_id, { lean: byParty, basis: `FEC lists its party affiliation as ${PARTY_NAME[byParty]}.` });
      tally.party++;
      continue;
    }
    const bySponsor = LEAN_BY_FEC_PARTY[row.candidate_party];
    if (bySponsor && ["D", "P", "A"].includes(row.designation)) {
      const kind = row.designation === "D" ? "Leadership PAC" : "Campaign committee";
      placed.set(row.entity_id, { lean: bySponsor, basis: `${kind} of ${row.candidate_name}, a ${PARTY_NAME[bySponsor]} candidate (FEC).` });
      tally.sponsor++;
      continue;
    }
  }
  // Money only after every id an entity holds has had its party/sponsor turn.
  const helpByEntity = new Map();
  for (const row of committees) {
    const h = help.get(row.committee_id);
    if (!h) continue;
    const sum = helpByEntity.get(row.entity_id) ?? { d: 0, r: 0, k: 0 };
    helpByEntity.set(row.entity_id, { d: sum.d + h.d, r: sum.r + h.r, k: sum.k + h.k });
  }
  for (const [entityId, sum] of helpByEntity) {
    if (placed.has(entityId)) continue;
    const result = fromMoney(sum, "it");
    if (result) {
      placed.set(entityId, result);
      tally.money++;
    }
  }

  // Companies: their connected PACs' money plus direct recorded gifts to
  // politicians of either party (counted at the edge level, no amounts).
  const { rows: companies } = await pg.query(`
    select e.id, array_remove(array_agg(distinct f.committee_id), null) as committees
    from entities e
    left join fec_committees f on lower(f.connected_org) = lower(e.name)
    where e.type = 'company'
    group by e.id`);
  const { rows: gifts } = await pg.query(`
    select r.source_entity_id as id, t.metadata
    from entity_edges r join entities t on t.id = r.target_entity_id
    join entities s on s.id = r.source_entity_id
    where s.type = 'company' and r.rel_type = 'donated-to' and t.type = 'politician'`);
  const giftSides = new Map();
  for (const gift of gifts) {
    let party = "";
    try { party = String(JSON.parse(gift.metadata || "{}").party ?? "").toLowerCase(); } catch {}
    const side = /^(d|dem|democrat)/.test(party) ? "d" : /^(r|rep|republican)/.test(party) ? "r" : null;
    if (!side) continue;
    const sides = giftSides.get(gift.id) ?? { d: 0, r: 0 };
    sides[side]++;
    giftSides.set(gift.id, sides);
  }
  for (const company of companies) {
    const sum = { d: 0, r: 0, k: 0 };
    for (const id of company.committees) {
      const h = help.get(id);
      if (h) { sum.d += h.d; sum.r += h.r; sum.k += h.k; }
    }
    let result = fromMoney(sum, "its PAC");
    const sides = giftSides.get(company.id);
    if (!result && sides && sides.d + sides.r >= MIN_CANDIDATES) {
      const n = sides.d + sides.r;
      const lean = sides.d >= SHARE * n ? "liberal" : sides.r >= SHARE * n ? "conservative" : null;
      if (lean) result = { lean, basis: `${lean === "liberal" ? sides.d : sides.r} of its ${n} recorded donations to politicians went to ${PARTY_PLURAL[lean]} (FEC).` };
    }
    if (result) {
      placed.set(company.id, result);
      tally.company++;
    }
  }

  // Write: set placed entities, clear stale placements.
  const { rows: current } = await pg.query(
    `select id, metadata from entities where type in ('organization', 'company') and metadata like '%"lean"%'`,
  );
  const ids = new Set([...placed.keys(), ...current.map((r) => r.id)]);
  const { rows: targets } = await pg.query("select id, metadata from entities where id = any($1::uuid[])", [[...ids]]);
  const updates = [];
  for (const row of targets) {
    let meta = {};
    try { meta = row.metadata ? JSON.parse(row.metadata) : {}; } catch { continue; }
    const next = placed.get(row.id);
    if (next) {
      if (meta.lean === next.lean && meta.leanBasis === next.basis && meta.leanTotal === next.total) continue;
      meta.lean = next.lean;
      meta.leanBasis = next.basis;
      if (next.total) meta.leanTotal = next.total;
      else delete meta.leanTotal;
    } else {
      if (!("lean" in meta)) continue;
      delete meta.lean;
      delete meta.leanBasis;
      delete meta.leanTotal;
    }
    updates.push([row.id, JSON.stringify(meta)]);
  }

  const sides = [...placed.values()].reduce((acc, p) => ((acc[p.lean] = (acc[p.lean] ?? 0) + 1), acc), {});
  console.log(`placed ${placed.size}:`, tally, sides);
  console.log(`${updates.length} metadata rows to write${DRY_RUN ? " (dry run)" : ""}`);
  if (DRY_RUN) return { skipped: updates.length };
  for (const batch of chunk(updates, 1000)) {
    await pg.query(
      `update entities e set metadata = u.metadata, updated_at = now()
       from unnest($1::uuid[], $2::text[]) as u(id, metadata) where e.id = u.id`,
      [batch.map((u) => u[0]), batch.map((u) => u[1])],
    );
  }
  return { updated: updates.length };
});
