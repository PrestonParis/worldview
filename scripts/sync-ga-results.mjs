// Georgia close-races ingest for Writ (docs/elections/ga-close-races.md, "Ingest"): every
// contest in the Secretary of State's results system — state feed plus the
// 159 county feeds — into the tracked_* tables, ranked by margin.
//
// Source: results.sos.ga.gov (Enhanced Voting), a public keyless JSON API.
// Fallback order: JSON API → SOS media export → last-known-good data with
// the heartbeat marked stale. Contest rules and margins live in
// src/lib/elections/close-races/ (shared with the Writ page).
//
// Usage:
//   npm run sync:ga-results -- --list
//   npm run sync:ga-results -- --election=GeneralPrimary51926 [--dry-run]
//   npm run sync:ga-results -- --election=auto --date=2026-11-03 --watch [--every=180] [--until=5h45m]
//   npm run sync:ga-results -- --election=GeneralPrimary51926 --snapshot [--sort=votes|percent]
//   npm run sync:ga-results -- --election=GeneralPrimary51926 --reconcile
//   npm run sync:ga-results -- --election=2026NovGen --coverage-template
//   npm run sync:ga-results -- --all            (every 2026-cycle election listed so far)
//   ENV_FILE=.env.cloud npm run sync:ga-results -- …        (cloud)
//
// Options: --base-url=http://localhost:4319 (replay server, see
// scripts/ga-results-replay.mjs), --concurrency=4, --max-requests=30000,
// --archive-counties-every=60 (minutes).
//
// Hand-kept inputs in data/elections/ga/: municipal-rules.json (sourced
// majority/plurality rules by city), coverage-{id}.json (expected contests
// per county and named municipalities), overrides-{id}.json (manual
// recount_pending / contested statuses, merge splits).
//
// Scope: the 2026 cycle only (--cycle, default 2026). Elections dated in any
// other year are refused; the tracker is not a historical archive.
//
// Idempotent: contests key on ga-sos:{election}:{name key}; a re-run with an
// unchanged feed writes nothing, so a backup operator can take over at any
// time without cleanup.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { arg, connectPg, finishRun, flag, loadEnv, sleep, startRun } from "./lib/bulk.mjs";
import { archiveRaw, lakeUrl, upload } from "./lib/lake.mjs";
import { sosClient, SOS_BASE } from "./lib/ga-sos.mjs";
import { bucket, raiseAlert, sendWebhook } from "./lib/alerts.mjs";
import { bumpError, coverageRows, electionLinks, updateStatus, writeContests, writeCoverage } from "./lib/close-races-store.mjs";
import { electionKind, parseElectionList, parseFeed } from "../src/lib/elections/close-races/parse.ts";
import { assembleContests, normalizeName, stableHash } from "../src/lib/elections/close-races/merge.ts";
import { evaluateContest } from "../src/lib/elections/close-races/evaluate.ts";
import { compareByPercent, compareByVotes } from "../src/lib/elections/close-races/margin.ts";
import { parseMediaExport } from "../src/lib/elections/close-races/media-export.ts";
import { CLOSE_RACE_ROWS_SQL, filterReport, toReportRow } from "../src/lib/elections/close-races/rows.ts";
import { closeRacesCsv, closeRacesFilename } from "../src/lib/elections/close-races/csv.ts";

loadEnv();

const DATA_DIR = "data/elections/ga";
const EXPORT_DIR = "exports/close-races";
const DRY_RUN = flag("dry-run");
const CYCLE = Number(arg("cycle", 2026));
const inCycle = (date) => String(date ?? "").startsWith(`${CYCLE}-`);
const BASE = arg("base-url", SOS_BASE);
const WORKER = process.env.GITHUB_RUN_ID
  ? `github-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT ?? 1}`
  : `${os.hostname()}-${process.pid}`;
const MIN = 60_000;
const STATE_STALE_MS = 10 * MIN;
const COUNTY_STALE_MS = 15 * MIN;
const FULL_SWEEP_MS = 15 * MIN;

const client = sosClient({
  base: BASE,
  concurrency: Number(arg("concurrency", 4)),
  maxRequests: Number(arg("max-requests", 30_000)),
});

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  return Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith("_")));
}

