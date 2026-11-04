// Precinct results for the contests that need them (close, or unplaced), stored
// in tracked_contest_precincts. A county is re-read only when its feed changed,
// and a raw copy goes to the lake only when a precinct's numbers moved, so the
// record shows where a margin moved as late ballots post.

import { gzipSync } from "node:zlib";
import { archiveRaw } from "./lake.mjs";
import { raiseAlert } from "./alerts.mjs";
import { breakdownMismatches, parseBreakdown, watchesPrecincts } from "../../src/lib/elections/close-races/precincts.ts";
import { stableHash } from "../../src/lib/elections/close-races/merge.ts";

export async function syncPrecincts(pg, client, { electionId, evaluated, counties, seen }) {
  const watched = evaluated.filter((e) => watchesPrecincts({ flags: e.flags, level: e.level, scope: e.scope, municipality: e.municipality, rule: e.rule, marginPct: e.margin.marginPct }));
  if (!watched.length) return { read: 0, changed: 0 };
  const { rows } = await pg.query("select id, external_id from tracked_contests where source_election_id = $1 and source = 'ga-sos' and removed_at is null", [electionId]);
  const contestId = new Map(rows.map((r) => [r.external_id, r.id]));

  const jobs = [];
  for (const ev of watched) {
    const id = contestId.get(`ga-sos:${electionId}:${ev.key}`);
    if (!id) continue;
    const ids = new Set(ev.sourceContestIds);
    for (const county of counties) {
      const slice = county.feed.contests.find((c) => ids.has(c.sourceId) || (c.parentId && ids.has(c.parentId)));
      if (!slice) continue;
      const version = `${id}:${county.slug}`;
      const stamp = county.feed.election.lastUpdated ?? "";
      if (seen.get(version) === stamp) continue;
      jobs.push({ ev, id, county, slice, version, stamp });
    }
  }
  let changed = 0;
  const results = await client.pool(jobs, (job) => client.ballotItem(job.county.slug, electionId, job.slice.sourceId));
  for (const result of results) {
    const job = result.item;
    if (!result.ok) {
      console.warn(`  precincts: ${job.county.slug} ${job.ev.name}: ${result.error.message}`);
      continue;
    }
    const raw = result.value.json;
    const parsed = parseBreakdown(raw);
    const moved = await writePrecincts(pg, job.id, job.county.slug, parsed);
    seen.set(job.version, job.stamp);
    if (moved) {
      changed += moved;
      await archiveRaw(pg, "ga-sos", result.value.url, gzipSync(result.value.body), "application/json+gzip").catch((err) => console.warn(`  precinct archive failed: ${err.message}`));
    }
    const off = breakdownMismatches(raw, parsed);
    if (off.length) {
      await raiseAlert(pg, {
        election: electionId,
        key: `precinct_mismatch:${stableHash(`${job.ev.key}:${job.county.slug}:${off.join("|")}`)}`,
        kind: "precinct_mismatch",
        severity: "warning",
        contestId: job.id,
        message: `Precincts don't add up in ${job.ev.name} (${job.county.name}): ${off.join("; ")}`,
        push: false,
      });
    }
  }
  return { read: jobs.length, changed };
}

async function writePrecincts(pg, contestId, slug, rows) {
  let moved = 0;
  for (const r of rows) {
    const { rowCount } = await pg.query(
      `insert into tracked_contest_precincts (contest_id, county_slug, precinct, total_votes, votes)
       values ($1, $2, $3, $4, $5)
       on conflict (contest_id, county_slug, precinct) do update
         set total_votes = excluded.total_votes, votes = excluded.votes, updated_at = now()
       where tracked_contest_precincts.votes is distinct from excluded.votes`,
      [contestId, slug, r.precinct, r.totalVotes, JSON.stringify(r.votes)],
    );
    moved += rowCount;
  }
  return moved;
}
