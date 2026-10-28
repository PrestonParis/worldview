# Writ close races: runbook

Georgia's Nov 3, 2026 general and the Dec 1 runoff run unattended: nothing
below needs a person on the night. Design: [ga-close-races.md](ga-close-races.md).
Every command runs from the repo root. `ENV_FILE=.env.cloud` points a
command at production; leave it off to work against the local stack.

## 1. What runs on its own

| Workflow | When | Does |
|---|---|---|
| `GA results watch` | 4:17 pm ET on each date in `data/elections/ga/schedule.json` (Nov 3, Dec 1) | Finds the election, waits while its feed is missing, polls every 3 min, loads every county feed and every city-run election, and writes. Each run lasts 5h45m, then starts the next one, even after a failure, until results are official or the entry's `stopAfter` date passes. |
| `GA results health` | Every 10 min, Nov 3–30 and Dec 1–20 | When no worker is alive for a scheduled election and no watch run is queued or running, starts the watch again. This covers a dropped scheduled start, a broken hand-off, and a crashed or timed-out run. |
| `GA results daily` | 13:00 UTC, Nov 4–30 and Dec 1–20 | Full load of every unofficial election (one failure doesn't stop the rest), then the morning CSV snapshot. When an election turns official, it is reconciled once against the SOS media export. |

All three post to `ALERT_WEBHOOK_URL`. Alerts are informational: each says what already happened, and none needs a reply.

## 2. Election ids

- **Unlisted id:** SOS adds an election to its list close to the day. The Nov 3 id `11032026GeneralAndSpecialElection` is in `schedule.json` because SOS hasn't listed it. Its feed was live on Oct 24 and has been 404/empty since Oct 26. The watch waits (mode `waiting`) and loads once the feed appears.
- **Id published later:** the Dec 1 runoff has `id: null`. The watch starts under a placeholder and switches when SOS lists a runoff for the date.
- **Republished id:** if SOS publishes an election under a new id, the watch switches to it.
- **What a switch does:** it drops the empty row for the old id and records the old id in `replaces`. The old report URL redirects to the new one.
- **Several elections on one date:** every election SOS lists for the date is followed in the same run (Dec 1, 2020 had a state runoff and a special runoff, and recounts share dates).

## 3. Coverage

Coverage is measured, not hand-counted.

- **Baseline:** SOS lists every contest, with zero votes, before polls close. The first copy of each county feed is stored as that county's baseline (`tracked_contest_baseline`).
- **Partial:** a contest that later drops out of a county feed makes the county partial, and the alert names the contest.
- **Missing:** a county feed that can't be fetched makes the county missing.
- **City-run elections:** each one is listed as its own municipality.

## 4. City-run elections

- **Where they come from:** cities that run their own election aren't in the SOS feed. They are listed under `cities` in `schedule.json`, with the results page and the qualified candidates.
- **How results are read:** after polls close, the watch reads the page every 10 minutes, plus any results document it links to (HTML or PDF). It stores a contest once every candidate has a vote count next to their name.
- **Before results:** the contest is listed with no results.
- **Unreadable page:** a posted page that doesn't parse raises one info alert per version of the page.
- **Nov 3:** Norcross, one council seat, hand-counted at City Hall.
- **Adding a city:** add its entry with `resultsUrl`, `pollsCloseUtc` and `contests[].candidates`.

## 5. Health at a glance

| Check | Healthy |
|---|---|
| Report header "Worldview updated" | Within a few minutes of "Source updated" |
| Operator panel on the report (owner login) | Heartbeat < 5 min, fetch source `api`, error count flat |
| `tracked_ingest_status` | `mode = watch` (or `waiting` before results), `heartbeat_at` recent |
| GitHub Actions | One `GA results watch` run in progress or queued |

## 6. Alerts

| Alert | Means |
|---|---|
| No successful state fetch for N min | API and media export both failing. The page serves last-known-good data. Polling continues. |
| County stale | A county shows newer results than our copy. Usually clears on the next poll. |
| Leader changed / Exact tie | A ranked race flipped or tied. |
| Vote total went down | SOS corrected a count. The new number is the record. |
| Certification went backwards | A contest was un-certified. `recount_pending` or `contested` can be set in `overrides-<id>.json`. |
| Coverage below 100% | A county feed failed, or a contest left a county feed. The coverage panel names it. |
| Check merge (panel only) | A cross-county race merged under different names, or a same-named question didn't merge. `split` / `merge` in `overrides-<id>.json`. |
| Watch restarted automatically | The watchdog found no live worker and started the watch. |
| Watch run failed | One Actions run failed. The next run or the watchdog picks it up. |
| Certified results differ from the media export | Reconcile found mismatches (listed in the alert payload). |

## 7. Commands (optional)

```sh
# Watch from a laptop alongside Actions (same writes; idempotent):
ENV_FILE=.env.cloud npm run sync:ga-results -- --election=auto --date=2026-11-03 --watch --every=180 --until=8h

# One-off full load / dry run that writes nothing:
ENV_FILE=.env.cloud npm run sync:ga-results -- --election=<id>
npm run sync:ga-results -- --election=<id> --dry-run

# Watchdog decision for a moment in the window, without acting:
node scripts/ga-results-health.mjs --dry-run --at=2026-11-03T21:00:00Z
```

## 8. Rehearsal

Play a past election back as election night, with a leader flip, a downward correction and a feed outage:

```sh
node scripts/ga-results-replay.mjs --election=GeneralPrimary51926 --frames=8 --step=20
npm run sync:ga-results -- --base-url=http://localhost:4319 --election=auto --date=2026-11-03 --watch --every=5 --until=4m
```

The replay lists its election under 2026-11-03, so this also exercises the scheduled-id wait and the following of every listed election. Delete the `REPLAY…` rows afterwards, and never run a rehearsal against cloud.

## 9. Snapshots

`GA results daily` writes `exports/close-races/ga-close-races-<id>-by-votes-<timestamp>.csv` each morning. It publishes it to the lake bucket (`writ/close-races/<id>/…`) and prints the public URL. By hand:

```sh
ENV_FILE=.env.cloud npm run sync:ga-results -- --election=<id> --snapshot [--sort=percent]
```

## 10. One-time setup (before Nov 3)

1. Deploy, which applies the migrations, including `2026-10-28-tracked-baseline.sql`.
2. Set the repo secrets: `DATABASE_URL`, `ALERT_WEBHOOK_URL`, `SITE_URL`, `REVALIDATE_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Set `REVALIDATE_SECRET` in the site's env too.
3. Optional: add a Vercel firewall bypass for `/api/writ/revalidate`, `/writ/close-races` and `/api/writ/close-races`. The Security Checkpoint returns 429 to scripted requests. Without the bypass, pages still refresh within 60 s.
