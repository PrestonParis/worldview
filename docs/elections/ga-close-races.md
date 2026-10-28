# Georgia close-races report

Writ's close-races report ranks every Georgia result (federal, state, county and municipal) by the number of votes separating the winner or current leader from the nearest loser, live on election night. Percentage-point margin stays visible and sortable, but raw vote margin is the canonical ranking.

- Report: `/writ/close-races/[election]`
- Ingest: `npm run sync:ga-results` (`scripts/sync-ga-results.mjs`)
- Rules: `src/lib/elections/close-races/`
- Operations: [ga-close-races-runbook.md](ga-close-races-runbook.md)

## Source: Georgia SOS results (Enhanced Voting)

`results.sos.ga.gov` is the official results site, an Angular app on the
Enhanced Voting platform. The app reads a public, keyless JSON API. Every
endpoint below was verified with live requests on 2026-10-21.

Base: `https://results.sos.ga.gov/results/public/api`

| Endpoint | Returns |
|---|---|
| `GET /jurisdictions/Georgia` | 117 elections back to 2012-07-31 (`publicElectionId`, `electionDate`, `name`). Covers generals, primaries, runoffs, specials, and recounts. Ids are free-form: `2024NovGen`, `2020DecStateRun`, `GeneralPrimary51926`, `RECOUNTPSCDistrict3`. |
| `GET /elections/Georgia/{id}` | Election header: `isOfficialResults`, `lastUpdated`, `asOf`, report downloads (Excel). |
| `GET /elections/Georgia/{id}/data` | About 0.9 MB. Statewide and district contests: 295 for `2024NovGen` (President, U.S. House, State Senate, State House, DAs, amendments, referendums). `jurisdiction.childLocalities` lists all 159 counties with `shortName` (`fulton-county-ga`) and `percentReporting`. |
| `GET /elections/{county}/{id}/data` | 100–300 KB per county. Contests whose `parentId` matches a state contest id are that county's slice of it, which gives the county breakdown for free. Contests with `parentId: null` are local: sheriff, clerk, tax commissioner, county commission, city council, board of education, and local tax questions. Also includes `precincts` (Fulton has 466). |
| `GET /elections/Georgia/{id}/closeraces` | The vendor's own close-race list. It's empty after certification, so it can't be relied on; we compute our own. |
| `/stats`, `/turnout`, `/vr`, `/localities` | Turnout and registration. |
| `GET https://results.sos.ga.gov/cdn/results/Georgia/export-{id}.json` | Full media export (33 MB for `2024NovGen`). |

Contest shape (`ballotItems[]`):
- Fields: `id`, `parentId`, `name`, `voteFor` ("Vote for 1"), `contestType`, `reportingStatus {reportingUnits, totalUnits, asOf}`, `voteTotal`.
- Options are in `summaryResults.ballotOptions[]`, each with `name`, `voteCount`, `party.abbreviation`, `isWriteIn`, and `groupResults[]`. `groupResults` splits the vote by method: Advanced Voting, Election Day, Absentee by Mail, Provisional.

