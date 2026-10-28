# Writ close races: election-night runbook

For the operators running Georgia's Nov 3, 2026 general (and the Dec 1
runoff). Design: [ga-close-races.md](ga-close-races.md). Every command
runs from the repo root. `ENV_FILE=.env.cloud` points a command at
production; leave it off to work against the local stack.

## 1. People

| Role | Name | Contact | Machine |
|---|---|---|---|
| Primary operator | | | GitHub Actions `GA results watch` |
| Backup operator | | | Laptop with `.env.cloud` |

Both of you subscribe to `ALERT_WEBHOOK_URL`. An ntfy.sh topic gives phone push.

## 2. Commands

```sh
# Primary: GitHub → Actions → "GA results watch" → Run workflow
#   election=11032026GeneralAndSpecialElection, date=2026-11-03, every=180, until=5h45m, chain=true
# It hands off to a fresh run every ~6 h until results are official.

# Backup, or takeover from a laptop (same writes; safe to run alongside):
ENV_FILE=.env.cloud npm run sync:ga-results -- --election=11032026GeneralAndSpecialElection --date=2026-11-03 --watch --every=180 --until=8h

# One-off full load / dry run that writes nothing:
ENV_FILE=.env.cloud npm run sync:ga-results -- --election=<id>
npm run sync:ga-results -- --election=<id> --dry-run
```

## 3. Election id

SOS adds the election to its list close to the day. Check it:

```sh
npm run sync:ga-results -- --list | head
```

The Nov 3 general is `11032026GeneralAndSpecialElection`. It is not in the SOS list, so `--election=auto` can't find it: pass the id. Its feed was live on Oct 24 and returned 404/empty again on Oct 26; a watch started before the feed is back waits (mode `waiting`) and loads once it appears. Once the id is known (e.g. `2026NovGen`), pass it explicitly. The report is then at `/writ/close-races/<id>`.

## 4. Expected counts

- **Counties:** 159 county feeds for a general. A special election lists only the counties taking part. The run prints `n/159 counties`.
- **Contests:** the May 19, 2026 primary had 1,780 contests (554 on the state feed). The general will be about that size: fewer partisan pairs, more county, city and school contests.
- **Coverage manifest:** `data/elections/ga/coverage-<id>.json`. Create it with `npm run sync:ga-results -- --election=<id> --coverage-template`, then fill `expected` per county from qualified-candidate lists and sample ballots. Add each city that runs its own election under `municipalities` (with `resultsUrl`). Until a county is filled in, the report says it's unverified. Each county records its `basis`: `sample-ballot` (the county's composite ballot) or `notice` (its legal notices added up) are checked and carry `verifiedAt`; `ballot-definition` is a baseline copied from the SOS feed before the election, with no `verifiedAt`. Count one per candidate contest (each district or post) and one per question; write-in lines don't count.
- **Municipal runoff rules:** `data/elections/ga/municipal-rules.json`. Add a city only with a cited charter or ordinance.

## 5. Health checks

| Check | Healthy |
|---|---|
| Report header "Worldview updated" | Within a few minutes of "Source updated" |
| Operator panel on the report (owner login) | Heartbeat < 5 min, fetch source `api`, error count flat |
| `tracked_ingest_status` | `mode = watch`, `heartbeat_at` recent |
| GitHub Actions | One `GA results watch` run in progress |
| Watchdog (`GA results health`, every 10 min) | No heartbeat alerts |
| CSV download | Same rows and order as the page |

## 6. Alerts