function inputs(id) {
  return {
    municipalRules: readJson(path.join(DATA_DIR, "municipal-rules.json"), {}),
    manifest: readJson(path.join(DATA_DIR, `coverage-${id}.json`), null),
    overrides: readJson(path.join(DATA_DIR, `overrides-${id}.json`), {}),
  };
}

function duration(spec) {
  const m = String(spec).match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) throw new Error(`bad duration "${spec}" (use e.g. 5h45m or 90s)`);
  return (Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) * MIN + Number(m[3] ?? 0) * 1000;
}

const since = (date) => (date ? Date.now() - date.getTime() : Infinity);

// ── election discovery ──────────────────────────────────────────────────

async function listElections({ all = false } = {}) {
  const elections = parseElectionList((await client.list()).json);
  return all ? elections : elections.filter((e) => inCycle(e.date));
}

async function resolveElection(spec) {
  const elections = await listElections();
  if (spec && spec !== "auto") {
    const found = elections.find((e) => e.id === spec);
    const elsewhere = !found && (await listElections({ all: true })).find((e) => e.id === spec);
    if (elsewhere) throw new Error(`${spec} (${elsewhere.date}) is outside the ${CYCLE} cycle; the tracker only follows ${CYCLE} elections`);
    if (!found) console.warn(`  ${spec} isn't in the SOS election list (yet); continuing with it as given`);
    return found ?? { id: spec, date: null, name: spec, kind: electionKind(spec) };
  }
  const date = arg("date", new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }));
  const onDate = elections.filter((e) => e.date === date);
  const pick = onDate.find((e) => e.kind === "general") ?? (onDate.length === 1 ? onDate[0] : null);
  if (!pick) {
    throw new Error(
      onDate.length
        ? `several elections on ${date}; pass --election=: ${onDate.map((e) => e.id).join(", ")}`
        : `no election on ${date} in the SOS list yet (latest: ${elections[0]?.id} ${elections[0]?.date})`,
    );
  }
  console.log(`  --election=auto → ${pick.id} (${pick.name})`);
  return pick;
}

// ── fetching ────────────────────────────────────────────────────────────

function newContext(election, pg) {
  return {
    election,
    pg,
    state: null, // { feed, hash, fetchedAt, source: 'api' | 'media-export' }
    exportCounties: null,
    counties: new Map(), // slug -> { name, feed, hash, lastUpdated, fetchedAt, archivedAt }
    countyErrors: new Map(), // slug -> message
    lastStateOk: null,
    lastSweep: null,
    lastHeaderUpdated: null,
    fetchSource: null,
    links: () => null,
    linksLoaded: false,
  };
}

async function archive(ctx, res, contentType = "application/json") {
  if (DRY_RUN || !ctx.pg) return;
  try {
    await archiveRaw(ctx.pg, "ga-sos", res.url, gzipSync(res.body), `${contentType}+gzip`);
  } catch (err) {
    console.warn(`  archive failed for ${res.url}: ${err.message}`);
  }
}

// Returns true when the state feed changed.
async function fetchState(ctx) {
  const id = ctx.election.id;
  try {
    const res = await client.state(id);
    ctx.lastStateOk = new Date();
    ctx.fetchSource = "api";
    if (ctx.state?.source === "api" && ctx.state.hash === res.hash) return false;
    ctx.state = { feed: parseFeed(res.json), hash: res.hash, fetchedAt: res.fetchedAt, source: "api" };
    ctx.exportCounties = null;
    await archive(ctx, res);
    return true;
  } catch (err) {
    console.warn(`  state feed failed: ${err.message}`);
    await noteError(ctx, `state feed: ${err.message}`);
  }
  try {
    const res = await client.mediaExport(id);
    const { state, counties } = parseMediaExport(res.json, {
      isOfficial: Boolean(ctx.state?.feed.election.isOfficialResults),
      isPrimary: ctx.state?.feed.election.isPrimary ?? ctx.election.kind === "primary",
    });
    ctx.lastStateOk = new Date();
    ctx.fetchSource = "media-export";
    if (ctx.state?.source === "media-export" && ctx.state.hash === res.hash) return false;
    console.log(`  using the SOS media export (${counties.length} counties)`);
    ctx.state = { feed: state, hash: res.hash, fetchedAt: res.fetchedAt, source: "media-export" };
    ctx.exportCounties = counties;
    await archive(ctx, res);
    return true;
  } catch (err) {
    console.warn(`  media export failed: ${err.message}`);
    await noteError(ctx, `media export: ${err.message}`);
  }
  ctx.fetchSource = "last-known-good";
  return false;
}

