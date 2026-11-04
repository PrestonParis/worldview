// Election-night rehearsal server for scripts/sync-ga-results.mjs. Serves a
// completed 2026-cycle election (default: the May 19 primary, all 159
// counties) from the SOS JSON API under a replay id, played back as
// if it were counting live: each frame scales every vote count and reporting
// unit up toward the final total, moves lastUpdated, and stays unofficial
// until the last frame. Scripted incidents along the way:
//
//   --flip=N     frame N puts the runner-up of the closest state contest
//                ahead (leader change); frame N+1 restores it, which also
//                lowers that contest's total (vote decrease, "correction")
//   --outage=N   frame N answers the state feed with 503 (the ingester falls
//                back to the media export, which the replay serves scaled to
//                the frame, reporting state included)
//   --recount=N  from frame N the election list carries a recount of the
//                closest state contest with its result reversed, under a later
//                date
//
// The last three frames are the road to certification: every unit in and
// election night complete, then fully reported (with the contest nearest 50%
// pushed under it by late ballots), then official.
//
// Usage:
//   node scripts/ga-results-replay.mjs --election=GeneralPrimary51926 [--as=REPLAYGeneralPrimary51926] [--frames=8] [--step=20] [--port=4319] [--flip=3] [--outage=5]
//   npm run sync:ga-results -- --base-url=http://localhost:4319 --election=REPLAYGeneralPrimary51926 --watch --every=5 --until=5m
//
// Source payloads are cached once under .cache/ga-replay/<election>/.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { arg } from "./lib/bulk.mjs";
import { sosClient } from "./lib/ga-sos.mjs";

const SOURCE = arg("election", "GeneralPrimary51926");
const AS = arg("as", `REPLAY${SOURCE.replace(/\W/g, "")}`);
const FRAMES = Number(arg("frames", 8));
const STEP_MS = Number(arg("step", 20)) * 1000;
const PORT = Number(arg("port", 4319));
const FLIP = Number(arg("flip", 3));
const OUTAGE = Number(arg("outage", 5));
const RECOUNT = Number(arg("recount", 4));
const RECOUNT_ID = `${AS}Recount`;
const COUNTING = FRAMES - 3;
const NIGHT = COUNTING;
const FULLY = COUNTING + 1;
const CACHE = path.join(".cache", "ga-replay", SOURCE);

const client = sosClient({ concurrency: 4 });

