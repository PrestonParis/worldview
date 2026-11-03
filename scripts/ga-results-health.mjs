// Watchdog for the close-races ingest (.github/workflows/ga-results-health.yml).
// For every scheduled election whose watch should be running
// (data/elections/ga/schedule.json: from watchStartUtc to stopAfter, until
// all its results are official), it restarts the watch workflow when no
// worker is alive and no watch run is queued or in progress: a dropped
// scheduled start, a broken hand-off, a crashed or timed-out run. A run that
// is in progress with a dead heartbeat is hung, so it is cancelled and
// replaced. Any other unofficial tracked election with a dead worker raises
// an alert.
//
// With --loop it is the election-night sentinel: GitHub's cron is too sparse
// to rely on (3 firings of */10 in the 20 hours before Nov 3's watch start),
// so a dispatched run repeats the check itself and hands off to its next run.
// Each pass also checks the database's size and writability, sends the
// progress digest, and starts the morning load.
//
// Usage: node scripts/ga-results-health.mjs [--stale-minutes=10] [--dry-run] [--at=<ISO time>]
//        node scripts/ga-results-health.mjs --loop [--every=300] [--until=5h45m]
// (--at rehearses a moment in the schedule window; use it with --dry-run.)
// Restarting needs the gh CLI with GH_TOKEN (and GH_REPO outside a checkout).

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { arg, connectPg, flag, loadEnv, sleep } from "./lib/bulk.mjs";
import { bucket, raiseAlert, sendWebhook } from "./lib/alerts.mjs";
import { activeElections, etDate, parseSchedule } from "../src/lib/elections/close-races/schedule.ts";
import { DB_LIMIT_BYTES, DB_WARN_SHARE, digestEveryMinutes, digestMessage, digestStarted, morningDueMs, runIsStuck, sentinelActive } from "../src/lib/elections/close-races/sentinel.ts";

loadEnv();
const STALE_MIN = Number(arg("stale-minutes", 10));
const DRY_RUN = flag("dry-run");
const LOOP = flag("loop");
const FIXED_AT = arg("at") ? new Date(arg("at")) : null;
const now = () => FIXED_AT ?? new Date();
const WORKFLOW = "ga-results-watch.yml";
const DAILY_WORKFLOW = "ga-results-daily.yml";
const schedule = parseSchedule(JSON.parse(fs.readFileSync("data/elections/ga/schedule.json", "utf8")));

const minutesAgo = (r) => (r.minutes == null ? Infinity : Number(r.minutes));
// A worker is alive while its watch or waiting heartbeat is fresh.
const alive = (r) => (r.mode === "watch" || r.mode === "waiting") && minutesAgo(r) <= STALE_MIN;
// A live watch that went quiet, or a run that ended and never handed off.
// Daily loads ("load") and deliberate stops are left alone.
const dead = (r) => ((r.mode === "watch" || r.mode === "waiting") && minutesAgo(r) > STALE_MIN) || (r.mode === "watch-ended" && minutesAgo(r) > 2 * STALE_MIN);

const ACTIVE = ["queued", "in_progress", "waiting", "requested", "pending"];

function watchRuns() {
  const out = execFileSync("gh", ["run", "list", "--workflow", WORKFLOW, "--json", "databaseId,status,createdAt", "--limit", "10"], { encoding: "utf8" });
  return JSON.parse(out).filter((r) => ACTIVE.includes(r.status));
}

function dispatch(workflow, fields = []) {
  const args = ["workflow", "run", workflow, ...fields.flatMap((f) => ["-f", f])];
  if (process.env.GITHUB_REF_NAME) args.push("--ref", process.env.GITHUB_REF_NAME);
  if (DRY_RUN) return console.log(`  would run: gh ${args.join(" ")}`);
  execFileSync("gh", args, { stdio: "inherit" });
}

function startWatch(entry) {
  dispatch(WORKFLOW, [`election=${entry.id ?? "auto"}`, `date=${entry.date}`, `kind=${entry.kind}`, "chain=true"]);
}

// A hung worker holds the concurrency slot until its 350-minute timeout, so
// the run is cancelled and the next one queued behind it. Returns the run id.
function cancelStuck(forDate, runs) {
  const heartbeat = forDate.length ? Math.min(...forDate.map(minutesAgo)) : null;
  const running = runs.find((r) => r.status === "in_progress");
  if (!running) return null;
  const runAgeMinutes = (now().getTime() - Date.parse(running.createdAt)) / 60_000;
  if (!runIsStuck({ heartbeatMinutes: Number.isFinite(heartbeat) ? heartbeat : null, runAgeMinutes })) return null;
  if (DRY_RUN) {
    console.log(`  would cancel stuck run ${running.databaseId}`);
    return running.databaseId;
  }
  execFileSync("gh", ["run", "cancel", String(running.databaseId)], { stdio: "inherit" });
  return running.databaseId;
}

