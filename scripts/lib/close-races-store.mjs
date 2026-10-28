// Writes evaluated contests (src/lib/elections/close-races/evaluate.ts) to
// the tracked_* tables. Only contests whose numbers changed since the last
// write are touched; each change also writes one tracked_snapshots row and
// is compared with the previous state for operator alerts (leader change,
// a vote total going down, a new exact tie, certification going backwards).

import { createHash } from "node:crypto";
import { chunk } from "./bulk.mjs";
import { normalizeName } from "../../src/lib/elections/close-races/merge.ts";

const CERTIFIED = new Set(["county_certified", "state_certified"]);

// Columns whose value is a JS object go in as JSON; arrays stay arrays so
// node-postgres sends them as Postgres arrays.
const param = (v) => (v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) ? JSON.stringify(v) : v ?? null);

async function upsertReturning(pg, table, columns, rows, conflict, returning, { batchSize = 250, touch = true } = {}) {
  const update = columns.filter((c) => !conflict.includes(c));
  const set = [...update.map((c) => `"${c}" = excluded."${c}"`), ...(touch ? ['"updated_at" = now()'] : [])].join(", ");
  const out = [];
  for (const batch of chunk(rows, batchSize)) {
    const params = [];
    const values = batch.map((row) => `(${columns.map((c) => (params.push(param(row[c])), `$${params.length}`)).join(", ")})`);
    const { rows: got } = await pg.query(
      `insert into ${table} (${columns.map((c) => `"${c}"`).join(", ")}) values ${values.join(", ")}
       on conflict (${conflict.map((c) => `"${c}"`).join(", ")}) do update set ${set}
       returning ${returning}`,
      params,
    );
    out.push(...got);
  }
  return out;
}