// Counties taking part in this election: those with a locality election
// (special elections cover a few), else every child locality.
function participating(ctx) {
  const feed = ctx.state?.feed;
  if (!feed) return [];
  const byId = new Map(feed.localities.map((l) => [l.id, l]));
  const fromElections = feed.localityElections
    .map((e) => ({ locality: byId.get(e.jurisdictionId), lastUpdated: e.lastUpdated, isOfficial: e.isOfficialResults }))
    .filter((x) => x.locality);
  if (fromElections.length) return fromElections.map((x) => ({ slug: x.locality.shortName, name: x.locality.name, lastUpdated: x.lastUpdated, isOfficial: x.isOfficial }));
  return feed.localities.map((l) => ({ slug: l.shortName, name: l.name, lastUpdated: null, isOfficial: false }));
}

// Returns the number of county feeds that changed.
async function fetchCounties(ctx, list, { archiveEveryMs }) {
  if (!list.length) return 0;
  let changed = 0;
  const results = await client.pool(list, (c) => client.county(c.slug, ctx.election.id));
  for (const r of results) {
    const c = r.item;
    if (!r.ok) {
      ctx.countyErrors.set(c.slug, r.error.message);
      continue;
    }
    ctx.countyErrors.delete(c.slug);
    const prev = ctx.counties.get(c.slug);
    const entry = { name: c.name, feed: prev?.feed, hash: r.value.hash, lastUpdated: c.lastUpdated, fetchedAt: r.value.fetchedAt, archivedAt: prev?.archivedAt ?? null };
    if (prev?.hash !== r.value.hash) {
      entry.feed = parseFeed(r.value.json);
      changed++;
    }
    if (since(entry.archivedAt) >= archiveEveryMs) {
      await archive(ctx, r.value);
      entry.archivedAt = new Date();
    }
    ctx.counties.set(c.slug, entry);
  }
  const failed = results.filter((r) => !r.ok).length;
  if (failed) {
    console.warn(`  ${failed} county feed(s) failed: ${results.filter((r) => !r.ok).slice(0, 5).map((r) => r.item.slug).join(", ")}${failed > 5 ? "…" : ""}`);
    await noteError(ctx, `${failed} county feeds failed`);
  }
  return changed;
}

async function noteError(ctx, message) {
  if (ctx.pg && !DRY_RUN) await bumpError(ctx.pg, ctx.election.id, message).catch(() => {});
}

// ── evaluate + persist ──────────────────────────────────────────────────

function evaluate(ctx) {
  const { municipalRules, overrides } = inputs(ctx.election.id);
  const counties = ctx.exportCounties ?? [...ctx.counties.entries()].filter(([, c]) => c.feed).map(([slug, c]) => ({ slug, name: c.name, feed: c.feed }));
  const { contests, warnings } = assembleContests(ctx.state.feed, counties, { split: overrides.split ?? [], merge: overrides.merge ?? [] });
  const kind = ctx.election.kind ?? electionKind(ctx.state.feed.election.name);
  const evaluated = contests.map((c) => evaluateContest(c, { electionKind: kind, municipalRules, overrides }));
  return { evaluated, warnings, counties, kind };
}

function printTop(evaluated, sort = "votes", n = 25) {
  const ranked = evaluated
    .filter((e) => e.margin.rankable)
    .map((e) => ({ ...e, marginVotes: e.margin.marginVotes, marginPct: e.margin.marginPct }))
    .sort(sort === "percent" ? compareByPercent : compareByVotes)
    .slice(0, n);
  console.log(`\n  closest ${ranked.length} by ${sort}:`);
  for (const [i, e] of ranked.entries()) {
    const w = e.margin.cutoffWinner;
    const l = e.margin.cutoffLoser;
    console.log(
      `  ${String(i + 1).padStart(3)}. ${String(e.margin.marginVotes).padStart(7)} votes  ${e.margin.marginPct.toFixed(2).padStart(6)} pts  ` +
        `${e.name}${e.county ? ` (${e.county})` : ""} — ${w?.name} vs ${l?.name}  [${e.status}${e.flags.length ? `; ${e.flags.join(", ")}` : ""}]`,
    );
  }
}

