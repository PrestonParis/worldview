// Watchdog for the close-races ingest (.github/workflows/ga-results-health.yml).
// For every scheduled election whose watch should be running
// (data/elections/ga/schedule.json: from watchStartUtc to stopAfter, until
// all its results are official), it restarts the watch workflow when no
// worker is alive and no watch run is queued or in progress: a dropped
// scheduled start, a broken hand-off, a crashed or timed-out run. Any other
// unofficial tracked election with a dead worker raises an alert.
//
// Usage: node scripts/ga-results-health.mjs [--stale-minutes=10] [--dry-run] [--at=<ISO time>]
// (--at rehearses a moment in the schedule window; use it with --dry-run.)
// Restarting needs the gh CLI with GH_TOKEN (and GH_REPO outside a checkout).

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { arg, connectPg, flag, loadEnv } from "./lib/bulk.mjs";
import { bucket, raiseAlert } from "./lib/alerts.mjs";
import { activeElections, etDate, parseSchedule } from "../src/lib/elections/close-races/schedule.ts";

loadEnv();
const STALE_MIN = Number(arg("stale-minutes", 10));
const DRY_RUN = flag("dry-run");
const AT = arg("at") ? new Date(arg("at")) : new Date();
const WORKFLOW = "ga-results-watch.yml";
const schedule = parseSchedule(JSON.parse(fs.readFileSync("data/elections/ga/schedule.json", "utf8")));

const minutesAgo = (r) => (r.minutes == null ? Infinity : Number(r.minutes));
// A worker is alive while its watch or waiting heartbeat is fresh.
const alive = (r) => (r.mode === "watch" || r.mode === "waiting") && minutesAgo(r) <= STALE_MIN;
// A live watch that went quiet, or a run that ended and never handed off.
// Daily loads ("load") and deliberate stops are left alone.
const dead = (r) => ((r.mode === "watch" || r.mode === "waiting") && minutesAgo(r) > STALE_MIN) || (r.mode === "watch-ended" && minutesAgo(r) > 2 * STALE_MIN);

function watchRunPending() {
  const out = execFileSync("gh", ["run", "list", "--workflow", WORKFLOW, "--json", "status", "--limit", "10"], { encoding: "utf8" });
  return JSON.parse(out).some((r) => ["queued", "in_progress", "waiting", "requested", "pending"].includes(r.status));
}

function startWatch(entry) {
  const args = ["workflow", "run", WORKFLOW, "-f", `election=${entry.id ?? "auto"}`, "-f", `date=${entry.date}`, "-f", `kind=${entry.kind}`, "-f", "chain=true"];
  if (process.env.GITHUB_REF_NAME) args.push("--ref", process.env.GITHUB_REF_NAME);
  if (DRY_RUN) return console.log(`  would run: gh ${args.join(" ")}`);
  execFileSync("gh", args, { stdio: "inherit" });
}

const pg = await connectPg();
try {
  const { rows } = await pg.query(
    `select source_election_id, to_char(election_date, 'YYYY-MM-DD') as date, heartbeat_at, mode, is_official,
            extract(epoch from now() - heartbeat_at) / 60 as minutes
       from tracked_ingest_status
      where election_date >= $1::date - 60 and election_date <= $1::date + 1`,
    [etDate(AT)],
  );
  for (const r of rows) {
    const m = minutesAgo(r);
    console.log(`${r.source_election_id}: heartbeat ${Number.isFinite(m) ? `${m.toFixed(1)} min ago` : "never"} (${r.mode}${r.is_official ? ", official" : ""})`);
  }

  const handled = new Set();
  for (const entry of activeElections(schedule, AT)) {
    const forDate = rows.filter((r) => r.date === entry.date);
    forDate.forEach((r) => handled.add(r.source_election_id));
    if (forDate.length && forDate.every((r) => r.is_official)) continue;
    if (forDate.some(alive)) continue;
    let pending;
    try {
      pending = watchRunPending();
    } catch (err) {
      console.error(`  gh run list failed: ${err.message}`);
      pending = false;
    }
    if (pending) {
      console.log(`  ${entry.date}: no live worker, but a watch run is queued or running`);
      continue;
    }
    const why = forDate.length ? `worker heartbeat (${forDate.map((r) => `${r.source_election_id} ${r.mode}`).join(", ")}) is stale` : `no worker has started for ${entry.date}`;
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
  for (const r of rows.filter((r) => !handled.has(r.source_election_id) && !r.is_official && r.date <= etDate(AT) && dead(r))) {
    if (DRY_RUN) continue;
    await raiseAlert(pg, {
      election: r.source_election_id,
      key: `heartbeat:${bucket(30)}`,
      kind: "heartbeat",
      severity: "warning",
      message: `Ingest heartbeat is ${Number.isFinite(minutesAgo(r)) ? `${Math.round(minutesAgo(r))} min` : "missing"} old (${r.mode}); this election isn't in data/elections/ga/schedule.json, so it isn't restarted`,
    });
  }
} finally {
  await pg.end();
}