async function check(pg) {
  const at = now();
  const { rows } = await pg.query(
    `select source_election_id, to_char(election_date, 'YYYY-MM-DD') as date, heartbeat_at, mode, is_official,
            extract(epoch from now() - heartbeat_at) / 60 as minutes
       from tracked_ingest_status
      where election_date >= $1::date - 60 and election_date <= $1::date + 1`,
    [etDate(at)],
  );
  for (const r of rows) {
    const m = minutesAgo(r);
    console.log(`${r.source_election_id}: heartbeat ${Number.isFinite(m) ? `${m.toFixed(1)} min ago` : "never"} (${r.mode}${r.is_official ? ", official" : ""})`);
  }

  const handled = new Set();
  for (const entry of activeElections(schedule, at)) {
    const forDate = rows.filter((r) => r.date === entry.date);
    forDate.forEach((r) => handled.add(r.source_election_id));
    if (forDate.length && forDate.every((r) => r.is_official)) continue;
    if (forDate.some(alive)) continue;
    let runs;
    try {
      runs = watchRuns();
    } catch (err) {
      console.error(`  gh run list failed: ${err.message}`);
      runs = [];
    }
    let why = forDate.length ? `worker heartbeat (${forDate.map((r) => `${r.source_election_id} ${r.mode}`).join(", ")}) is stale` : `no worker has started for ${entry.date}`;
    if (runs.length) {
      let cancelled = null;
      try {
        cancelled = cancelStuck(forDate, runs);
      } catch (err) {
        console.error(`  cancel failed: ${err.message}`);
      }
      if (!cancelled) {
        console.log(`  ${entry.date}: no live worker, but a watch run is queued or running`);
        continue;
      }
      why = `run ${cancelled} was hung and has been cancelled (${why})`;
    }
    console.log(`  ${why}; starting the watch`);
    let restarted = true;
    try {
      startWatch(entry);
    } catch (err) {
      restarted = false;
      console.error(`  restart failed: ${err.message}`);
    }
    if (!DRY_RUN) {
      await raiseAlert(pg, {
        election: forDate[0]?.source_election_id ?? entry.id ?? `scheduled-${entry.date}-${entry.kind}`,
        key: `restart:${bucket(30)}`,
        kind: "heartbeat",
        severity: restarted ? "warning" : "critical",
        message: restarted ? `${why}; the watch was restarted automatically` : `${why}; automatic restart failed`,
      });
    }
  }

  // Elections outside the schedule (one dispatched by hand): alert only.
  for (const r of rows.filter((r) => !handled.has(r.source_election_id) && !r.is_official && r.date <= etDate(at) && dead(r))) {
    if (DRY_RUN) continue;
    await raiseAlert(pg, {
      election: r.source_election_id,
      key: `heartbeat:${bucket(30)}`,
      kind: "heartbeat",
      severity: "warning",
      message: `Ingest heartbeat is ${Number.isFinite(minutesAgo(r)) ? `${Math.round(minutesAgo(r))} min` : "missing"} old (${r.mode}); this election isn't in data/elections/ga/schedule.json, so it isn't restarted`,
    });
  }
}

// Disk filling up turned this database read-only once (Oct 29).
async function checkDatabase(pg, electionId) {
  const { rows } = await pg.query("select pg_database_size(current_database())::bigint as bytes, current_setting('default_transaction_read_only') as read_only");
  const bytes = Number(rows[0].bytes);
  const share = bytes / DB_LIMIT_BYTES;
  console.log(`  database: ${(bytes / 1024 ** 3).toFixed(2)} GB (${(share * 100).toFixed(0)}% of the limit), read-only ${rows[0].read_only}`);
  if (DRY_RUN) return;
  if (rows[0].read_only === "on") {
    // Can't be stored in tracked_alerts, so it pushes each pass.
    await sendWebhook(`🚨 [${electionId}] The database is read-only: results can't be written.`);
  } else if (share >= DB_WARN_SHARE) {
    await raiseAlert(pg, {
      election: electionId,
      key: `db-size:${bucket(60)}`,
      kind: "db_size",
      severity: "critical",
      message: `Database is at ${(share * 100).toFixed(0)}% of its ${(DB_LIMIT_BYTES / 1024 ** 3).toFixed(0)} GB limit; it goes read-only when full`,
    });
  }
}