| Alert | Means | Do |
|---|---|---|
| No successful state fetch for N min | API and media export both failing; page serves last-known-good | Open results.sos.ga.gov in a browser. If SOS is down, wait. If only we're blocked, start the laptop backup. |
| County stale | A county shows newer results than our copy | Usually clears on the next poll. If it persists, check that county's page on the SOS site. |
| Leader changed | A ranked race flipped | Expected on election night. Check the race on the SOS site if the margin is tiny. |
| Vote total went down | SOS corrected a count | Confirm on the SOS site. The new number is the record; note it. |
| Exact tie | Margin 0 | Confirm. Ties rank first and name no winner. |
| Certification went backwards | A contest was un-certified | Confirm with the county. Set `recount_pending` or `contested` in `overrides-<id>.json` if that's the reason. |
| Coverage below 100% | A county feed failed, or a manifest count isn't met | Check the coverage panel. Fetch from the local authority if needed and note it in the manifest. |
| Check merge (operator panel only, not pushed) | A cross-county race merged under different names, or a same-named question didn't merge | Confirm. Use `split` or `merge` in `overrides-<id>.json`. |
| Heartbeat (watchdog) | The worker is dead or didn't hand off | Start the laptop backup now, then restart the workflow. |
| GA results watch run failed | The Actions job failed | Read the log, rerun the workflow, and cover from the laptop meanwhile. |

## 7. Failover, restart, replay

- **Takeover:** run the backup command (§2). Nothing needs cleaning up: contests key on election and name, and unchanged data writes nothing.
- **Restart:** rerun the workflow. The first poll does a full load.
- **Rehearsal:** play a past election back as election night, with a leader flip, a downward correction and a feed outage. Do this before every election:

  ```sh
  node scripts/ga-results-replay.mjs --election=GeneralPrimary51926 --frames=8 --step=20
  npm run sync:ga-results -- --base-url=http://localhost:4319 --election=REPLAYGeneralPrimary51926 --watch --every=5 --until=4m
  ```

  Delete the `REPLAY…` rows afterwards; never run a rehearsal against cloud.

## 8. Morning snapshot (Nov 4)

```sh
ENV_FILE=.env.cloud npm run sync:ga-results -- --election=<id> --snapshot
ENV_FILE=.env.cloud npm run sync:ga-results -- --election=<id> --snapshot --sort=percent
```

Each command writes `exports/close-races/ga-close-races-<id>-by-<sort>-<timestamp>.csv` and publishes it to the lake bucket (`writ/close-races/<id>/…`). It prints the public URL. This works even if the site is down. Send it with a short note: the coverage line from the report header, and that results are unofficial until certified.

## 9. After election night

- `GA results daily` loads every unofficial election at 13:00 UTC and publishes a snapshot, until Dec 15.
- Georgia counties certify within days of the election; the state certifies after that. Contests move to `county_certified` and then `state_certified` on their own.
- **Dec 1 runoff:** same steps with the runoff's id and a runoff manifest.
- **Shut down** when every tracked contest is certified: disable `GA results health` and `GA results daily`.

## 10. Notes and reconciliation

- Log incidents as you go: time, alert, action, outcome.
- After certification, run `npm run sync:ga-results -- --election=<id> --reconcile`. It compares every contest's total with the SOS media export, and should report 0 mismatches.

## Preflight (Nov 2)

1. Apply the migration on cloud (`ENV_FILE=.env.cloud node scripts/migrate.mjs`, or deploy). Check database size first (the Supabase free plan caps at 500 MB): the Nov 3 general needs about 25–45 MB through certification (contests ~5 MB, county rows 5–18 MB, snapshot history 15–20 MB), the Dec 1 runoff 2–5 MB. Keep 100 MB free.
2. Set secrets: repo secrets `ALERT_WEBHOOK_URL`, `SITE_URL`, `REVALIDATE_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, plus `REVALIDATE_SECRET` in the site's env.
3. Send a test alert: `node -e 'import("./scripts/lib/alerts.mjs").then(m => m.sendWebhook("test"))'`.
4. Check the source without writing: `npm run sync:ga-results -- --election=<id> --dry-run`.
5. Load the 2026 cycle so far on cloud (primary, runoffs, specials): `ENV_FILE=.env.cloud npm run sync:ga-results -- --all`. The ingester refuses elections outside 2026.
6. Run the rehearsal (§7). Check the public page loads on the production host.
7. Export a database backup.