async function revalidate() {
  const site = process.env.SITE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!site || !secret || DRY_RUN) return;
  try {
    const res = await fetch(`${site.replace(/\/$/, "")}/api/writ/revalidate`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.warn(`  revalidate -> ${res.status}`);
  } catch (err) {
    console.warn(`  revalidate failed: ${err.message}`);
  }
}

async function persist(ctx, mode) {
  const { evaluated, warnings, counties, kind } = evaluate(ctx);
  const header = ctx.state.feed.election;
  const id = ctx.election.id;
  const expectedCounties = ctx.exportCounties ? ctx.exportCounties.map((c) => ({ slug: c.slug, name: c.name })) : participating(ctx);
  const complete = ctx.fetchSource !== "last-known-good" && (Boolean(ctx.exportCounties) || expectedCounties.every((c) => ctx.counties.get(c.slug)?.feed && !ctx.countyErrors.has(c.slug)));

  if (DRY_RUN) {
    console.log(`  ${evaluated.length} contests (${evaluated.filter((e) => e.margin.rankable).length} ranked) from ${counties.length} county feeds [${ctx.fetchSource}]`);
    for (const w of warnings) console.log(`  note: ${w}`);
    printTop(evaluated, arg("sort", "votes"));
    return { inserted: 0, updated: 0, unchanged: evaluated.length };
  }

  const pg = ctx.pg;
  if (!ctx.linksLoaded) {
    ctx.links = await electionLinks(pg, { electionDate: header.electionDate, kind });
    ctx.linksLoaded = true;
  }
  const result = await writeContests(pg, { electionId: id, header, kind, evaluated, complete, link: ctx.links });

  for (const e of result.events) {
    await raiseAlert(pg, {
      election: id,
      key: `${e.kind}:${e.contestId}:${e.kind === "leader_change" ? e.ev.margin.leader?.name : e.ev.margin.totalVotes}`,
      kind: e.kind,
      severity: e.kind === "vote_decrease" || e.kind === "certification_regressed" ? "critical" : "warning",
      contestId: e.contestId,
      message: e.message,
    });
  }
  for (const w of warnings.filter((w) => w.startsWith("merged") || w.startsWith("ballot question"))) {
    await raiseAlert(pg, { election: id, key: `merge:${stableHash(w)}`, kind: "merge", severity: "info", message: `Check merge — ${w}` });
  }
  for (const w of warnings.filter((w) => w.startsWith("unlinked"))) {
    await raiseAlert(pg, { election: id, key: `unlinked:${stableHash(w)}`, kind: "unlinked", severity: "warning", message: `Statewide total may be incomplete — ${w.replace(/^unlinked: /, "")}` });
  }

  // Coverage: observed contests per county feed and per named municipality.
  const { manifest } = inputs(id);
  const countyRows = expectedCounties.map((c) => {
    const cached = ctx.exportCounties?.find((x) => x.slug === c.slug) ?? ctx.counties.get(c.slug);
    return { slug: c.slug, name: c.name, fetched: Boolean(cached?.feed) && !ctx.countyErrors.has(c.slug), observed: cached?.feed?.contests.length ?? 0 };
  });
  const municipalities = (manifest?.municipalities ?? []).map((m) => ({
    ...m,
    observed: evaluated.filter((e) => (e.municipality ?? "").toLowerCase() === String(m.name).toLowerCase()).length,
  }));
  const coverage = coverageRows({ electionId: id, counties: countyRows, manifest: manifest && { ...manifest, municipalities } });
  await writeCoverage(pg, coverage);
  const short = coverage.filter((r) => r.status === "missing" || r.status === "partial");
  if (short.length) {
    const names = short.map((r) => r.jurisdiction_name).sort();
    await raiseAlert(pg, {
      election: id,
      key: `coverage:${stableHash(names.join("|"))}`,
      kind: "coverage",
      message: `Coverage below 100%: ${names.slice(0, 12).join(", ")}${names.length > 12 ? ` and ${names.length - 12} more` : ""}`,
      payload: { jurisdictions: names },
    });
  }

  await updateStatus(pg, id, {
    source: "ga-sos",
    election_name: header.name || ctx.election.name,
    election_date: header.electionDate,
    election_kind: kind,
    mode,
    worker_id: WORKER,
    heartbeat_at: new Date(),
    last_state_fetch_at: ctx.lastStateOk,
    last_county_sweep_at: ctx.lastSweep,
    last_write_at: new Date(),
    source_updated_at: header.lastUpdated,
    is_official: header.isOfficialResults,
    fetch_source: ctx.fetchSource,
    contests: evaluated.length,
    counties_fetched: countyRows.filter((c) => c.fetched).length,
  });
  if (result.inserted || result.updated || result.removed) await revalidate();
  console.log(
    `  wrote ${result.inserted} new, ${result.updated} changed, ${result.unchanged} unchanged, ${result.removed} removed ` +
      `(${evaluated.length} contests, ${countyRows.filter((c) => c.fetched).length}/${countyRows.length} counties, ${ctx.fetchSource})`,
  );
  return result;
}