export function contestHash(ev) {
  const shape = {
    n: ev.name,
    o: [...ev.options].map((o) => [o.name, o.votes, o.votesByMethod, o.party, o.incumbent]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    u: [ev.reportingUnits, ev.totalUnits, ev.isOfficial],
    s: ev.status,
    r: [ev.rule, ev.threshold],
    f: ev.flags,
    a: ev.areas.map((a) => [a.countySlug, a.reportingUnits, a.totalUnits, a.linked !== false, a.options.map((o) => [o.name, o.votes])]),
  };
  return createHash("sha1").update(JSON.stringify(shape)).digest("hex");
}

// Sources: "ga-sos" (the SOS feed) and "city:{id}" for an election a city
// runs itself (scripts/lib/city-results.mjs). Each source owns its rows: a
// complete SOS round never marks a city contest removed, or the reverse.
export const externalId = (electionId, key, source = "ga-sos") => `${source}:${electionId}:${key}`;

export async function loadExisting(pg, electionId, source = "ga-sos") {
  const { rows } = await pg.query(
    `select c.id, c.external_id, c.source_hash, c.result_status, c.total_votes, c.margin_votes, c.ranked, c.removed_at,
            (select o.name_key from tracked_contest_options o where o.contest_id = c.id and o.is_current_leader limit 1) as leader_key
       from tracked_contests c where c.source_election_id = $1 and c.source = $2`,
    [electionId, source],
  );
  return new Map(rows.map((r) => [r.external_id, r]));
}

// Links U.S. Senate, Governor, President and U.S. House contests to the
// `elections` rows the rest of Writ already shows, so a race docket can
// carry live numbers. Only general and special elections have such rows.
export async function electionLinks(pg, { electionDate, kind }) {
  if (kind !== "general" && kind !== "special") return () => null;
  const cycle = Number(electionDate.slice(0, 4));
  const { rows } = await pg.query(
    `select id, office, jurisdiction, election_type from elections
      where cycle = $1 and (jurisdiction in ('Georgia', 'GA') or jurisdiction like 'GA-%')`,
    [cycle],
  );
  const find = (office, jurisdiction, type) =>
    rows.find((r) => r.office === office && (r.jurisdiction === jurisdiction || (jurisdiction === "Georgia" && r.jurisdiction === "GA")) && r.election_type === type)?.id ?? null;
  return (ev) => {
    const special = /special/i.test(ev.name) || kind === "special" ? "special" : "general";
    if (/^US Senate/i.test(ev.name)) return find("U.S. Senate", "Georgia", special);
    if (/^President/i.test(ev.name)) return find("President", "Georgia", "general");
    if (/^Governor$/i.test(ev.name)) return find("Governor", "Georgia", "general");
    const house = ev.name.match(/^US House of Representatives - District (\d+)/i);
    if (house) return find("U.S. House", `GA-${house[1].padStart(2, "0")}`, special);
    return null;
  };
}

function contestRow(ev, { source, electionId, header, kind, hash, link, now }) {
  const m = ev.margin;
  return {
    source,
    external_id: externalId(electionId, ev.key, source),
    source_election_id: electionId,
    source_contest_ids: ev.sourceContestIds,
    election_date: header.electionDate,
    election_kind: kind,
    state: "GA",
    name: ev.name,
    raw_name: ev.rawName,
    office: ev.office,
    district: ev.district,
    level: ev.level,
    scope: ev.scope,
    county_slug: ev.countySlug,
    county: ev.county,
    counties: ev.counties,
    municipality: ev.municipality,
    vote_for: ev.voteFor,
    is_referendum: ev.isReferendum,
    primary_party: ev.primaryParty,
    total_votes: m.totalVotes,
    reporting_units: ev.reportingUnits,
    total_units: ev.totalUnits,
    decision_rule: ev.rule,
    rule_source: ev.ruleSource,
    threshold: ev.threshold,
    result_status: ev.status,
    ranked: m.rankable,
    uncontested: m.uncontested,
    margin_votes: m.marginVotes,
    margin_pct: m.marginPct,
    leader_share: m.leaderShare,
    flags: ev.flags,
    source_updated_at: header.lastUpdated,
    as_of: ev.asOf,
    ingested_at: now,
    source_hash: hash,
    removed_at: null,
    election_id: link(ev),
  };
}

/**
 * Upserts changed contests. `complete` means every feed was fetched this
 * round, so contests missing from it can be marked removed.
 */
export async function writeContests(pg, { source = "ga-sos", electionId, header, kind, evaluated, complete, link = () => null }) {
  const now = new Date();
  const existing = await loadExisting(pg, electionId, source);
  const changed = [];
  for (const ev of evaluated) {
    const hash = contestHash(ev);
    const prev = existing.get(externalId(electionId, ev.key, source));
    if (prev && prev.source_hash === hash && !prev.removed_at) continue;
    changed.push({ ev, hash, prev });
  }

  const events = [];
  if (changed.length) {
    const columns = Object.keys(contestRow(changed[0].ev, { source, electionId, header, kind, hash: "", link, now }));
    const saved = await upsertReturning(
      pg,
      "tracked_contests",
      columns,
      changed.map(({ ev, hash }) => contestRow(ev, { source, electionId, header, kind, hash, link, now })),
      ["external_id"],
      "id, external_id",
    );
    const idByExternal = new Map(saved.map((r) => [r.external_id, r.id]));

    const optionRows = [];
    for (const { ev } of changed) {
      const contestId = idByExternal.get(externalId(electionId, ev.key, source));
      const seen = new Set();
      for (const o of ev.margin.ranked) {
        // Two lines with one name (e.g. two "Write-in" rows) stay distinct.
        let key = normalizeName(o.name);
        while (seen.has(key)) key += "#";
        seen.add(key);
        optionRows.push({
          contest_id: contestId,
          name_key: key,
          source_option_ids: [o.sourceId],
          name: o.name,
          party: o.party,
          incumbent: o.incumbent,
          is_write_in: o.isWriteIn,
          votes: o.votes,
          votes_by_method: o.votesByMethod,
          rank: o.rank,
          is_current_leader: o.isCurrentLeader,
          is_apparent_winner: o.isApparentWinner,
        });
      }
    }
    const savedOptions = await upsertReturning(pg, "tracked_contest_options", Object.keys(optionRows[0] ?? { contest_id: 0 }), optionRows, ["contest_id", "name_key"], "id, contest_id, name_key", { batchSize: 400 });
    const optionId = new Map(savedOptions.map((r) => [`${r.contest_id}\u0000${r.name_key}`, r.id]));

    // Options that left a changed contest (a withdrawn write-in line).
    const contestIds = [...idByExternal.values()];
    await pg.query(
      `delete from tracked_contest_options o where o.contest_id = any($1::uuid[])
          and not exists (select 1 from unnest($2::uuid[], $3::text[]) as k(cid, nk) where k.cid = o.contest_id and k.nk = o.name_key)`,
      [contestIds, optionRows.map((r) => r.contest_id), optionRows.map((r) => r.name_key)],
    );

    const areaRows = [];
    for (const { ev } of changed) {
      const contestId = idByExternal.get(externalId(electionId, ev.key, source));
      for (const area of ev.areas) {
        for (const o of area.options) {
          const id = optionId.get(`${contestId}\u0000${normalizeName(o.name)}`);
          if (!id) continue;
          areaRows.push({ contest_id: contestId, option_id: id, county_slug: area.countySlug, county: area.county, votes: o.votes, reporting_units: area.reportingUnits, total_units: area.totalUnits, linked: area.linked !== false });
        }
      }
    }
    if (areaRows.length) await upsertReturning(pg, "tracked_contest_areas", Object.keys(areaRows[0]), areaRows, ["option_id", "county_slug"], "id", { batchSize: 500 });

    const snapshotRows = changed.map(({ ev, hash }) => {
      const contestId = idByExternal.get(externalId(electionId, ev.key, source));
      const m = ev.margin;
      const w = m.cutoffWinner ?? m.leader;
      const l = m.cutoffLoser ?? m.runnerUp;
      return {
        contest_id: contestId,
        as_of: ev.asOf,
        ingested_at: now,
        leader_option_id: w ? optionId.get(`${contestId}\u0000${normalizeName(w.name)}`) ?? null : null,
        runner_up_option_id: l ? optionId.get(`${contestId}\u0000${normalizeName(l.name)}`) ?? null : null,
        leader_votes: w?.votes ?? null,
        runner_up_votes: l?.votes ?? null,
        total_votes: m.totalVotes,
        margin_votes: m.marginVotes,
        margin_pct: m.marginPct,
        reporting_units: ev.reportingUnits,
        total_units: ev.totalUnits,
        result_status: ev.status,
        source_hash: hash,
      };
    });
    for (const batch of chunk(snapshotRows, 400)) {
      const cols = Object.keys(batch[0]);
      const params = [];
      const values = batch.map((row) => `(${cols.map((c) => (params.push(param(row[c])), `$${params.length}`)).join(", ")})`);
      await pg.query(`insert into tracked_snapshots (${cols.join(", ")}) values ${values.join(", ")}`, params);
    }

    for (const { ev, prev } of changed) {
      if (!prev) continue;
      const contestId = prev.id;
      const m = ev.margin;
      const leaderKey = m.ranked.find((o) => o.isCurrentLeader)?.name;
      if (prev.ranked && m.rankable && prev.leader_key && leaderKey && prev.leader_key !== normalizeName(leaderKey)) {
        events.push({ kind: "leader_change", contestId, ev, message: `Leader changed in ${label(ev)}: now ${leaderKey}, margin ${m.marginVotes} votes` });
      }
      if (m.totalVotes < prev.total_votes) {
        events.push({ kind: "vote_decrease", contestId, ev, message: `Vote total went down in ${label(ev)}: ${prev.total_votes} → ${m.totalVotes}` });
      }
      if (m.rankable && m.marginVotes === 0 && prev.margin_votes !== 0) {
        events.push({ kind: "tie", contestId, ev, message: `Exact tie in ${label(ev)} at ${m.totalVotes} votes` });
      }
      if (CERTIFIED.has(prev.result_status) && !CERTIFIED.has(ev.status) && !["recount_pending", "contested"].includes(ev.status)) {
        events.push({ kind: "certification_regressed", contestId, ev, message: `Certification went backwards in ${label(ev)}: ${prev.result_status} → ${ev.status}` });
      }
    }
  }

  let removed = 0;
  const present = new Set(evaluated.map((ev) => externalId(electionId, ev.key, source)));
  if (complete) {
    const gone = [...existing.values()].filter((r) => !present.has(r.external_id) && !r.removed_at).map((r) => r.id);
    if (gone.length) {
      await pg.query("update tracked_contests set removed_at = now(), updated_at = now() where id = any($1::uuid[])", [gone]);
      removed = gone.length;
    }
  }
  return {
    inserted: changed.filter((c) => !c.prev).length,
    updated: changed.filter((c) => c.prev).length,
    unchanged: evaluated.length - changed.length,
    removed,
    events,
  };
}

const label = (ev) => (ev.county ? `${ev.name} (${ev.county})` : ev.name);

// Full rows (from a write) upsert; heartbeat-only calls update the existing
// row, since an insert would fail the NOT NULL columns before ON CONFLICT.
export async function updateStatus(pg, electionId, fields) {
  const cols = Object.keys(fields);
  const params = [electionId, ...cols.map((c) => param(fields[c]))];
  const set = cols.map((c, i) => `"${c}" = $${i + 2}`).join(", ");
  const { rowCount } = await pg.query(`update tracked_ingest_status set ${set}, updated_at = now() where source_election_id = $1`, params);
  if (rowCount || !("source" in fields)) return;
  await pg.query(
    `insert into tracked_ingest_status (source_election_id, ${cols.map((c) => `"${c}"`).join(", ")})
     values ($1, ${cols.map((_, i) => `$${i + 2}`).join(", ")})
     on conflict (source_election_id) do update set ${cols.map((c) => `"${c}" = excluded."${c}"`).join(", ")}, updated_at = now()`,
    params,
  );
}

// A watch started before the feed exists has no row for its heartbeats to
// update. Create a bare one so the watchdog and the workflow hand-off see
// the worker waiting; the first full load fills in the rest.
export async function ensureStatus(pg, electionId, { name, date, kind, replaces = null }) {
  await pg.query(
    `insert into tracked_ingest_status (source_election_id, source, election_name, election_date, election_kind, mode, replaces)
     values ($1, 'ga-sos', $2, $3, $4, 'waiting', $5)
     on conflict (source_election_id) do nothing`,
    [electionId, name, date, kind, replaces],
  );
}

// An id that never got a feed (SOS published the election under another id).
// City contests stored under it move with the next city sync, so they go too.
export async function dropEmptyStatus(pg, electionId) {
  const { rowCount } = await pg.query("delete from tracked_ingest_status where source_election_id = $1 and contests = 0", [electionId]);
  if (rowCount) await pg.query("delete from tracked_contests where source_election_id = $1 and source like 'city:%'", [electionId]);
}

export async function bumpError(pg, electionId, message) {
  await pg.query(
    "update tracked_ingest_status set error_count = error_count + 1, last_error = $2, updated_at = now() where source_election_id = $1",
    [electionId, String(message).slice(0, 2000)],
  );
}

// The first copy of each county feed's contests (src/lib/elections/close-races/coverage.ts).
export async function loadBaseline(pg, electionId) {
  const { rows } = await pg.query(
    "select jurisdiction_id, contest_key, name from tracked_contest_baseline where source_election_id = $1 order by captured_at, name",
    [electionId],
  );
  const out = new Map();
  for (const r of rows) {
    if (!out.has(r.jurisdiction_id)) out.set(r.jurisdiction_id, []);
    out.get(r.jurisdiction_id).push({ key: r.contest_key, name: r.name });
  }
  return out;
}

export async function addBaseline(pg, electionId, rows) {
  for (const batch of chunk(rows, 500)) {
    const params = [electionId];
    const values = batch.map((r) => (params.push(r.jurisdictionId, r.key, r.name), `($1, $${params.length - 2}, $${params.length - 1}, $${params.length})`));
    await pg.query(
      `insert into tracked_contest_baseline (source_election_id, jurisdiction_id, contest_key, name) values ${values.join(", ")}
       on conflict do nothing`,
      params,
    );
  }
}

export async function writeCoverage(pg, rows) {
  if (!rows.length) return;
  await upsertReturning(pg, "tracked_contest_coverage", Object.keys(rows[0]).filter((c) => c !== "updated_at"), rows, ["source_election_id", "jurisdiction_id"], "id");
}