async function cached(name, load) {
  const file = path.join(CACHE, `${name}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  const json = (await load()).json;
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(json));
  return json;
}

console.log(`replay: loading ${SOURCE} (cached in ${CACHE})…`);
const state = await cached("state", () => client.state(SOURCE));
const byJurisdiction = new Map(state.jurisdiction.childLocalities.map((c) => [String(c.id).toLowerCase(), c.shortName]));
const countySlugs = state.localityElections.map((e) => byJurisdiction.get(String(e.jurisdictionId).toLowerCase())).filter(Boolean);
const counties = new Map();
for (const r of await client.pool(countySlugs, async (slug) => [slug, await cached(slug, () => client.county(slug, SOURCE))])) {
  if (r.ok) counties.set(r.value[0], r.value[1]);
}
console.log(`replay: ${counties.size} counties`);
const mediaExport = await cached("export", () => client.mediaExport(SOURCE));

// The closest two-way state contest: the one the leader flip targets.
const target = state.ballotItems
  .map((b) => ({ b, o: [...b.summaryResults.ballotOptions].sort((x, y) => y.voteCount - x.voteCount) }))
  .filter(({ o }) => o.length >= 2 && o[0].voteCount > 0)
  .sort((a, b) => (a.o[0].voteCount - a.o[1].voteCount) - (b.o[0].voteCount - b.o[1].voteCount))[0]?.b;
console.log(`replay: leader flip on "${target?.name?.[0]?.text}"`);

const started = Date.now();
const frameNow = () => Math.min(FRAMES - 1, Math.floor((Date.now() - started) / STEP_MS));
const fraction = (f) => Math.min(1, (f + 1) / COUNTING);
const reportingDetails = (f, reporting, total) => [
  { reportingStatusClientTextKey: "reporting-status-fully-reported", value: f >= FULLY ? reporting : 0 },
  { reportingStatusClientTextKey: "reporting-status-election-night-complete", value: f >= FULLY ? 0 : reporting },
  { reportingStatusClientTextKey: "reporting-status-partially-reported", value: 0 },
  { reportingStatusClientTextKey: "reporting-status-not-reported", value: Math.max(0, total - reporting) },
];
const GROUPS = ["Election Day", "Advance Voting", "Absentee by Mail", "Provisional"];
const groupStatus = (f) => GROUPS.map((name) => ({
  groupName: [{ languageId: "en", text: name }],
  reportingStatusClientTextKey: f >= FULLY ? "reporting-status-fully-reported" : f >= NIGHT ? "reporting-status-election-night-complete" : "reporting-status-not-reported",
}));

// The county contest nearest 50% with three or more options and a majority
// leader: late ballots push it under the line, which changes its outcome
// without changing its leader.
const crossing = (() => {
  let best = null;
  for (const [slug, feed] of counties) {
    for (const b of feed.ballotItems ?? []) {
      if (b.parentId) continue;
      const options = [...(b.summaryResults?.ballotOptions ?? [])].sort((x, y) => y.voteCount - x.voteCount);
      const total = options.reduce((s, o) => s + o.voteCount, 0);
      if (options.length < 3 || !total) continue;
      const share = options[0].voteCount / total;
      if (share > 0.5 && (!best || share < best.share)) best = { slug, id: b.id, share, name: b.name?.[0]?.text };
    }
  }
  return best;
})();
console.log(`replay: late ballots cross the line in "${crossing?.name}" (${crossing?.slug})`);
const stamp = (f) => new Date(Date.parse("2026-11-03T19:00:00Z") + f * 15 * 60_000).toISOString();

function scaleItem(item, f, { flip, correction }) {
  const isTarget = target && (item.id === target.id || item.parentId === target.id);
  // The correction frame holds the target at the previous frame's count and
  // takes 40 votes back, so its total goes down.
  const k = fraction(isTarget && correction ? f - 1 : f);
  const out = structuredClone(item);
  const rs = out.reportingStatus;
  if (rs) {
    rs.reportingUnits = Math.round((rs.totalUnits ?? 0) * k);
    rs.reportingStatusDetails = item.parentId || !state.ballotItems.some((b) => b.id === item.id) ? reportingDetails(f, rs.reportingUnits, rs.totalUnits ?? 0) : null;
  }
  for (const o of out.summaryResults?.ballotOptions ?? []) {
    o.voteCount = Math.round((o.voteCount ?? 0) * k);
    for (const g of o.groupResults ?? []) g.voteCount = Math.round((g.voteCount ?? 0) * k);
  }
  if (isTarget && (flip || correction)) {
    const o = [...out.summaryResults.ballotOptions].sort((x, y) => y.voteCount - x.voteCount);
    if (flip) o[1].voteCount = o[0].voteCount + 25; // runner-up briefly ahead
    if (correction) o[1].voteCount = Math.max(0, o[1].voteCount - 40); // corrected downward
  }
  if (crossing && item.id === crossing.id && f >= FULLY) {
    const o = [...out.summaryResults.ballotOptions].sort((x, y) => y.voteCount - x.voteCount);
    const total = o.reduce((s, x) => s + x.voteCount, 0);
    // Enough to the second-place candidate to drop the leader to about 49%.
    const move = Math.ceil(o[0].voteCount - total * 0.49);
    o[1].voteCount += move;
    o[0].voteCount -= move;
  }
  return out;
}

function frameOf(payload, f) {
  const out = structuredClone(payload);
  const last = f === FRAMES - 1;
  const opts = { flip: f === FLIP, correction: f === FLIP + 1 };
  out.ballotItems = (payload.ballotItems ?? []).map((b) => scaleItem(b, f, opts));
  if (out.election) Object.assign(out.election, { lastUpdated: stamp(f), isOfficialResults: last, groupReportingStatus: groupStatus(f) });
  for (const e of out.localityElections ?? []) Object.assign(e, { lastUpdated: stamp(f), isOfficialResults: last });
  return out;
}

// The media export for a frame: scaled like the feeds, with its per-county
// reporting state, in the export's own shape.
function exportFrame(f) {
  const k = fraction(f);
  const status = f >= FULLY ? "Fully Reported" : f >= NIGHT ? "Election Night Complete" : "Not Reported";
  const scale = (b) => ({
    ...b,
    precinctsReporting: Math.round((Number(b.precinctsParticipating) || 0) * k),
    ballotOptions: (b.ballotOptions ?? []).map((o) => ({
      ...o,
      voteCount: Math.round((o.voteCount ?? 0) * k),
      groupResults: (o.groupResults ?? []).map((g) => ({ ...g, voteCount: Math.round((g.voteCount ?? 0) * k) })),
    })),
  });
  const statuses = GROUPS.map((groupName) => ({ groupName, status }));
  return {
    ...mediaExport,
    createdAt: stamp(f),
    results: { ...mediaExport.results, ballotItems: mediaExport.results.ballotItems.map(scale), reportingStatuses: statuses },
    localResults: mediaExport.localResults.map((c) => ({ ...c, ballotItems: c.ballotItems.map(scale), reportingStatuses: statuses })),
  };
}

// The recount: the target contest alone, its top two reversed, every unit in.
function recountFeed(f) {
  const item = structuredClone(target);
  item.id = `recount-${target.id}`;
  item.name = [{ languageId: "en", text: `${target.name[0].text} Recount` }];
  const [first, second] = [...item.summaryResults.ballotOptions].sort((x, y) => y.voteCount - x.voteCount);
  [first.voteCount, second.voteCount] = [second.voteCount, first.voteCount];
  return {
    jurisdiction: { ...state.jurisdiction, childLocalities: [] },
    election: { ...state.election, id: RECOUNT_ID, name: [{ languageId: "en", text: `RECOUNT - Replay of ${SOURCE}` }], electionDate: "2026-12-03", lastUpdated: stamp(f), isOfficialResults: false, groupReportingStatus: [] },
    localityElections: [],
    ballotItems: [item],
  };
}

const send = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
};

http
  .createServer((req, res) => {
    const f = frameNow();
    const url = new URL(req.url, "http://replay");
    const p = decodeURIComponent(url.pathname);
    const api = "/results/public/api";
    if (p === `${api}/jurisdictions/Georgia`) {
      const elections = [{ publicElectionId: AS, electionDate: "2026-11-03", name: [{ languageId: "en", text: `Replay of ${SOURCE}` }] }];
      if (f >= RECOUNT) elections.push({ publicElectionId: RECOUNT_ID, electionDate: "2026-12-03", name: [{ languageId: "en", text: `RECOUNT - Replay of ${SOURCE}` }] });
      return send(res, 200, { elections });
    }
    if (p === `${api}/elections/Georgia/${AS}`) {
      return send(res, 200, { ...state.election, lastUpdated: stamp(f), isOfficialResults: f === FRAMES - 1 });
    }
    if (p === `${api}/elections/Georgia/${AS}/data`) {
      if (f === OUTAGE) return send(res, 503, { error: "replay outage" });
      return send(res, 200, frameOf(state, f));
    }
    if (p === `/cdn/results/Georgia/export-${AS}.json`) return send(res, 200, exportFrame(f));
    if (p === `${api}/elections/Georgia/${RECOUNT_ID}`) return send(res, 200, recountFeed(f).election);
    if (p === `${api}/elections/Georgia/${RECOUNT_ID}/data`) return send(res, 200, recountFeed(f));
    // Precincts: one synthetic precinct holding the contest's votes, so the audit adds up.
    const precinct = p.match(new RegExp(`^${api}/elections/([^/]+)/${AS}/ballot-items/(.+)$`));
    if (precinct && counties.has(precinct[1])) {
      const item = frameOf(counties.get(precinct[1]), f).ballotItems.find((b) => b.id === precinct[2]);
      if (!item) return send(res, 404, { error: "no such contest" });
      const options = item.summaryResults.ballotOptions;
      return send(res, 200, { ...item, breakdownResults: [{ precinct: { name: [{ languageId: "en", text: "Replay precinct" }] }, voteTotal: options.reduce((s, o) => s + o.voteCount, 0), ballotOptions: options }] });
    }
    const county = p.match(new RegExp(`^${api}/elections/([^/]+)/${AS}/data$`));
    if (county && counties.has(county[1])) return send(res, 200, frameOf(counties.get(county[1]), f));
    return send(res, 404, { error: "not in replay" });
  })
  .listen(PORT, () => console.log(`replay: ${AS} on http://localhost:${PORT}, ${FRAMES} frames × ${STEP_MS / 1000}s (flip ${FLIP}, outage ${OUTAGE}, recount ${RECOUNT}, election night complete ${NIGHT}, fully reported ${FULLY}, official ${FRAMES - 1})`));

setInterval(() => console.log(`replay: frame ${frameNow() + 1}/${FRAMES}`), STEP_MS).unref();