async function loadOnce(ctx, mode = "load") {
  console.log(`\n${ctx.election.id} — ${ctx.election.name}`);
  await fetchState(ctx);
  if (!ctx.state) throw new Error("no state feed from the API or the media export");
  const date = ctx.state.feed.election.electionDate;
  if (!inCycle(date)) throw new Error(`${ctx.election.id} is dated ${date}, outside the ${CYCLE} cycle; not loading it`);
  if (!ctx.exportCounties) {
    const list = participating(ctx);
    console.log(`  fetching ${list.length} county feeds…`);
    await fetchCounties(ctx, list, { archiveEveryMs: 0 });
    ctx.lastSweep = new Date();
  }
  return persist(ctx, mode);
}

// ── watch ───────────────────────────────────────────────────────────────

async function watch(ctx) {
  const every = Math.max(Number(arg("every", 180)) * 1000, BASE === SOS_BASE ? 30_000 : 1000);
  const deadline = Date.now() + duration(arg("until", "5h45m"));
  const archiveEveryMs = Number(arg("archive-counties-every", 60)) * MIN;
  let stopping = false;
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => ((stopping = true), console.log(`\n${sig}: finishing this round`)));

  // SOS can take an election's feed down before results start (Nov 3 2026's
  // went 404/empty after Oct 24), so a run started early waits for it
  // instead of failing. Only a missing feed is retried.
  while (!stopping && Date.now() < deadline) {
    try {
      await loadOnce(ctx, "watch");
      break;
    } catch (err) {
      if (ctx.state) throw err;
      console.warn(`  ${new Date().toISOString()} no feed for ${ctx.election.id} yet (${err.message}); retrying in ${every / 1000}s`);
      if (!DRY_RUN) await updateStatus(ctx.pg, ctx.election.id, { heartbeat_at: new Date(), worker_id: WORKER, mode: "waiting" }).catch(() => {});
      await sleep(every);
    }
  }
  if (!ctx.state) console.warn("  run ended before the feed appeared; the next run keeps waiting");
  let staleWebhookAt = 0;
  while (ctx.state && !stopping && Date.now() < deadline) {
    await sleep(every);
    if (stopping) break;
    const round = new Date();
    let header = null;
    try {
      header = (await client.header(ctx.election.id)).json;
    } catch (err) {
      console.warn(`  header failed: ${err.message}`);
      await noteError(ctx, `header: ${err.message}`);
    }
    let changed = false;
    const headerMoved = header && header.lastUpdated !== ctx.lastHeaderUpdated;
    if (!header || headerMoved || since(ctx.lastStateOk) >= STATE_STALE_MS / 2) {
      changed = (await fetchState(ctx)) || changed;
      if (header) ctx.lastHeaderUpdated = header.lastUpdated;
    }
    if (!ctx.exportCounties) {
      const all = participating(ctx);
      const fullSweep = since(ctx.lastSweep) >= FULL_SWEEP_MS;
      // A county is fetched when its own lastUpdated moved, when its last
      // fetch failed, or on the 15-minute full sweep — never skipped just
      // because percent reporting is unchanged.
      const due = fullSweep ? all : all.filter((c) => !ctx.counties.get(c.slug)?.feed || ctx.countyErrors.has(c.slug) || ctx.counties.get(c.slug).lastUpdated !== c.lastUpdated);
      if (due.length) changed = (await fetchCounties(ctx, due, { archiveEveryMs })) > 0 || changed;
      if (fullSweep) ctx.lastSweep = round;
    }

    try {
      if (changed) await persist(ctx, "watch");
      else if (!DRY_RUN) {
        await updateStatus(ctx.pg, ctx.election.id, { heartbeat_at: new Date(), last_state_fetch_at: ctx.lastStateOk, last_county_sweep_at: ctx.lastSweep, fetch_source: ctx.fetchSource, worker_id: WORKER, mode: "watch" });
        console.log(`  ${round.toISOString()} no change (${client.requests} requests so far)`);
      }
    } catch (err) {
      console.error(`  write failed: ${err.message}`);
      if (Date.now() - staleWebhookAt > 10 * MIN) {
        staleWebhookAt = Date.now();
        await sendWebhook(`🚨 [${ctx.election.id}] database write failed: ${err.message}`);
      }
      await noteError(ctx, `write: ${err.message}`);
      continue;
    }

    if (!DRY_RUN) await staleChecks(ctx);
    const feed = ctx.state?.feed;
    if (feed?.election.isOfficialResults && participating(ctx).every((c) => c.isOfficial)) {
      console.log("  results are official everywhere; stopping");
      break;
    }
  }
  if (!DRY_RUN) await updateStatus(ctx.pg, ctx.election.id, { heartbeat_at: new Date(), mode: stopping ? "stopped" : "watch-ended", worker_id: WORKER });
}