async function sendDigest(pg, entry, status) {
  const at = now();
  if (!digestStarted(entry.date, at)) return;
  const every = digestEveryMinutes(at);
  const id = status.source_election_id;
  const { rows: totals } = await pg.query(
    `select count(*)::int as contests, count(*) filter (where total_votes > 0)::int as with_votes, count(*) filter (where ranked)::int as ranked
       from tracked_contests where source_election_id = $1 and removed_at is null`,
    [id],
  );
  const { rows: closest } = await pg.query(
    `select name, county, margin_votes, margin_pct from tracked_contests
      where source_election_id = $1 and removed_at is null and ranked
      order by margin_votes asc, margin_pct asc, name asc limit 3`,
    [id],
  );
  const { rows: held } = await pg.query(
    `select kind, count(*)::int as n from tracked_alerts
      where source_election_id = $1 and sent_at is null and severity <> 'info' and created_at > now() - make_interval(mins => $2)
      group by kind`,
    [id, every],
  );
  const { rows: cities } = await pg.query(
    `select name from tracked_contests where source_election_id = $1 and source like 'city:%' and removed_at is null and total_votes = 0 order by name`,
    [id],
  );
  const site = process.env.SITE_URL?.replace(/\/$/, "");
  const message = digestMessage({
    electionName: status.election_name || id,
    contests: totals[0].contests,
    withVotes: totals[0].with_votes,
    ranked: totals[0].ranked,
    countiesFetched: status.counties_fetched,
    heartbeatMinutes: status.minutes == null ? null : Number(status.minutes),
    closest: closest.map((c) => ({ name: c.name, county: c.county, marginVotes: c.margin_votes, marginPct: c.margin_pct == null ? null : Number(c.margin_pct) })),
    held: Object.fromEntries(held.map((h) => [h.kind, h.n])),
    citiesWaiting: cities.map((c) => c.name),
    reportUrl: site ? `${site}/writ/close-races/${encodeURIComponent(id)}` : null,
  });
  if (DRY_RUN) return console.log(`  digest (dry run):\n${message}`);
  await raiseAlert(pg, { election: id, key: `digest:${every}:${bucket(every, at.getTime())}`, kind: "digest", severity: "progress", message });
}

// The daily workflow's cron is as unreliable as the others; the morning after
// an election it is started from here, once.
async function morningLoad(pg, entry, electionId) {
  if (now().getTime() < morningDueMs(entry.date)) return;
  if (DRY_RUN) return console.log(`  would start ${DAILY_WORKFLOW}`);
  const { rows } = await pg.query(
    `insert into tracked_alerts (source_election_id, dedupe_key, kind, severity, message, sent_at)
     values ($1, $2, 'morning_load', 'info', 'Morning load started by the sentinel', now())
     on conflict (dedupe_key) do nothing returning id`,
    [electionId, `${electionId}:morning-load:${entry.date}`],
  );
  if (rows.length) dispatch(DAILY_WORKFLOW);
}

async function sentinelExtras(pg) {
  const at = now();
  const { rows } = await pg.query(
    `select source_election_id, to_char(election_date, 'YYYY-MM-DD') as date, election_name, counties_fetched,
            extract(epoch from now() - heartbeat_at) / 60 as minutes
       from tracked_ingest_status where election_date >= $1::date - 2 and election_date <= $1::date`,
    [etDate(at)],
  );
  const entries = activeElections(schedule, at);
  const first = rows.find((r) => entries.some((e) => e.date === r.date));
  await checkDatabase(pg, first?.source_election_id ?? entries[0]?.id ?? "sentinel");
  for (const entry of entries) {
    const forDate = rows.filter((r) => r.date === entry.date);
    for (const status of forDate) await sendDigest(pg, entry, status);
    if (forDate.length) await morningLoad(pg, entry, forDate[0].source_election_id);
  }
}

function duration(spec) {
  const m = String(spec).match(/^(?:(\d+)h)?(?:(\d+)m)?$/);
  if (!m || (!m[1] && !m[2])) throw new Error(`bad duration "${spec}"`);
  return (Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) * 60_000;
}

// One pass on its own connection, so a dropped connection costs one pass.
async function pass({ extras }) {
  const pg = await connectPg({ timeouts: true });
  pg.on("error", (err) => console.warn(`  database connection error: ${err.message}`));
  try {
    await check(pg);
    if (extras) await sentinelExtras(pg);
  } finally {
    await pg.end().catch(() => {});
  }
}

if (LOOP) {
  const every = Number(arg("every", 300)) * 1000;
  const deadline = Date.now() + duration(arg("until", "5h45m"));
  let failures = 0;
  while (Date.now() < deadline && sentinelActive(schedule, now())) {
    console.log(`\n${new Date().toISOString()} sentinel pass`);
    try {
      await pass({ extras: true });
      failures = 0;
    } catch (err) {
      failures++;
      console.error(`  pass failed (${failures} in a row): ${err.message}`);
      // The database itself may be what's down, so this skips tracked_alerts.
      if (failures === 3 || failures % 12 === 0) await sendWebhook(`🚨 GA results sentinel can't complete a check, ${failures} in a row: ${err.message}`);
    }
    if (FIXED_AT) break;
    await sleep(every);
  }
} else {
  await pass({ extras: flag("extras") });
}
