// Answers the GA results workflows' questions from data/elections/ga/schedule.json
// and tracked_ingest_status, so no run needs an operator's input.
//
// Usage:
//   node scripts/ga-results-schedule.mjs --for-date=2026-11-03   → GITHUB_OUTPUT lines: active, election, date, kind
//   node scripts/ga-results-schedule.mjs --handoff --date=2026-11-03   → "continue" or "stop"
//   node scripts/ga-results-schedule.mjs --daily   → one "<election> <date> <kind>" line per election to load

import fs from "node:fs";
import { etDate, parseSchedule, scheduledOn } from "../src/lib/elections/close-races/schedule.ts";

// --for-date runs before `npm ci`, so the database helpers load only when needed.
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const flag = (name) => process.argv.includes(`--${name}`);
async function connect() {
  const { connectPg, loadEnv } = await import("./lib/bulk.mjs");
  loadEnv();
  return connectPg();
}

const schedule = parseSchedule(JSON.parse(fs.readFileSync("data/elections/ga/schedule.json", "utf8")));

if (arg("for-date")) {
  const entry = scheduledOn(schedule, arg("for-date"));
  console.log(`active=${Boolean(entry)}`);
  console.log(`election=${entry?.id ?? "auto"}`);
  console.log(`date=${entry?.date ?? ""}`);
  console.log(`kind=${entry?.kind ?? ""}`);
} else if (flag("handoff")) {
  const date = arg("date");
  const entry = scheduledOn(schedule, date);
  if (entry && etDate() > entry.stopAfter) {
    console.log("stop");
  } else {
    const pg = await connect();
    try {
      const { rows } = await pg.query("select bool_and(is_official) as done from tracked_ingest_status where election_date = $1", [date]);
      // No rows yet on a scheduled date means the feed hasn't appeared: keep
      // waiting. On any other date (a run started by hand) it means stop.
      const done = rows[0].done;
      console.log(done === true || (done === null && !entry) ? "stop" : "continue");
    } finally {
      await pg.end();
    }
  }
} else if (flag("daily")) {
  const pg = await connect();
  try {
    const { rows } = await pg.query(
      "select source_election_id, to_char(election_date, 'YYYY-MM-DD') as date, election_kind from tracked_ingest_status where not is_official and election_date >= current_date - 60 and source = 'ga-sos'",
    );
    const lines = rows.map((r) => `${r.source_election_id} ${r.date} ${r.election_kind}`);
    // A scheduled election past its day with no status row yet (its watch
    // never saw a feed): load it by date so it isn't skipped.
    const today = etDate();
    for (const e of schedule.filter((e) => e.date < today && today <= e.stopAfter && !rows.some((r) => r.date === e.date))) {
      lines.push(`${e.id ?? "auto"} ${e.date} ${e.kind}`);
    }
    for (const line of lines) console.log(line);
  } finally {
    await pg.end();
  }
} else {
  console.error("usage: --for-date=YYYY-MM-DD | --handoff --date=YYYY-MM-DD | --daily");
  process.exitCode = 1;
}