async function staleChecks(ctx) {
  const id = ctx.election.id;
  if (since(ctx.lastStateOk) >= STATE_STALE_MS) {
    await raiseAlert(ctx.pg, {
      election: id,
      key: `stale-state:${bucket(10)}`,
      kind: "stale_state",
      severity: "critical",
      message: `No successful state fetch for ${Math.round(since(ctx.lastStateOk) / MIN)} min (serving ${ctx.fetchSource})`,
    });
  }
  for (const c of participating(ctx)) {
    const cached = ctx.counties.get(c.slug);
    const behind = !cached?.feed || cached.lastUpdated !== c.lastUpdated;
    if (behind && since(cached?.fetchedAt ?? null) >= COUNTY_STALE_MS) {
      await raiseAlert(ctx.pg, {
        election: id,
        key: `stale-county:${c.slug}:${bucket(15)}`,
        kind: "stale_county",
        message: `${c.name} is reporting but our copy is ${cached?.fetchedAt ? `${Math.round(since(cached.fetchedAt) / MIN)} min` : "never"} old${ctx.countyErrors.has(c.slug) ? ` (${ctx.countyErrors.get(c.slug)})` : ""}`,
      });
    }
  }
}

// ── snapshot, reconcile, coverage template ──────────────────────────────

async function snapshot(pg, id) {
  const sort = arg("sort", "votes") === "percent" ? "percent" : "votes";
  const { rows } = await pg.query(CLOSE_RACE_ROWS_SQL, [id]);
  const { ranked } = filterReport(rows.map(toReportRow), { sort });
  if (!ranked.length) throw new Error(`no ranked contests for ${id}; load it first`);
  const file = closeRacesFilename(id, sort, new Date());
  const body = closeRacesCsv(ranked);
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(EXPORT_DIR, file), body);
  console.log(`  ${ranked.length} ranked contests → ${path.join(EXPORT_DIR, file)}`);
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const objectPath = `writ/close-races/${id}/${file}`;
    await upload("lake", objectPath, Buffer.from(body), "text/csv; charset=utf-8");
    console.log(`  published: ${lakeUrl(objectPath)}`);
  }
}