Quirks:
- `isWinner` is null even on certified elections. We compute winners ourselves.
- Referendums come as `contestType: "Candidate"` with `Yes`/`No` options. Detect them by option names.
- Candidate names include the markers: `Mack Jackson (I) (Dem)`. Parse out incumbent and party, then keep the clean name.
- Uncontested races have one option (21 of Fulton's 50 contests in 2024). Count them but don't rank them.
- A local contest that crosses county lines (Atlanta is in both Fulton and DeKalb) shows up in each county feed with `parentId: null`. Merge by normalized name plus election and sum the votes, and flag the merge in the run report.
- SOS adds an election to the list close to election day, so poll the list.
- Cities that run their own elections, outside the county board, may not be in this feed. The election-night reporting rule guarantees transmission of state-office results to the SOS, not a complete set of independently administered municipal contests. They are listed per election in `data/elections/ga/schedule.json` and read from the city's own page (see "City-run elections").

Fallbacks:
- OpenElections GA and Redistricting Data Hub precinct files cover federal, state, and legislative races only. MEDSL covers federal only.
- No single alternative source has all local races. The SOS feed is the primary source; county and municipal election pages are the exception path for contests missing from it.

### Coverage

"All Georgia races" is a measured claim, not an assumption about the feed, and it is measured without hand counts. SOS publishes each election's ballot definition before polls close: every contest in every county feed, with zero votes. The first copy of each county feed is stored as that county's baseline (`tracked_contest_baseline`, keyed by normalized contest name; later feeds only add to it). Every load then compares each county feed with its baseline (`src/lib/elections/close-races/coverage.ts`):

- `complete`: every baseline contest is still in the feed;
- `partial`: a baseline contest left the feed (the coverage row and alert name it);
- `missing`: the county feed couldn't be fetched.

City-run elections are listed as municipalities: expected is the contests configured for the city, observed is the contests tracked. The report header shows `observed / expected` contests and jurisdictions complete, and links to the coverage panel; it never claims a county complete that it hasn't fetched.

### City-run elections

`schedule.json` lists, per election date, each city that runs its own election: its results page, poll-closing time, and each contest with its qualified candidates. `scripts/lib/city-results.mjs` stores the contests with no votes from the start. After polls close, every 10 minutes, it reads the page and any results document it links to (HTML or PDF, `unpdf`). A contest gets votes once every candidate has a vote count printed after their name (`src/lib/elections/close-races/city.ts`: percentages, dates, times and years are skipped; two different readings for one name are refused). Rows are stored under source `city:{id}` beside the SOS rows of the same election and ranked with them; a complete SOS round never removes them.

Sanity check: a quick ranking of `2024NovGen` (state feed plus Fulton and
Appling) puts State House 128 first (48 votes, 0.17 pts) and HD 105 second
(80 votes, 0.26 pts). HD 105 is the race SOS later lists as
"State House of Representatives District 105 Recount", which matches.

## Data model

New tables, independent of entities. The pattern follows `election_results`: keyed `external_id`, idempotent upserts. Migration: `supabase/sql/2026-10-22-tracked-contests.sql`, which also adds `tracked_ingest_status` (worker heartbeat) and `tracked_alerts`.

**`tracked_contests`**
- `id`
- `source`: `ga-sos`.
- `external_id`: `ga-sos:{electionId}:{contestId}`. Merged multi-county local contests key on `ga-sos:{electionId}:local:{slug}`.
- `source_election_id`, `election_date`, `election_kind` (general/primary/runoff/special/recount), `state` = `GA`.
- `name`: raw. `office`, `district`: parsed.
- `level`: enum `federal | statewide | legislative | judicial | county | municipal | school | referendum`. Set by a name-rule table in `src/lib/elections/close-races/level.ts`, plus the county-feed origin.
- `county`: null for state-feed contests; `municipality`, `jurisdiction_type`, and `jurisdiction_id` where applicable.
- `vote_for`, `total_votes`, `reporting_units`, `total_units`.
- `decision_rule`: `majority | plurality | top_n | referendum | unknown`; `rule_source`; `seats_to_fill`; `threshold`.
- `result_status`: `no_results | reporting | unofficial_complete | county_certified | state_certified | recount_pending | contested`; `as_of`.
- `source_updated_at`, `ingested_at`, and `source_hash`. These distinguish a stale Worldview ingest from a source that has not changed.
- `election_id`: nullable FK to `elections`. Set for races we already scaffold (U.S. Senate, Governor, U.S. House) so Writ race dockets can show live numbers.
- Derived and stored for sorting: `margin_votes`, `margin_pct`, `leader_share`, `flags text[]`.

**`tracked_contest_options`**
- `contest_id`, source option id, `name`, `party`, `incumbent`, `is_write_in`, `votes`, `votes_by_method jsonb`, `rank`, `is_current_leader`, `is_apparent_winner`.

**`tracked_contest_areas`**
- `contest_id`, `option_id`, `county`, `votes`: county splits for state-feed contests, taken from the county feeds' `parentId` rows.
- Size: about 300 contests × 3 options × 159 counties ≈ 140k rows per general. Check the size before loading to cloud (the Supabase free plan caps at 500 MB). If it's tight, move this table to Neon via `datasets.storage` like `area_stats`.

**`tracked_snapshots`**
- `contest_id`, `as_of`, leader and runner-up option ids and vote totals, `total_votes`, `margin_votes`, `margin_pct`, `reporting_units`, `total_units`, `result_status`, and `source_hash`. Written only when the source payload changes.
- Powers "margin at 11 pm vs. now" and an overnight movement chart.

**`tracked_contest_coverage`**
- `source_election_id`, jurisdiction id and name, jurisdiction type.
- `expected_count` (baseline contests), `observed_count`, `status` (`complete | partial | missing`).
- source URL, notes (dropped contests, city read status), and any locally published results URL.
- Powers the report's completeness statement.

**`tracked_contest_baseline`**
- `source_election_id`, `jurisdiction_id` (county slug), `contest_key`, `name`, `captured_at`: the first copy of each county feed's contests.

Precincts and raw JSON: write the raw `/data` payloads to the data lake (`src/lib/db/lake.ts`, `export-lake.yml`), not Postgres. That keeps every snapshot replayable without touching the 500 MB cap.

## Margin and decision rules

Pure modules in `src/lib/elections/close-races/` (`margin.ts`, `rules.ts`, `evaluate.ts`), tested against saved feed fixtures in `close-races.test.ts`. Municipal runoff rules are sourced in `data/elections/ga/municipal-rules.json`.

- **Canonical ranking:** absolute `margin_votes` ascending. This is the answer to “which race was won or lost by the fewest votes?” The tie-break is `margin_pct` ascending, then stable contest name.
- **Alternate ranking:** `margin_pct` ascending, preserved as `sort=percent` in the URL and export. Never label one ranking as the other.
- **Single seat:** `margin_votes = v1 − v2`; `margin_pct = margin_votes / total × 100`. The denominator is every vote cast for the office, including qualified write-ins represented in the official total.
- **Vote for N:** the gap between the Nth and (N+1)th candidate, meaning the last apparent winner versus the first loser. Unranked if there are N or fewer options. Store the cutoff candidates so a later tie or correction can be reconstructed.
- **Referendum:** the absolute gap between the leading and trailing choices. Store the actual statutory threshold when it is not a simple majority; otherwise use `decision_rule: referendum` and `threshold: 0.5`.
- **Runoff line:** statewide and nonmunicipal candidate contests generally require a majority, except presidential electors. Municipal charters and ordinances may authorize plurality elections. Resolve this into `decision_rule`; do not show a definitive runoff badge when the rule is `unknown`.
  - `runoff_required` when a verified majority-rule contest is below its threshold.
  - `near_runoff` when a verified majority-rule contest is within 1 point of its threshold.
  - `runoff_rule_unverified` when a municipal contest's rule has not been sourced.
- **Recount range:** `recount_request_range` when `margin_pct ≤ 0.5`. Georgia does not automatically recount these candidate races; a qualifying losing candidate may request one within two business days after certification. For constitutional amendments and binding referendum questions, the authorized recount is discretionary. UI copy must say “within recount-request range,” not “recount.”
- **Uncontested:** counted per level and shown in a collapsed section, not ranked.
- **Exact ties:** rank ahead of one-vote margins, label as `Tie`, and never infer a winner.
- **Zero results:** show in coverage and reporting counts but exclude from the ranked list until at least two options have vote totals.

## Ingest: `scripts/sync-ga-results.mjs`

Built on `scripts/lib/bulk.mjs` and run as `npm run sync:ga-results`, with each run logged to `sync_runs` like the other syncs. Storage is in `scripts/lib/close-races-store.mjs`, the SOS client in `scripts/lib/ga-sos.mjs`, alerts in `scripts/lib/alerts.mjs`.

Modes:
- `--list`: print new or unseen election ids from `/jurisdictions/Georgia`.
- `--election=ID`: fetch the state feed plus the 159 county feeds (about 40 MB) at 4–8 concurrent requests with retry and backoff, then upsert contests, options, areas, and snapshots.
- `--watch --election=ID [--every=180]`: re-poll the election header and fetch `/data` when `lastUpdated`, ETag, Last-Modified, or a content hash changes. Keep going until all tracked certification scopes are complete or the process is stopped. Do not skip a county solely because its percent-reporting value is unchanged: corrected totals, provisional ballots, cures, and other additions can change votes without changing that percentage.
- `--backfill=2012-2026 [--kinds=general,runoff]`: load history. Run it after Nov 3, never during.
- `--dry-run`: parse and rank, print the top 25, write nothing.

Source fallback order:

1. state and county JSON API;
2. SOS full media export;
3. SOS Excel report for reconciliation and recovery;
4. a county or municipal election authority for a contest documented as missing from the state feed;
5. last-known-good snapshot, visibly marked stale, when no current source is available.

Every fetch writes source URL, response timestamp, content hash, status and error information to the sync run. Apply bounded concurrency, exponential backoff and a request ceiling. Cache unchanged responses; election night is not permission to overload an undocumented public API.

### Unattended operation

Nothing needs an operator. `data/elections/ga/schedule.json` lists the elections to follow (date, kind, SOS id if known, watch start, `stopAfter`, city-run elections).

- **Start:** `GA results watch` (`.github/workflows/ga-results-watch.yml`) starts itself at 4:17 pm ET on each scheduled date and reads the election from the schedule. `--election=auto --date --kind` finds the listed election. If SOS hasn't listed it, the run watches the scheduled id, or a placeholder when that's null.
- **Waiting:** while the feed is missing, the run waits (mode `waiting`, with a heartbeat).
- **Id changes:** the run switches when SOS lists the election under another id. It records `replaces` on the new status row, and the report redirects the old URL.
- **Every election on the date:** each one SOS lists for the date (a special runoff beside the general runoff, a recount) is followed in the same loop.
- **Errors:** a failed fetch or write is logged and retried on the next round; it doesn't end the run.
- **Hand-off:** each run polls for up to 5h45m. It then dispatches the next one, even after a failed or timed-out run, until every status row for the date is official or `stopAfter` passes (`scripts/ga-results-schedule.mjs --handoff`).
- **Watchdog:** `GA results health` (`scripts/ga-results-health.mjs`) runs every 10 minutes. When no worker for a scheduled election is alive and no watch run is queued or running, it dispatches the watch itself (`actions: write`). That covers a dropped scheduled start, a broken chain and a crashed run.
- **After election night:** `GA results daily` loads every unofficial election and every scheduled one past its day, one at a time, so one failure doesn't stop the others. It publishes the morning CSV and reconciles an election against the SOS media export once it turns official.
- **Laptop:** the same command can run from a laptop against `ENV_FILE=.env.cloud` alongside Actions. The importer is idempotent.

Operational alerts:

- no successful state fetch for 10 minutes while results are active;
- any jurisdiction stale for 15 minutes while the source shows it reporting;
- expected contest missing, duplicate contest merge, vote total decreasing, leader changing, exact tie, or certification regressing;
- database write failure or report cache older than the latest ingest;
- coverage below 100%, with the missing jurisdictions and dropped contests named;
- a city results page that changed after polls closed but couldn't be read;
- the watch restarted by the watchdog, and reconcile mismatches after certification.

Alerts report what already happened; none asks for a reply.

## Report (Writ)

- Route: `/writ/close-races/[election]` (`/writ/close-races` picks the current election). Loaders are in `src/lib/db/closeRaces.ts` (`loadCloseRaces`, `loadCloseRaceRows`); components are `src/components/tools/writ/close-races-*.tsx`. The ingester revalidates the page through `/api/writ/revalidate` after each write.
- Table columns:
  - Rank and race.
  - Level and county.
  - Leader and runner-up, with party and incumbent markers.
  - Margin, in votes and points.
  - Leader share and distance from 50.
  - % reporting.
  - Result status: reporting, unofficial complete, county certified, state certified, recount pending, or contested.
  - Badges: within recount-request range, runoff required, near runoff, rule unverified.
  - Margin change since the previous snapshot.
- Rows link to the race docket when `election_id` is set. Otherwise they open an inline detail view with the county splits and the vote-method split.
- Filters (in the URL so views can be shared): ranking (`votes | percent`), level, county, municipality, office text, margin cutoff, result status, and election kind.
- Default order is smallest vote margin first. A visible sort control switches to percentage-point margin; CSV preserves the selected sort and includes both values.
- A header shows “Source updated,” “Worldview updated,” `observed / expected` coverage, and result/certification scope. Revalidate on a short tag-based cache, about 60 s, using the same pattern as the `area_stats` reads and invalidate after a successful ingest.
- “100% reporting” is labeled as reporting units, not ballots, and carries a note that provisional, cured absentee, and eligible overseas ballots may still be added before certification.
- CSV export of the filtered list.
- A timestamped morning snapshot is generated automatically after election night and remains downloadable even while live results continue changing.
- Later:
  - A county map of one close race, reusing the `src/components/elections` choropleth.
  - A history view of the closest GA races across every cycle since 2012.
  - Alerts when a followed race enters recount or runoff range.

## Acceptance checks

Before each election, confirm:

- every federal, state, county and city-run contest is either loaded or explicitly reported missing;
- the default order is ascending raw vote margin, with percentage order available separately;
- single-seat, multi-seat, referendum, uncontested, tie and no-result cases pass fixtures;
- municipal runoff badges appear only when the decision rule is verified;
- recount copy says eligibility/request range rather than implying an automatic recount;
- source update, Worldview update, reporting status and certification status are distinct;
- a source correction and leader change produce correct snapshots without duplicate records;
- the API, media export and last-known-good fallback paths have been exercised;
- a full replay completes under election-night polling cadence;
- the live page and CSV contain the same filtered contests and ordering;
- stale data is visible within 10 minutes, and a dead worker is restarted by the watchdog within 10 minutes;
- a second worker (laptop) can run alongside without database cleanup;
- the morning snapshot can be produced even if the public host is unavailable.

## Deferred work

- Matching tracked candidates to `politician` entities for Subpoena cross-links. Do it only for winners of federal, statewide, and legislative races.
- Historical rankings until each election has a coverage grade; “since 2012” must not imply uniform local coverage.
- County maps, followed-race alerts, additional states and long-term trend views.
- PDF delivery; CSV is the resilient fallback.
