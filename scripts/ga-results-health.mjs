// Watchdog for the close-races ingest (.github/workflows/ga-results-health.yml):
// alerts when an unofficial tracked election's worker heartbeat is older
// than 10 minutes, i.e. the watch run died or was never started again.
//
// Usage: node scripts/ga-results-health.mjs [--stale-minutes=10]

import { arg, connectPg, loadEnv } from "./lib/bulk.mjs";
import { bucket, raiseAlert } from "./lib/alerts.mjs";

loadEnv();
const STALE_MIN = Number(arg("stale-minutes", 10));
const pg = await connectPg();
try {
  const { rows } = await pg.query(
    `select source_election_id, election_name, heartbeat_at, mode,
            extract(epoch from now() - heartbeat_at) / 60 as minutes
       from tracked_ingest_status
      where not is_official and election_date >= current_date - 60 and election_date <= current_date`,
  );
  for (const r of rows) {
    const minutes = r.minutes == null ? Infinity : Number(r.minutes);
    // A live watch run that went quiet, or a run that ended and never
    // handed off. Daily loads ("load") and deliberate stops are left alone.
    const dead = (r.mode === "watch" && minutes > STALE_MIN) || (r.mode === "watch-ended" && minutes > 2 * STALE_MIN);
    console.log(`${r.source_election_id}: heartbeat ${Number.isFinite(minutes) ? `${minutes.toFixed(1)} min ago` : "never"} (${r.mode})`);
    if (dead) {
      await raiseAlert(pg, {
        election: r.source_election_id,
        key: `heartbeat:${bucket(30)}`,
        kind: "heartbeat",
        severity: "critical",
        message: `Ingest heartbeat is ${Number.isFinite(minutes) ? `${Math.round(minutes)} min` : "missing"} old (${r.mode}); start the backup (see docs/writ-close-races-runbook.md)`,
      });
    }
  }
} finally {
  await pg.end();
}