async function reconcile(pg, id) {
  const res = await client.mediaExport(id);
  const header = parseFeed((await client.state(id)).json).election;
  const { state, counties } = parseMediaExport(res.json, { isPrimary: header.isPrimary });
  const { overrides } = inputs(id);
  const { contests } = assembleContests(state, counties, { split: overrides.split ?? [], merge: overrides.merge ?? [] });
  const { rows } = await pg.query(
    `select c.external_id, c.total_votes, coalesce(json_object_agg(o.name_key, o.votes) filter (where o.id is not null), '{}') as votes
       from tracked_contests c left join tracked_contest_options o on o.contest_id = c.id
      where c.source_election_id = $1 and c.removed_at is null group by c.id`,
    [id],
  );
  const db = new Map(rows.map((r) => [r.external_id, r]));
  const problems = [];
  for (const c of contests) {
    const row = db.get(`ga-sos:${id}:${c.key}`);
    if (!row) {
      problems.push(`missing in DB: ${c.name}${c.county ? ` (${c.county})` : ""}`);
      continue;
    }
    db.delete(`ga-sos:${id}:${c.key}`);
    const label = `${c.name}${c.county ? ` (${c.county})` : ""}`;
    const total = c.options.reduce((s, o) => s + o.votes, 0);
    if (total !== row.total_votes) problems.push(`${label}: export ${total} vs DB ${row.total_votes}`);
    // Per candidate too: equal totals can hide two candidates' votes swapped.
    // Same-named lines ("Write-in", "Write-in#") are compared as one sum.
    const sums = (pairs) => {
      const m = new Map();
      for (const [k, v] of pairs) m.set(k.replace(/#+$/, ""), (m.get(k.replace(/#+$/, "")) ?? 0) + Number(v));
      return m;
    };
    const exported = sums(c.options.map((o) => [normalizeName(o.name), o.votes]));
    const stored = sums(Object.entries(row.votes));
    for (const name of new Set([...exported.keys(), ...stored.keys()])) {
      if (exported.get(name) !== stored.get(name)) problems.push(`${label} — ${name}: export ${exported.get(name) ?? "absent"} vs DB ${stored.get(name) ?? "absent"}`);
    }
  }
  for (const r of db.values()) problems.push(`in DB but not in export: ${r.external_id}`);
  console.log(`  reconcile ${id} against media export (${res.json.createdAt}): ${contests.length} contests, ${problems.length} mismatches`);
  for (const p of problems.slice(0, 40)) console.log(`    ${p}`);
  if (problems.length) process.exitCode = 1;
}

async function coverageTemplate(id) {
  const file = path.join(DATA_DIR, `coverage-${id}.json`);
  if (fs.existsSync(file)) throw new Error(`${file} exists; edit it instead`);
  const feed = parseFeed((await client.state(id)).json);
  const template = {
    _comment:
      "Expected contests per county (all contests on any ballot style in the county, state and local) from qualified-candidate lists, sample ballots and county notices. Leave expected null until checked: the report shows null as unverified. municipalities: cities that may run their own election outside the county board.",
    election: id,
    verifiedAt: null,
    counties: Object.fromEntries(feed.localities.map((l) => [l.shortName, { name: l.name, expected: null, source: null, notes: null }])),
    municipalities: [],
  };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(template, null, 2) + "\n");
  console.log(`  wrote ${file} (${feed.localities.length} counties)`);
}

// ── main ────────────────────────────────────────────────────────────────

async function main() {
  if (flag("list")) {
    for (const e of await listElections()) console.log(`${e.date}  ${e.kind.padEnd(8)} ${e.id.padEnd(48)} ${e.name}`);
    return;
  }

  if (flag("all")) {
    const elections = (await listElections()).reverse();
    console.log(`${CYCLE} cycle: ${elections.length} elections listed`);
    const pg = DRY_RUN ? null : await connectPg();
    try {
      for (const e of elections) await loadOnce(newContext(e, pg), "load");
    } finally {
      await pg?.end();
    }
    return;
  }

  if (flag("coverage-template")) return coverageTemplate(arg("election"));

  const election = await resolveElection(arg("election"));
  if (DRY_RUN && !flag("watch")) return void (await loadOnce(newContext(election, null)));

  const pg = await connectPg();
  const runId = DRY_RUN ? null : await startRun(pg, "ga-sos-results");
  try {
    if (flag("snapshot")) await snapshot(pg, election.id);
    else if (flag("reconcile")) await reconcile(pg, election.id);
    else if (flag("watch")) await watch(newContext(election, DRY_RUN ? null : pg));
    else {
      const result = await loadOnce(newContext(election, pg));
      if (runId) await finishRun(pg, runId, { inserted: result.inserted, updated: result.updated, skipped: result.unchanged, cursor: election.id });
      console.log(`  ${client.requests} requests`);
      return;
    }
    if (runId) await finishRun(pg, runId, { cursor: election.id });
  } catch (err) {
    if (runId) await finishRun(pg, runId, { status: "error", error: String(err?.stack ?? err).slice(0, 4000) });
    throw err;
  } finally {
    await pg.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
